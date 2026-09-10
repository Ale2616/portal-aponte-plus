/**
 * Test de Verificación de Caché Multi-Nivel, SWR y Rendimiento (< 50ms)
 */
const http = require('http');

async function testCacheDirectly() {
  console.log("=== INICIANDO TEST DE CACHÉ Y RENDIMIENTO ===");

  // Simular lectura HTTP hacia el dev server
  const testUrl = "http://localhost:3000/api/cliente/consumo?id_servicio=904";

  console.log("1. Primera llamada (puede ser MISS o HIT dependiendo de ejecución previa)...");
  const t0 = Date.now();
  const res1 = await fetch(testUrl);
  const dur1 = Date.now() - t0;
  const json1 = await res1.json();
  const cacheHeader1 = res1.headers.get("x-traffic-cache");

  console.log(`- Status: ${res1.status}`);
  console.log(`- X-Traffic-Cache: ${cacheHeader1}`);
  console.log(`- Duración petición 1: ${dur1}ms`);
  console.log(`- Cached?: ${json1._trafficCached}, Stale?: ${json1._trafficStale}`);

  console.log("\n2. Segunda llamada inmediata (debe ser HIT y responder en < 50ms)...");
  const t1 = Date.now();
  const res2 = await fetch(testUrl);
  const dur2 = Date.now() - t1;
  const json2 = await res2.json();
  const cacheHeader2 = res2.headers.get("x-traffic-cache");

  console.log(`- Status: ${res2.status}`);
  console.log(`- X-Traffic-Cache: ${cacheHeader2}`);
  console.log(`- Duración petición 2: ${dur2}ms`);
  console.log(`- Cached?: ${json2._trafficCached}`);
  console.log(`- ¿Cumple < 50ms?: ${dur2 < 50 ? "✅ SÍ (" + dur2 + "ms)" : "⚠️ " + dur2 + "ms"}`);

  console.log("\n3. Verificando seguridad del CRON endpoint (/api/cron/sync-trafico)...");
  const cronUnauthorized = await fetch("http://localhost:3000/api/cron/sync-trafico");
  console.log(`- Petición sin token -> Status: ${cronUnauthorized.status} (esperado: 401)`);
  if (cronUnauthorized.status === 401) {
    console.log("  ✅ Rechazo correcto de peticiones no autorizadas al CRON.");
  } else {
    console.log("  ⚠️ Estado inesperado:", cronUnauthorized.status);
  }

  const cronAuthorized = await fetch("http://localhost:3000/api/cron/sync-trafico?limit=2", {
    headers: {
      Authorization: "Bearer aponte_cron_sync_secret_2026"
    }
  });
  console.log(`- Petición con Bearer Token -> Status: ${cronAuthorized.status}`);
  const cronJson = await cronAuthorized.json();
  console.log("  Reporte CRON:", JSON.stringify(cronJson.report || cronJson, null, 2));

  console.log("\n=== TEST COMPLETADO ===");
}

testCacheDirectly().catch(console.error);
