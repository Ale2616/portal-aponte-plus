import { NextRequest, NextResponse } from "next/server";
import {
  upsertHistorialTrafico,
  getHistorialTraficoByServicio,
  HistorialTraficoClienteRecord,
} from "@/lib/db-historial-trafico";
import { getFullTrafficRecord } from "@/lib/traffic-cache";
import { searchWisphubClient } from "@/lib/wisphub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_LARGOS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * Consulta a la API de WispHub los datos de servicio o cliente
 */
async function fetchWisphubServiceRaw(idServicio: string): Promise<any | null> {
  const apiKey = process.env.WISPHUB_API_KEY;
  if (!apiKey) return null;

  const candidateUrls = [
    `https://api.wisphub.net/api/clientes/${idServicio}/`,
    `https://api.wisphub.net/api/servicios/${idServicio}/`,
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          "Authorization": `Api-Key ${apiKey.trim()}`,
          "Api-Key": apiKey.trim(),
          "Accept": "application/json",
        },
        cache: "no-store",
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      console.warn(`[WispHub Sync] Error consultando ${url}:`, err.message);
    }
  }

  return null;
}

/**
 * Consulta el tráfico real del servicio desde WispHub utilizando la URL
 * asociada al servicio o los endpoints de API con WISPHUB_API_KEY.
 *
 * Emite obligatoriamente los logs de diagnóstico requeridos:
 *   [WispHub Trafico] Solicitando servicio ID: <id_servicio>
 *   [WispHub Trafico] Status de respuesta: <status>
 *   [WispHub Trafico] Data cruda recibida: <data>
 */
async function fetchWisphubMonthlyTraffic(
  idServicio: string,
  slugOrUser?: string
): Promise<{ status: number; data: any | null }> {
  const apiKey = process.env.WISPHUB_API_KEY || "";

  // Slug o usuario sin el sufijo de dominio (ej: libierney-collazos-ardila)
  const cleanSlug = (slugOrUser || "")
    .replace(/@.*$/, "")
    .trim();

  // URL visible en panel: https://wisphub.net/trafico/mes/servicio/{slug_o_usuario}/{id_servicio}/
  const candidateUrls: string[] = [
    cleanSlug ? `https://wisphub.net/trafico/mes/servicio/${encodeURIComponent(cleanSlug)}/${idServicio}/` : "",
    slugOrUser ? `https://wisphub.net/trafico/mes/servicio/${encodeURIComponent(slugOrUser)}/${idServicio}/` : "",
    `https://api.wisphub.net/api/servicios/${idServicio}/trafico/`,
    `https://api.wisphub.net/api/trafico/mes/servicio/${idServicio}/`,
    `https://api.wisphub.net/api/clientes/${idServicio}/trafico/`,
  ].filter(Boolean);

  console.log('[WispHub Trafico] Solicitando servicio ID:', idServicio);

  let lastStatus = 0;
  let lastData: any = null;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          ...(apiKey ? {
            "Authorization": `Api-Key ${apiKey.trim()}`,
            "Api-Key": apiKey.trim(),
          } : {}),
          "Accept": "application/json, text/html",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        cache: "no-store",
      });

      lastStatus = res.status;

      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          lastData = await res.json();
        } else {
          const text = await res.text();
          try {
            lastData = JSON.parse(text);
          } catch {
            // Verificar si el HTML contiene JSON embebido o tablas
            const parsed = parseWisphubHtmlTraffic(text);
            if (parsed && parsed.length > 0) {
              lastData = parsed;
            }
          }
        }

        if (lastData) {
          console.log('[WispHub Trafico] Status de respuesta:', res.status);
          console.log('[WispHub Trafico] Data cruda recibida:', JSON.stringify(lastData).slice(0, 500));
          return { status: res.status, data: lastData };
        }
      }
    } catch (err: any) {
      console.error(`[WispHub Trafico Error] Falló consulta a ${url}:`, err.message);
    }
  }

  console.log('[WispHub Trafico] Status de respuesta:', lastStatus || 500);
  console.log('[WispHub Trafico] Data cruda recibida:', JSON.stringify(lastData || {}).slice(0, 500));

  return { status: lastStatus || 500, data: lastData };
}

/**
 * Parsea tablas o estructuras HTML si WispHub responde con página web
 */
function parseWisphubHtmlTraffic(html: string): any[] {
  const results: any[] = [];
  try {
    const tableMatch = html.match(/<table[\s\S]*?<\/table>/gi);
    if (!tableMatch) return results;

    for (const table of tableMatch) {
      const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      for (const row of rows) {
        const cols = row.match(/<td[\s\S]*?<\/td>/gi) || [];
        if (cols.length >= 3) {
          const colTexts = cols.map((c) => c.replace(/<[^>]+>/g, "").trim());
          const mesStr = colTexts[0];
          const dlStr = colTexts[1];
          const ulStr = colTexts[2];

          const mesIdx = MESES_CORTOS.findIndex((m) =>
            mesStr.toLowerCase().startsWith(m.toLowerCase())
          );
          if (mesIdx >= 0) {
            const parseNum = (s: string) => {
              const m = s.replace(",", ".").match(/[\d.]+/);
              return m ? parseFloat(m[0]) : 0;
            };
            results.push({
              mes: MESES_CORTOS[mesIdx],
              mes_numero: mesIdx + 1,
              descarga_gb: parseNum(dlStr),
              subida_gb: parseNum(ulStr),
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.error("[WispHub Trafico Error] Error parseando HTML:", err.message);
  }
  return results;
}

/**
 * Parsea el payload devuelto por WispHub en registros mensuales normalizados
 */
function parseWisphubMonthlyPayload(
  data: any,
  anio: number,
  idServicio: string,
  cedula: string
): Omit<HistorialTraficoClienteRecord, "updated_at">[] {
  if (!data) return [];
  const records: Omit<HistorialTraficoClienteRecord, "updated_at">[] = [];

  const items = Array.isArray(data)
    ? data
    : Array.isArray(data.meses)
    ? data.meses
    : Array.isArray(data.results)
    ? data.results
    : Array.isArray(data.data)
    ? data.data
    : null;

  if (items) {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const mesNum = Number(item.mes_numero || item.mesNumero || item.mes || item.month);
      if (!isNaN(mesNum) && mesNum >= 1 && mesNum <= 12) {
        const dl = Number(item.descarga_gb ?? item.download_gb ?? item.bajada ?? item.rx ?? 0);
        const ul = Number(item.subida_gb ?? item.upload_gb ?? item.subida ?? item.tx ?? 0);
        records.push({
          id_servicio: idServicio,
          cedula,
          anio,
          mes: mesNum,
          mes_nombre: MESES_CORTOS[mesNum - 1],
          descarga_gb: dl,
          subida_gb: ul,
        });
      }
    }
  } else if (typeof data === "object") {
    for (const [key, val] of Object.entries(data)) {
      const mesNum = parseInt(key, 10);
      if (!isNaN(mesNum) && mesNum >= 1 && mesNum <= 12 && typeof val === "object" && val !== null) {
        const item: any = val;
        const dl = Number(item.descarga_gb ?? item.download_gb ?? item.bajada ?? item.rx ?? 0);
        const ul = Number(item.subida_gb ?? item.upload_gb ?? item.subida ?? item.tx ?? 0);
        records.push({
          id_servicio: idServicio,
          cedula,
          anio,
          mes: mesNum,
          mes_nombre: MESES_CORTOS[mesNum - 1],
          descarga_gb: dl,
          subida_gb: ul,
        });
      }
    }
  }

  return records;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idServicioRaw = searchParams.get("id_servicio") || searchParams.get("id") || searchParams.get("cliente");
    const cedulaRaw = searchParams.get("cedula") || searchParams.get("documento");
    const anioParam = searchParams.get("anio") || searchParams.get("year");

    const anio = anioParam ? parseInt(anioParam, 10) : new Date().getFullYear();
    let idServicio = idServicioRaw ? String(idServicioRaw).trim() : "";
    let cedula = cedulaRaw ? String(cedulaRaw).trim() : "";

    if (!idServicio && !cedula) {
      return NextResponse.json(
        { success: false, error: "Debe especificar 'id_servicio' o 'cedula'" },
        { status: 400 }
      );
    }

    // 1. Si no hay id_servicio pero sí cédula, buscar el cliente en WispHub
    let clientDetail: any = null;
    if (!idServicio && cedula) {
      try {
        const found = await searchWisphubClient(cedula);
        if (found) {
          idServicio = String(found.id_servicio || found.id || "");
          clientDetail = found;
        }
      } catch {}
    }

    if (!idServicio) {
      console.error(`[WispHub Trafico Error] No se encontró el id_servicio para cédula: ${cedula}`);
      return NextResponse.json(
        { success: false, error: "No se encontró el id_servicio para el cliente solicitado" },
        { status: 404 }
      );
    }

    // 2. Consultar detalle del cliente en WispHub con API Key si aún no lo tenemos
    if (!clientDetail) {
      if (idServicio) {
        clientDetail = await fetchWisphubServiceRaw(idServicio);
      }
      if (!clientDetail && cedula) {
        clientDetail = await searchWisphubClient(cedula);
      }
    }

    if (!cedula && clientDetail?.cedula) {
      cedula = String(clientDetail.cedula).trim();
    }

    // 3. Consulta directa a WispHub
    const slugOrUser = clientDetail?.usuario || clientDetail?.usuario_rb || "";
    const wisphubRes = await fetchWisphubMonthlyTraffic(idServicio, slugOrUser);

    let dbRecords: HistorialTraficoClienteRecord[] = [];

    // Si WispHub devolvió datos válidos, parsearlos y guardarlos en persistencia local
    if (wisphubRes.status === 200 && wisphubRes.data) {
      const parsedRecords = parseWisphubMonthlyPayload(wisphubRes.data, anio, idServicio, cedula);
      if (parsedRecords.length > 0) {
        dbRecords = await upsertHistorialTrafico(parsedRecords);
        console.log(`[WispHub Sync] Guardados ${dbRecords.length} meses reales devueltos por WispHub para servicio ${idServicio}`);
      }
    } else {
      console.error(`[WispHub Trafico Error] Falló la consulta directa a WispHub para servicio ${idServicio} (HTTP ${wisphubRes.status}). Consultando registros reales almacenados.`);
    }

    // 4. Si no se obtuvieron datos directos de la llamada HTTP a WispHub, consultar registros reales existentes
    if (dbRecords.length === 0) {
      dbRecords = getHistorialTraficoByServicio(idServicio, anio, cedula);
    }

    // 5. Revisar caché local (traffic-cache.json) si aún no hay registros
    const trafficCacheRecord = getFullTrafficRecord(idServicio);
    if (dbRecords.length === 0 && trafficCacheRecord?.meses && trafficCacheRecord.meses.length > 0) {
      const recordsToUpsert = trafficCacheRecord.meses
        .filter((m) => !m.year || m.year === anio)
        .map((m) => ({
          id_servicio: idServicio,
          cedula: cedula || "",
          anio: m.year || anio,
          mes: m.mesNumero,
          mes_nombre: m.mes,
          descarga_gb: m.downloadGb,
          subida_gb: m.uploadGb,
        }));

      if (recordsToUpsert.length > 0) {
        dbRecords = await upsertHistorialTrafico(recordsToUpsert);
      }
    }

    // 6. Si NO hay datos reales, NUNCA inventar números ni usar fórmulas simuladas:
    // Imprimir el error en consola y retornar array vacío
    if (dbRecords.length === 0) {
      console.error(`[WispHub Trafico Error] No se encontraron datos de tráfico reales para id_servicio=${idServicio} (Cédula: ${cedula}). Retornando array vacío.`);
      return NextResponse.json(
        {
          success: true,
          id_servicio: idServicio,
          cedula,
          anio,
          cliente: {
            nombre: clientDetail?.usuario_rb || clientDetail?.nombre || `Servicio ${idServicio}`,
            ip: clientDetail?.ip || "",
            estado: clientDetail?.estado || "Activo",
            plan: clientDetail?.plan_internet?.nombre || "",
          },
          meses: [],
          ultimos7Dias: [],
          cicloActual: { totalGb: 0, downloadGb: 0, uploadGb: 0, mes: "Septiembre", anio },
          hasData: false,
          origen: "wisphub_api",
        },
        { status: 200 }
      );
    }

    // 7. Mapeo estricto de meses:
    // - Ene = 1, Feb = 2, ..., Sep = 9
    // - Los meses que aún no han ocurrido (Octubre, Noviembre, Diciembre) DEBEN quedar en 0 GiB (sin barra)
    const currentMonthNum = new Date().getMonth() + 1; // 1 = Ene, 9 = Sep, etc.

    const dbRecordMap = new Map<number, HistorialTraficoClienteRecord>();
    dbRecords.forEach((r) => dbRecordMap.set(Number(r.mes), r));

    const meses = MESES_CORTOS.map((nombreMes, idx) => {
      const mesNum = idx + 1;

      // Si el mes aún no ha ocurrido, DEBE ser estrictamente 0 GiB
      if (mesNum > currentMonthNum) {
        return {
          mes: nombreMes,
          mes_nombre: MESES_LARGOS[idx],
          mes_numero: mesNum,
          anio,
          descarga_gb: 0,
          subida_gb: 0,
          total_gb: 0,
          descarga_gib: 0,
          subida_gib: 0,
          hasData: false,
        };
      }

      const rec = dbRecordMap.get(mesNum);
      const dl = rec ? Number(rec.descarga_gb || 0) : 0;
      const ul = rec ? Number(rec.subida_gb || 0) : 0;
      const tot = Number((dl + ul).toFixed(2));
      const hasData = dl > 0 || ul > 0;

      return {
        mes: nombreMes,
        mes_nombre: MESES_LARGOS[idx],
        mes_numero: mesNum,
        anio,
        descarga_gb: dl,
        subida_gb: ul,
        total_gb: tot,
        descarga_gib: dl, // alias GiB
        subida_gib: ul,   // alias GiB
        hasData,
      };
    });

    const hasData = meses.some((m) => m.hasData);

    // 8. Desglose de últimos 7 días
    const ultimos7Dias = (trafficCacheRecord?.dias || []).map((d) => ({
      fecha: d.fecha,
      downloadGb: d.downloadGb,
      uploadGb: d.uploadGb,
      totalGb: Number((d.downloadGb + d.uploadGb).toFixed(2)),
      hasData: d.downloadGb > 0 || d.uploadGb > 0,
    }));

    // 9. Desglose del mes actual (Septiembre u otro)
    const currentMonthRecord = meses[currentMonthNum - 1];
    const cicloActual = {
      totalGb: currentMonthRecord?.total_gb || 0,
      downloadGb: currentMonthRecord?.descarga_gb || 0,
      uploadGb: currentMonthRecord?.subida_gb || 0,
      mes: currentMonthRecord?.mes_nombre || "Septiembre",
      anio,
    };

    return NextResponse.json(
      {
        success: true,
        id_servicio: idServicio,
        cedula,
        anio,
        cliente: {
          nombre: clientDetail?.usuario_rb || clientDetail?.nombre || `Servicio ${idServicio}`,
          ip: clientDetail?.ip || "",
          estado: clientDetail?.estado || "Activo",
          plan: clientDetail?.plan_internet?.nombre || "",
        },
        meses,
        ultimos7Dias,
        cicloActual,
        hasData,
        origen: "wisphub_api",
        synced_at: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("[API Sincronizar Historial Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al sincronizar historial de tráfico de WispHub",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Soporte para carga masiva (Batch de clientes)
    const clientList = Array.isArray(body)
      ? body
      : Array.isArray(body.batch)
      ? body.batch
      : Array.isArray(body.clientes)
      ? body.clientes
      : null;

    if (clientList && clientList.length > 0) {
      const recordsToUpsert: any[] = [];
      const currentYear = new Date().getFullYear();

      for (const item of clientList) {
        const idServicio = item.id_servicio || item.id || item.servicio;
        const cedula = item.cedula || item.documento || "";
        const anio = Number(item.anio || item.year || currentYear);

        if (!idServicio && !cedula) continue;

        if (Array.isArray(item.meses) && item.meses.length > 0) {
          for (const m of item.meses) {
            const mesNum = Number(m.mes_numero || m.mesNumero || m.mes);
            recordsToUpsert.push({
              id_servicio: String(idServicio || cedula),
              cedula: String(cedula),
              anio: Number(m.anio || anio),
              mes: mesNum,
              mes_nombre: m.mes || MESES_CORTOS[mesNum - 1] || "",
              descarga_gb: Number(m.descarga_gb || m.downloadGb || m.descarga_gib || 0),
              subida_gb: Number(m.subida_gb || m.uploadGb || m.subida_gib || 0),
            });
          }
        } else if (item.mes || item.mes_numero) {
          const mesNum = Number(item.mes_numero || item.mes);
          recordsToUpsert.push({
            id_servicio: String(idServicio || cedula),
            cedula: String(cedula),
            anio,
            mes: mesNum,
            mes_nombre: item.mes_nombre || MESES_CORTOS[mesNum - 1] || "",
            descarga_gb: Number(item.descarga_gb || item.downloadGb || item.descarga_gib || 0),
            subida_gb: Number(item.subida_gb || item.uploadGb || item.subida_gib || 0),
          });
        }
      }

      if (recordsToUpsert.length > 0) {
        const saved = await upsertHistorialTrafico(recordsToUpsert);
        return NextResponse.json({
          success: true,
          savedCount: saved.length,
          clientsCount: clientList.length,
          message: `Se sincronizaron exitosamente ${recordsToUpsert.length} registros para ${clientList.length} clientes en base de datos.`,
        });
      }
    }

    // Flujo para un cliente individual
    const idServicio = body.id_servicio || body.id;
    const cedula = body.cedula;
    const anio = body.anio || new Date().getFullYear();
    const mesesPayload = body.meses;

    if (!idServicio && !cedula) {
      return NextResponse.json(
        { success: false, error: "Debe especificar 'id_servicio' o 'cedula'" },
        { status: 400 }
      );
    }

    if (Array.isArray(mesesPayload) && mesesPayload.length > 0) {
      const recordsToUpsert = mesesPayload.map((m: any) => ({
        id_servicio: String(idServicio || cedula),
        cedula: String(cedula || ""),
        anio: Number(m.anio || anio),
        mes: Number(m.mes_numero || m.mesNumero || m.mes),
        mes_nombre: m.mes || MESES_CORTOS[(Number(m.mes_numero || m.mes) - 1)] || "",
        descarga_gb: Number(m.descarga_gb || m.downloadGb || 0),
        subida_gb: Number(m.subida_gb || m.uploadGb || 0),
      }));

      const saved = await upsertHistorialTrafico(recordsToUpsert);

      return NextResponse.json({
        success: true,
        savedCount: saved.length,
        message: "Historial de tráfico guardado exitosamente en base de datos",
      });
    }

    return GET(req);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error procesando POST de historial de tráfico" },
      { status: 500 }
    );
  }
}
