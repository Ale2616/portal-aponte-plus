import https from "node:https";
import { getClientByDocument } from "@/lib/wisphub";

// Asegurar que Node.js no rechace certificados autofirmados de MikroTik
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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

/**
 * Agente HTTPS tolerante con certificados autofirmados y suites de cifrado de RouterOS
 */
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  ciphers: "ALL:@SECLEVEL=0",
  minVersion: "TLSv1",
});

/**
 * Retorna una estructura vacía y defensiva cuando el router no responde
 * o el cliente no tiene tráfico activo.
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
 * Helper de consulta HTTPS nativa hacia la API REST de RouterOS con soporte SSL autofirmado
 */
async function mikrotikRestGet(path: string, authHeader: string, host: string, port: number): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const options: https.RequestOptions = {
      hostname: host,
      port: port,
      path,
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      agent: httpsAgent,
      timeout: 5000,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode || 200, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, data: null });
        }
      });
    });

    req.on("error", (err) => {
      console.warn(`[MikroTik] Error de conexión en ${path}:`, err.message);
      resolve({ status: 500, data: null });
    });

    req.on("timeout", () => {
      req.destroy();
      console.warn(`[MikroTik] Timeout al consultar ${path}`);
      resolve({ status: 504, data: null });
    });

    req.end();
  });
}

/**
 * Consulta la API REST de MikroTik RouterOS para obtener el tráfico y métricas en vivo.
 *
 * @param ipOrId Dirección IP del cliente, o identificador de Simple Queue
 * @param clientCedula Cédula del cliente (opcional para resolver IP en WispHub si no se proporcionó IP)
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
  const port = parseInt(process.env.MIKROTIK_PORT || "443", 10);

  if (
    !host ||
    !user ||
    !password ||
    host === "tu_ip_o_dominio_mikrotik" ||
    host === "localhost"
  ) {
    return getEmptyTrafficResult("Credenciales de MikroTik no configuradas o host en espera de IP real");
  }

  const authHeader = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

  // 1. Resolver la IP del cliente
  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(cleanTarget);
  let resolvedIp = isIpAddress ? cleanTarget.replace(/\/\d+$/, "") : "";

  // Si cleanTarget no es IP pero parece cédula, resolver IP en WispHub
  if (!resolvedIp && (/^\d{5,15}$/.test(cleanTarget) || cleanCedula)) {
    try {
      const docToLookup = cleanTarget || cleanCedula;
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
    } catch {}
  }

  const targetToSearch = resolvedIp || cleanTarget;

  // Log de diagnóstico requerido
  console.log(`[MikroTik] Consultando tráfico para IP / Queue: ${targetToSearch}`);

  try {
    // 2. Consultar colas simples en MikroTik
    const queueResponse = await mikrotikRestGet("/rest/queue/simple", authHeader, host, port);
    const queues = Array.isArray(queueResponse.data) ? queueResponse.data : [];

    let queueData: any = null;

    if (queues.length > 0) {
      // Buscar cola cuyo target contenga la IP (ej: '172.16.20.26/32' o '172.16.20.26')
      queueData = queues.find((q: any) => {
        const qTarget = String(q.target || "").trim();
        const qName = String(q.name || "").trim();
        const qId = String(q[".id"] || "").trim();

        if (resolvedIp) {
          if (qTarget === `${resolvedIp}/32` || qTarget === resolvedIp || qTarget.includes(resolvedIp)) {
            return true;
          }
        }
        if (cleanTarget) {
          if (qTarget.includes(cleanTarget) || qName.includes(cleanTarget) || qId === cleanTarget) {
            return true;
          }
        }
        return false;
      });
    }

    // Log de diagnóstico con resultado de la búsqueda
    console.log(
      `[MikroTik] Respuesta del router (status: ${queueResponse.status}, datos encontrados: ${queueData ? "Sí" : "No"}):`,
      queueData
        ? { name: queueData.name, target: queueData.target, rate: queueData.rate, bytes: queueData.bytes }
        : "Cola no encontrada en /rest/queue/simple"
    );

    // Si no se encontró la cola, imprimir nombres y targets de las colas devueltas
    if (!queueData) {
      console.log(
        `[MikroTik] Colas devueltas por el router (${queues.length}):`,
        queues.map((q: any) => q.name || q.target)
      );
    }

    // 3. Comprobación complementaria en la tabla ARP para verificar si la línea está físicamente activa
    let isClientInArp = false;
    if (resolvedIp) {
      const arpResponse = await mikrotikRestGet("/rest/ip/arp", authHeader, host, port);
      if (Array.isArray(arpResponse.data)) {
        const arpMatch = arpResponse.data.find((a: any) => a.address === resolvedIp);
        if (arpMatch && (arpMatch.status === "reachable" || arpMatch.complete === "true")) {
          isClientInArp = true;
          console.log(
            `[MikroTik] Cliente detectado activo en tabla ARP: IP ${resolvedIp}, MAC: ${arpMatch["mac-address"] || "N/A"}, Interfaz: ${arpMatch.interface || "N/A"}`
          );
        }
      }
    }

    // 4. Si se encontró la cola simple, parsear tasas en tiempo real
    if (queueData) {
      const isDisabled =
        queueData.disabled === "true" ||
        queueData.disabled === true ||
        queueData.invalid === "true" ||
        queueData.invalid === true;

      // Parsear tasas numéricas en tiempo real (rate: upload/download en bps)
      const ratePair = parseMikrotikPair(queueData.rate);
      const uploadBps = ratePair.upload;
      const downloadBps = ratePair.download;

      // Conversión a Mbps (bits/segundo divididos por 1,000,000)
      const uploadMbps = Number((uploadBps / 1_000_000).toFixed(2));
      const downloadMbps = Number((downloadBps / 1_000_000).toFixed(2));

      // Parsear consumo acumulado de sesión (bytes: upload/download)
      const bytesPair = parseMikrotikPair(queueData.bytes);
      const uploadBytes = bytesPair.upload;
      const downloadBytes = bytesPair.download;
      const totalBytes = downloadBytes + uploadBytes;

      const uploadGb = Number((uploadBytes / (1024 * 1024 * 1024)).toFixed(2));
      const downloadGb = Number((downloadBytes / (1024 * 1024 * 1024)).toFixed(2));
      const totalGb = Number((totalBytes / (1024 * 1024 * 1024)).toFixed(2));

      return {
        success: true,
        enLinea: !isDisabled && (uploadMbps > 0 || downloadMbps > 0 || isClientInArp),
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
          descargaMb: Number((downloadBytes / (1024 * 1024)).toFixed(0)),
          subidaMb: Number((uploadBytes / (1024 * 1024)).toFixed(0)),
          totalMb: Number((totalBytes / (1024 * 1024)).toFixed(0)),
          descargaGb: downloadGb,
          subidaGb: uploadGb,
          totalGb,
          descargaFormateada: formatBytes(downloadBytes),
          subidaFormateada: formatBytes(uploadBytes),
          totalFormateada: formatBytes(totalBytes),
        },
        sesionEnVivo: {
          descarga: formatBytes(downloadBytes),
          subida: formatBytes(uploadBytes),
          textoResumen: `↓ ${formatBytes(downloadBytes)} • ↑ ${formatBytes(uploadBytes)}`,
        },
        estadoCola: {
          activo: !isDisabled,
          dinamica: queueData.dynamic === "true" || queueData.dynamic === true,
          nombre: queueData.name,
          ip: queueData.target,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // 5. Si no hay Simple Queue individual pero el cliente está activo en ARP
    if (isClientInArp) {
      return {
        success: true,
        enLinea: true,
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
          textoResumen: "Línea conectada en espera de tráfico",
        },
        estadoCola: {
          activo: true,
          dinamica: true,
          ip: resolvedIp,
        },
        timestamp: new Date().toISOString(),
        motivo: "Cliente activo en red (tabla ARP)",
      };
    }

    return getEmptyTrafficResult("Cliente en espera de tráfico o sin cola simple activa");
  } catch (error: any) {
    console.warn("[MikroTik] Error procesando consulta de tráfico:", error?.message || error);
    return getEmptyTrafficResult("Error de comunicación con router MikroTik");
  }
}
