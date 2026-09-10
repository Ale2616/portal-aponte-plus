import { NextRequest, NextResponse } from "next/server";
import { batchScrapeTraffic, getTrafficCacheStats } from "@/lib/wisphub-scraper";
import { fetchWisphub } from "@/lib/wisphub";

/**
 * CRON Job: Sincronización Proactiva de Tráfico WispHub
 *
 * Endpoint: GET /api/cron/sync-trafico
 * Configurado en vercel.json para ejecutarse 2 veces al día.
 *
 * Protección:
 *  - Valida el token Bearer mediante variable de entorno CRON_SECRET.
 *  - En producción, Vercel envía automáticamente `Authorization: Bearer <CRON_SECRET>`.
 *
 * Protección anti-baneo:
 *  - Itera secuencialmente sobre los servicios.
 *  - Pausa de 800ms entre clientes (simula comportamiento humano).
 *  - Si un cliente ya tiene caché fresco (< 6h), se salta sin tocar WispHub.
 *  - Si WispHub responde con error, activa una pausa de seguridad de 5.000ms.
 */

// Aumentar el tiempo límite de ejecución para Lambdas de Vercel (máx 60s en plan Hobby, 300s en Pro)
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleSync(req);
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}

async function handleSync(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  // Validación de seguridad Bearer Token
  if (cronSecret && cronSecret.trim() !== "") {
    const expectedAuth = `Bearer ${cronSecret.trim()}`;
    const querySecret = new URL(req.url).searchParams.get("secret");

    const isAuthorized =
      authHeader === expectedAuth || querySecret === cronSecret.trim();

    if (!isAuthorized) {
      console.warn("[CRON Sync] Petición rechazada: Token CRON_SECRET no autorizado.");
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado. Proporcione una cabecera 'Authorization: Bearer <CRON_SECRET>' válida.",
        },
        { status: 401 }
      );
    }
  }

  console.log("[CRON Sync] Iniciando ciclo de sincronización de tráfico...");

  try {
    const { searchParams } = new URL(req.url);
    const customIds = searchParams.get("ids");
    const limitParam = searchParams.get("limit");
    const maxServices = limitParam ? parseInt(limitParam, 10) : 50;

    const serviceIdsToSync: string[] = [];

    // 1. Si el usuario pasó IDs explícitos en la URL (ej. ?ids=904,905)
    if (customIds) {
      const parsed = customIds.split(",").map((s) => s.trim()).filter(Boolean);
      serviceIdsToSync.push(...parsed);
    }

    // 2. Si no hay IDs explícitos, consultar servicios activos vía WispHub API
    if (serviceIdsToSync.length === 0) {
      try {
        const apiKey = process.env.WISPHUB_API_KEY;
        if (apiKey) {
          // Consultar los primeros clientes activos desde la API oficial
          const clientsData = await fetchWisphub<any>(`/api/clientes/?limit=${maxServices}`);
          const results = Array.isArray(clientsData?.results)
            ? clientsData.results
            : Array.isArray(clientsData)
            ? clientsData
            : [];

          for (const c of results) {
            const sid = String(c.id_servicio || c.id || "").trim();
            if (sid && !serviceIdsToSync.includes(sid)) {
              serviceIdsToSync.push(sid);
            }
          }
          console.log(`[CRON Sync] Obtenidos ${serviceIdsToSync.length} clientes desde API WispHub.`);
        }
      } catch (err: any) {
        console.warn("[CRON Sync] No se pudieron obtener clientes de la API REST:", err.message);
      }
    }

    // 3. Fallback: Si la API de clientes no retornó IDs, usar demo/conocidos
    if (serviceIdsToSync.length === 0) {
      serviceIdsToSync.push("904"); // ID principal de prueba mencionado por el stakeholder
    }

    // Ejecutar el batch secuencial con pausas
    const batchResult = await batchScrapeTraffic(serviceIdsToSync, {
      sleepBetweenMs: 800,
      backoffOnErrorMs: 5000,
      maxServices,
    });

    const cacheStats = getTrafficCacheStats();

    console.log(
      `[CRON Sync] Finalizado: ${batchResult.refreshed} actualizados, ${batchResult.skippedFresh} saltados (frescos), ${batchResult.failed} fallidos en ${(batchResult.durationMs / 1000).toFixed(1)}s`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      report: {
        totalEvaluated: batchResult.total,
        refreshed: batchResult.refreshed,
        skippedFresh: batchResult.skippedFresh,
        failed: batchResult.failed,
        durationSeconds: Number((batchResult.durationMs / 1000).toFixed(2)),
        errors: batchResult.errors.slice(0, 10), // Truncar para no inflar respuesta
      },
      cacheStats,
    });
  } catch (error: any) {
    console.error("[CRON Sync Error Crítico]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error interno durante la ejecución del CRON.",
      },
      { status: 500 }
    );
  }
}
