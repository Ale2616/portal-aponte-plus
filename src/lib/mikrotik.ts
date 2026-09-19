import { Agent } from "undici";
import { getClientByDocument } from "@/lib/wisphub";

export interface MikrotikTrafficResult {
  success: boolean;
  enLinea: boolean;
  velocidad: {
    descargaMbps: number;
    subidaMbps: number;
    descargaBps: number;
    subidaBps: number;
    descargaFormateada: string;
    subidaFormateada: string;
  };
  consumo: {
    descargaBytes: number;
    subidaBytes: number;
    totalBytes: number;
    descargaMb: number;
    subidaMb: number;
    totalMb: number;
    descargaGb: number;
    subidaGb: number;
    totalGb: number;
    descargaFormateada: string;
    subidaFormateada: string;
    totalFormateada: string;
  };
  sesionEnVivo: {
    descarga: string;
    subida: string;
    textoResumen: string;
  };
  estadoCola: {
    activo: boolean;
    dinamica: boolean;
    nombre?: string;
    ip?: string;
  };
  timestamp: string;
  motivo?: string | null;
}

// Agente HTTP seguro para RouterOS con certificados auto-firmados
const mikrotikAgent = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

/**
 * Retorna una estructura vacía y defensiva cuando el router no responde,
 * está en proceso de configuración o el cliente no tiene tráfico activo.
 */
export function getEmptyTrafficResult(motivo = "Sin conexión activa"): MikrotikTrafficResult {
  return {
    success: true,
    enLinea: false,
    velocidad: {
      descargaMbps: 0,
      subidaMbps: 0,
      descargaBps: 0,
      subidaBps: 0,
      descargaFormateada: "0.0 Mbps",
      subidaFormateada: "0.0 Mbps",
    },
    consumo: {
      descargaBytes: 0,
      subidaBytes: 0,
      totalBytes: 0,
      descargaMb: 0,
      subidaMb: 0,
      totalMb: 0,
      descargaGb: 0,
      subidaGb: 0,
      totalGb: 0,
      descargaFormateada: "0.0 GB",
      subidaFormateada: "0.0 GB",
      totalFormateada: "0.0 GB",
    },
    sesionEnVivo: {
      descarga: "0.0 GB",
      subida: "0.0 GB",
      textoResumen: "↓ 0.0 GB • ↑ 0.0 GB",
    },
    estadoCola: {
      activo: false,
      dinamica: false,
    },
    timestamp: new Date().toISOString(),
    motivo,
  };
}

/**
 * Parsea el formato par 'subida/bajada' o 'tx/rx' característico de RouterOS Simple Queues.
 * En MikroTik: el primer valor corresponde a target-upload y el segundo a target-download.
 */
function parseMikrotikPair(value?: string | number): { upload: number; download: number } {
  if (value === undefined || value === null) return { upload: 0, download: 0 };
  const str = String(value).trim();
  if (!str.includes("/")) {
    const num = Number(str) || 0;
    return { upload: num, download: num };
  }
  const [upStr, downStr] = str.split("/");
  const upload = Number(upStr?.trim()) || 0;
  const download = Number(downStr?.trim()) || 0;
  return { upload, download };
}

/**
 * Convierte velocidad en bps a formato legible (Mbps o Kbps)
 */
function formatSpeed(bps: number): string {
  if (!bps || bps <= 0) return "0.0 Mbps";
  if (bps >= 1_000_000) {
    return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  }
  if (bps >= 1_000) {
    return `${(bps / 1_000).toFixed(0)} Kbps`;
  }
  return `${bps} bps`;
}

/**
 * Convierte bytes en formato amigable (GB o MB)
 */
function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0.0 GB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(0)} MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

/**
 * Consulta la API REST de MikroTik RouterOS v7 para obtener el tráfico y métricas en vivo.
 *
 * @param ipOrId Dirección IP del cliente, cédula o identificador de Simple Queue
 * @param clientCedula Cédula del cliente (opcional, para resolución automática de IP si aplica)
 * @returns MikrotikTrafficResult Métricas sanitizadas en tiempo real o fallback en 0.00
 */
export async function getMikrotikQueueTraffic(
  ipOrId: string,
  clientCedula?: string
): Promise<MikrotikTrafficResult> {
  const cleanTarget = (ipOrId || "").trim();
  const cleanCedula = (clientCedula || "").trim();

  if (!cleanTarget && !cleanCedula) {
    return getEmptyTrafficResult("Identificador o IP no especificado");
  }

  const host = process.env.MIKROTIK_HOST;
  const user = process.env.MIKROTIK_USER || "alejandro";
  const password = process.env.MIKROTIK_PASS || process.env.MIKROTIK_PASSWORD || "alejandro2026";
  const port = process.env.MIKROTIK_PORT || "443";
  const useSsl = process.env.MIKROTIK_USE_SSL !== "false";

  // Si las credenciales no están configuradas en el entorno
  if (
    !host ||
    !user ||
    !password ||
    host === "tu_ip_o_dominio_mikrotik" ||
    host === "tu_ip_o_host_del_router" ||
    host === "localhost"
  ) {
    return getEmptyTrafficResult("Credenciales de MikroTik no configuradas o host en espera de IP real");
  }

  const protocol = useSsl ? "https" : "http";
  const baseUrl = `${protocol}://${host}:${port}`;
  const authHeader = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

  try {
    // Función auxiliar para consultar el endpoint REST de colas simples
    const fetchQueue = async (queryParam: string) => {
      const url = `${baseUrl}/rest/queue/simple${queryParam ? `?${queryParam}` : ""}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(3500),
        // @ts-expect-error Node.js undici dispatcher support
        dispatcher: useSsl ? mikrotikAgent : undefined,
      });

      if (!res.ok) return null;
      return await res.json();
    };

    let queueData: any = null;

    // Detectar si cleanTarget es una IP válida (v4)
    const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(cleanTarget);
    let resolvedIp = isIpAddress ? cleanTarget.replace(/\/\d+$/, "") : "";

    // Si cleanTarget parece ser una cédula (o se pasó clientCedula), intentar resolver IP en WispHub
    if (!resolvedIp && (/^\d{5,15}$/.test(cleanTarget) || cleanCedula)) {
      try {
        const docToLookup = isIpAddress ? cleanCedula : cleanTarget || cleanCedula;
        if (docToLookup) {
          const clientData = await getClientByDocument(docToLookup);
          if (clientData.success && clientData.cliente) {
            const potentialIp =
              (clientData.cliente.servicio as any)?.ip ||
              (clientData.cliente as any)?.ip ||
              clientData.cliente.servicio?.ip;
            if (
              potentialIp &&
              typeof potentialIp === "string" &&
              potentialIp !== "0.0.0.0" &&
              !potentialIp.toLowerCase().includes("no asignada")
            ) {
              resolvedIp = potentialIp.trim().replace(/^["']|["']$/g, "").replace(/\/\d+$/, "");
            }
          }
        }
      } catch {
        // Ignorar fallo de resolución de WispHub y continuar
      }
    }

    // 1. Búsqueda por target=IP/32 si tenemos una IP
    if (resolvedIp) {
      try {
        const resMask = await fetchQueue(`target=${encodeURIComponent(`${resolvedIp}/32`)}`);
        if (Array.isArray(resMask) && resMask.length > 0) {
          queueData = resMask[0];
        }
      } catch {
        // Continuar al siguiente intento
      }

      // 2. Búsqueda por target=IP (sin máscara)
      if (!queueData) {
        try {
          const resIp = await fetchQueue(`target=${encodeURIComponent(resolvedIp)}`);
          if (Array.isArray(resIp) && resIp.length > 0) {
            queueData = resIp[0];
          }
        } catch {
          // Continuar
        }
      }
    }

    // 3. Búsqueda por name (ID de línea, cédula o nombre exacto)
    if (!queueData && cleanTarget) {
      try {
        const resName = await fetchQueue(`name=${encodeURIComponent(cleanTarget)}`);
        if (Array.isArray(resName) && resName.length > 0) {
          queueData = resName[0];
        }
      } catch {
        // Continuar
      }
    }

    // 4. Búsqueda por name usando la cédula
    if (!queueData && cleanCedula) {
      try {
        const resCed = await fetchQueue(`name=${encodeURIComponent(cleanCedula)}`);
        if (Array.isArray(resCed) && resCed.length > 0) {
          queueData = resCed[0];
        }
      } catch {
        // Continuar
      }
    }

    // 5. Fallback amplio: obtener colas simples y buscar coincidencia en nombre, target o comentario
    if (!queueData) {
      try {
        const allQueues = await fetchQueue(".proplist=.id,name,target,rate,bytes,disabled,dynamic,comment");
        if (Array.isArray(allQueues) && allQueues.length > 0) {
          const searchTerms = [cleanTarget, cleanCedula, resolvedIp].filter(Boolean);
          queueData = allQueues.find((q: any) => {
            const qName = String(q.name || "").toLowerCase();
            const qTarget = String(q.target || "").toLowerCase();
            const qComment = String(q.comment || "").toLowerCase();

            return searchTerms.some((term) => {
              const lower = term.toLowerCase();
              return qName.includes(lower) || qTarget.includes(lower) || qComment.includes(lower);
            });
          });
        }
      } catch {
        // Continuar
      }
    }

    // Si no se encontró ninguna cola para esta IP/cliente
    if (!queueData) {
      return getEmptyTrafficResult("Cliente desconectado o sin cola simple activa");
    }

    // Extracción de datos en tiempo real
    const isDisabled =
      queueData.disabled === "true" ||
      queueData.disabled === true ||
      queueData.invalid === "true" ||
      queueData.invalid === true;

    const isDynamic = queueData.dynamic === "true" || queueData.dynamic === true;

    // Parsear tasas de transferencia en tiempo real (rate: upload/download en bps)
    const ratePair = parseMikrotikPair(queueData.rate);
    const uploadBps = ratePair.upload;
    const downloadBps = ratePair.download;

    const uploadMbps = Number((uploadBps / 1_000_000).toFixed(2));
    const downloadMbps = Number((downloadBps / 1_000_000).toFixed(2));

    // Parsear consumo acumulado de sesión (bytes: upload/download en bytes)
    const bytesPair = parseMikrotikPair(queueData.bytes);
    const uploadBytes = bytesPair.upload;
    const downloadBytes = bytesPair.download;
    const totalBytes = downloadBytes + uploadBytes;

    const uploadGb = Number((uploadBytes / (1024 * 1024 * 1024)).toFixed(2));
    const downloadGb = Number((downloadBytes / (1024 * 1024 * 1024)).toFixed(2));
    const totalGb = Number((totalBytes / (1024 * 1024 * 1024)).toFixed(2));

    const uploadMb = Number((uploadBytes / (1024 * 1024)).toFixed(0));
    const downloadMb = Number((downloadBytes / (1024 * 1024)).toFixed(0));
    const totalMb = Number((totalBytes / (1024 * 1024)).toFixed(0));

    const downloadFormateada = formatBytes(downloadBytes);
    const subidaFormateada = formatBytes(uploadBytes);
    const totalFormateada = formatBytes(totalBytes);

    // PRIVACIDAD ESTRICTA: Solo devolver métricas numéricas y formateadas calculadas.
    // NUNCA incluir contraseñas ni configuraciones internas sensibles.
    return {
      success: true,
      enLinea: !isDisabled,
      velocidad: {
        descargaMbps: downloadMbps,
        subidaMbps: uploadMbps,
        descargaBps: downloadBps,
        subidaBps: uploadBps,
        descargaFormateada: formatSpeed(downloadBps),
        subidaFormateada: formatSpeed(uploadBps),
      },
      consumo: {
        descargaBytes: downloadBytes,
        subidaBytes: uploadBytes,
        totalBytes,
        descargaMb: downloadMb,
        subidaMb: uploadMb,
        totalMb,
        descargaGb: downloadGb,
        subidaGb: uploadGb,
        totalGb,
        descargaFormateada: downloadFormateada,
        subidaFormateada,
        totalFormateada,
      },
      sesionEnVivo: {
        descarga: downloadFormateada,
        subida: subidaFormateada,
        textoResumen: `↓ ${downloadFormateada} • ↑ ${subidaFormateada}`,
      },
      estadoCola: {
        activo: !isDisabled,
        dinamica: isDynamic,
        nombre: queueData.name ? String(queueData.name) : undefined,
        ip: resolvedIp || (queueData.target ? String(queueData.target).replace(/\/32$/, "") : undefined),
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    // Si el router no responde (timeout) o hay error de red, retornar 200 con ceros defensivamente
    console.warn(
      "[MikroTik API Defensivo]: Router no respondió o error de conexión:",
      error?.message || error
    );
    return getEmptyTrafficResult("Router MikroTik no disponible");
  }
}
