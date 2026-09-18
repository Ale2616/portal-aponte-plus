import { Agent } from "undici";

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
    descargaMb: number;
    subidaMb: number;
    descargaGb: number;
    subidaGb: number;
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
      descargaMb: 0,
      subidaMb: 0,
      descargaGb: 0,
      subidaGb: 0,
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
 * @param ipOrId Dirección IP del cliente (ej. 172.16.100.17) o identificador de cola
 * @returns MikrotikTrafficResult Métricas sanitizadas en tiempo real o fallback en 0.00
 */
export async function getMikrotikQueueTraffic(ipOrId: string): Promise<MikrotikTrafficResult> {
  const cleanTarget = (ipOrId || "").trim();
  if (!cleanTarget || cleanTarget === "0.0.0.0" || cleanTarget.toLowerCase().includes("no asignada")) {
    return getEmptyTrafficResult("IP de servicio no válida");
  }

  const host = process.env.MIKROTIK_HOST;
  const user = process.env.MIKROTIK_USER;
  const password = process.env.MIKROTIK_PASSWORD;
  const port = process.env.MIKROTIK_PORT || "443";
  const useSsl = process.env.MIKROTIK_USE_SSL !== "false";

  // Si las credenciales no están configuradas en el entorno
  if (!host || !user || !password || host === "tu_ip_o_dominio_mikrotik" || host === "localhost") {
    return getEmptyTrafficResult("Credenciales de MikroTik no configuradas");
  }

  const protocol = useSsl ? "https" : "http";
  const baseUrl = `${protocol}://${host}:${port}`;
  const authHeader = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

  try {
    // Intentar buscar la cola simple por target con /32 o directo
    const targetWithMask = cleanTarget.includes("/") ? cleanTarget : `${cleanTarget}/32`;
    const targetClean = cleanTarget.replace(/\/32$/, "");

    // Realizar la consulta con timeout defensivo estricto (3.5s)
    const fetchQueue = async (queryParam: string) => {
      const url = `${baseUrl}/rest/queue/simple?${queryParam}`;
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

    // 1. Búsqueda por target=IP/32
    try {
      const resMask = await fetchQueue(`target=${encodeURIComponent(targetWithMask)}`);
      if (Array.isArray(resMask) && resMask.length > 0) {
        queueData = resMask[0];
      }
    } catch {
      // Ignorar y pasar al siguiente fallback
    }

    // 2. Búsqueda por target=IP (sin máscara)
    if (!queueData) {
      try {
        const resIp = await fetchQueue(`target=${encodeURIComponent(targetClean)}`);
        if (Array.isArray(resIp) && resIp.length > 0) {
          queueData = resIp[0];
        }
      } catch {
        // Ignorar
      }
    }

    // 3. Búsqueda por name (ID de línea o usuario)
    if (!queueData) {
      try {
        const resName = await fetchQueue(`name=${encodeURIComponent(cleanTarget)}`);
        if (Array.isArray(resName) && resName.length > 0) {
          queueData = resName[0];
        }
      } catch {
        // Ignorar
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

    const uploadGb = Number((uploadBytes / (1024 * 1024 * 1024)).toFixed(2));
    const downloadGb = Number((downloadBytes / (1024 * 1024 * 1024)).toFixed(2));
    const uploadMb = Number((uploadBytes / (1024 * 1024)).toFixed(0));
    const downloadMb = Number((downloadBytes / (1024 * 1024)).toFixed(0));

    const downloadFormateada = formatBytes(downloadBytes);
    const subidaFormateada = formatBytes(uploadBytes);
    const totalBytes = downloadBytes + uploadBytes;
    const totalFormateada = formatBytes(totalBytes);

    // PRIVACIDAD ESTRICTA: Solo devolver métricas numéricas y formateadas calculadas.
    // NUNCA incluir nombres de interfaces WAN, comentarios de infraestructura ni rutas del router.
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
        descargaMb: downloadMb,
        subidaMb: uploadMb,
        descargaGb: downloadGb,
        subidaGb: uploadGb,
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
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    // Si el router no responde (timeout) o hay error de red, retornar 200 con ceros defensivamente
    console.warn("[MikroTik API Defensivo]: Router no respondió o error de conexión:", error?.message || error);
    return getEmptyTrafficResult("Router MikroTik no disponible");
  }
}
