import { NextRequest, NextResponse } from "next/server";
import {
  upsertHistorialTrafico,
  getHistorialTraficoByServicio,
  HistorialTraficoClienteRecord,
} from "@/lib/db-historial-trafico";
import { getFullTrafficRecord, setTrafficCache } from "@/lib/traffic-cache";
import { getWisphubClientDetail, searchWisphubClient } from "@/lib/wisphub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_LARGOS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * Consulta a la API de WispHub los datos reales del servicio del cliente
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
      return NextResponse.json(
        { success: false, error: "No se encontró el id_servicio para el cliente solicitado" },
        { status: 404 }
      );
    }

    // 2. Consultar detalle del cliente en WispHub con API Key
    if (!clientDetail) {
      clientDetail = await fetchWisphubServiceRaw(idServicio);
    }

    if (!cedula && clientDetail?.cedula) {
      cedula = String(clientDetail.cedula).trim();
    }

    // 3. Revisar si hay registros en la base de datos (historial_trafico_cliente)
    let dbRecords = getHistorialTraficoByServicio(idServicio, anio, cedula);

    // 4. Revisar si hay registros en la caché de tráfico local (traffic-cache.json)
    const trafficCacheRecord = getFullTrafficRecord(idServicio);

    // 5. Si la base de datos aún no tiene registros para este año pero el caché sí, sincronizarlos con upsert
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
        console.log(`[WispHub Sync] Sincronizados ${dbRecords.length} meses en base de datos para servicio ${idServicio}`);
      }
    }

    // 6. Construir el arreglo completo de los 12 meses del año
    const dbRecordMap = new Map<number, HistorialTraficoClienteRecord>();
    dbRecords.forEach((r) => dbRecordMap.set(Number(r.mes), r));

    const meses = MESES_CORTOS.map((nombreMes, idx) => {
      const mesNum = idx + 1;
      const rec = dbRecordMap.get(mesNum);
      const dl = rec ? Number(rec.descarga_gb) : 0;
      const ul = rec ? Number(rec.subida_gb) : 0;
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

    // 7. Desglose de últimos 7 días
    const ultimos7Dias = (trafficCacheRecord?.dias || []).map((d) => ({
      fecha: d.fecha,
      downloadGb: d.downloadGb,
      uploadGb: d.uploadGb,
      totalGb: Number((d.downloadGb + d.uploadGb).toFixed(2)),
      hasData: d.downloadGb > 0 || d.uploadGb > 0,
    }));

    // 8. Desglose del mes actual (Septiembre u otro)
    const currentMonthIdx = new Date().getMonth();
    const currentMonthRecord = meses[currentMonthIdx];

    const cicloActual = {
      totalGb: currentMonthRecord?.total_gb || 0,
      downloadGb: currentMonthRecord?.descarga_gb || 0,
      uploadGb: currentMonthRecord?.subida_gb || 0,
      mes: currentMonthRecord?.mes_nombre || "",
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
        origen: dbRecords.length > 0 ? "database_historial_trafico_cliente" : "wisphub_api",
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
