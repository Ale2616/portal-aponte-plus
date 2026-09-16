import { NextRequest, NextResponse } from "next/server";
import { scrapeTrafficWeek } from "@/lib/wisphub-scraper";
import {
  searchWisphubClient,
  getWisphubClientDetail,
  calculateServiceUsage,
} from "@/lib/wisphub";

interface ClientMetaCache {
  data: any;
  cachedAt: number;
}
const clientMetaCache = new Map<string, ClientMetaCache>();
const CLIENT_META_TTL_MS = 60 * 60 * 1000; // 1 hora

async function getCachedClientDetail(serviceId: string, maxWaitMs = 35): Promise<any | null> {
  const cached = clientMetaCache.get(serviceId);
  if (cached && Date.now() - cached.cachedAt < CLIENT_META_TTL_MS) {
    return cached.data;
  }

  // Tarea en segundo plano para poblar la caché si no existe
  const fetchPromise = getWisphubClientDetail(serviceId)
    .then((fresh) => {
      if (fresh) {
        clientMetaCache.set(serviceId, { data: fresh, cachedAt: Date.now() });
      }
      return fresh;
    })
    .catch(() => cached?.data || null);

  // Si ya tenemos dato previo (aunque viejo), usarlo inmediatamente
  if (cached) return cached.data;

  // Carrera con timeout de maxWaitMs para no violar el SLA de < 50ms
  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), maxWaitMs)
  );

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  return result || { id_servicio: serviceId };
}

export async function GET(req: NextRequest) {
  const reqStart = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const idServicio = searchParams.get("id_servicio") || searchParams.get("id");
    const cedula = searchParams.get("cedula") || searchParams.get("documento");

    if (!idServicio && !cedula) {
      return NextResponse.json(
        {
          success: false,
          error: "Debe proporcionar el 'id_servicio' o el número de 'cedula' del cliente.",
        },
        { status: 400 }
      );
    }

    // Resolver el id_servicio si solo tenemos cédula
    let resolvedServiceId = idServicio ? String(idServicio).trim() : "";
    let clientRaw: any = null;

    if (cedula && !resolvedServiceId) {
      try {
        clientRaw = await searchWisphubClient(cedula);
        if (clientRaw) {
          resolvedServiceId = String(clientRaw.id_servicio || clientRaw.id || "");
        }
      } catch {}
    }

    if (!resolvedServiceId) {
      return NextResponse.json(
        { success: false, error: "No se encontró el servicio del cliente." },
        { status: 404 }
      );
    }

    // 1. Obtener datos de tráfico mediante scraper con Caché Multi-Tier + SWR
    const trafficResult = await scrapeTrafficWeek(resolvedServiceId);

    // 2. Metadatos del cliente (usando caché ligero para asegurar respuesta < 50ms)
    if (!clientRaw) {
      clientRaw = await getCachedClientDetail(resolvedServiceId);
    }

    // Convertir los datos del scraper al formato esperado por calculateServiceUsage
    let trafficPayload: any = null;
    if (trafficResult.success && trafficResult.dias.length > 0) {
      trafficPayload = trafficResult.dias.map((d) => ({
        fecha: d.fecha,
        download_mib: d.downloadGb * 1024,
        upload_mib: d.uploadGb * 1024,
      }));
    }

    const rawObj = {
      ...(clientRaw || {}),
      id_servicio: resolvedServiceId,
      cedula: cedula || clientRaw?.cedula || "",
      trafico_real: trafficPayload,
    };

    const consumo = calculateServiceUsage(rawObj);
    const totalDurationMs = Date.now() - reqStart;

    const cacheHeader = trafficResult.cached
      ? trafficResult.stale
        ? "HIT-STALE"
        : "HIT-FRESH"
      : "MISS";

    const response = NextResponse.json({
      success: true,
      consumo,
      _trafficSource: trafficResult.source,
      _trafficCached: trafficResult.cached || false,
      _trafficStale: trafficResult.stale || false,
      _cacheStatus: trafficResult.cacheStatus || (trafficResult.cached ? "fresh" : "miss"),
      _responseTimeMs: totalDurationMs,
      _trafficError: trafficResult.error || null,
    });

    // Encabezados diagnósticos de rendimiento HTTP
    response.headers.set("X-Traffic-Cache", cacheHeader);
    response.headers.set("X-Response-Time-Ms", String(totalDurationMs));

    return response;
  } catch (error: any) {
    console.error("[API Consumo Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al obtener el consumo de red del cliente.",
        syncStatus: "sync_failed",
      },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  const reqStart = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const idServicio = body.id_servicio || body.id;
    const cedula = body.cedula || body.documento;

    if (!idServicio && !cedula) {
      return NextResponse.json(
        {
          success: false,
          error: "Debe proporcionar el 'id_servicio' o el número de 'cedula' del cliente.",
        },
        { status: 400 }
      );
    }

    let resolvedServiceId = idServicio ? String(idServicio).trim() : "";
    let clientRaw: any = null;

    if (cedula && !resolvedServiceId) {
      try {
        clientRaw = await searchWisphubClient(cedula);
        if (clientRaw) {
          resolvedServiceId = String(clientRaw.id_servicio || clientRaw.id || "");
        }
      } catch {}
    }

    if (!resolvedServiceId) {
      return NextResponse.json(
        { success: false, error: "No se encontró el servicio del cliente." },
        { status: 404 }
      );
    }

    const trafficResult = await scrapeTrafficWeek(resolvedServiceId);

    if (!clientRaw) {
      clientRaw = await getCachedClientDetail(resolvedServiceId);
    }

    let trafficPayload: any = null;
    if (trafficResult.success && trafficResult.dias.length > 0) {
      trafficPayload = trafficResult.dias.map((d) => ({
        fecha: d.fecha,
        download_mib: d.downloadGb * 1024,
        upload_mib: d.uploadGb * 1024,
      }));
    }

    const rawObj = {
      ...(clientRaw || {}),
      id_servicio: resolvedServiceId,
      cedula: cedula || clientRaw?.cedula || "",
      trafico_real: trafficPayload,
    };

    const consumo = calculateServiceUsage(rawObj);
    const totalDurationMs = Date.now() - reqStart;

    const cacheHeader = trafficResult.cached
      ? trafficResult.stale
        ? "HIT-STALE"
        : "HIT-FRESH"
      : "MISS";

    const response = NextResponse.json({
      success: true,
      consumo,
      _trafficSource: trafficResult.source,
      _trafficCached: trafficResult.cached || false,
      _trafficStale: trafficResult.stale || false,
      _cacheStatus: trafficResult.cacheStatus || (trafficResult.cached ? "fresh" : "miss"),
      _responseTimeMs: totalDurationMs,
      _trafficError: trafficResult.error || null,
    });

    response.headers.set("X-Traffic-Cache", cacheHeader);
    response.headers.set("X-Response-Time-Ms", String(totalDurationMs));

    return response;
  } catch (error: any) {
    console.error("[API Consumo POST Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al obtener el consumo de red del cliente.",
        syncStatus: "sync_failed",
      },
      { status: 503 }
    );
  }
}
