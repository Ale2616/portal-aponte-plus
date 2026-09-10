const fs = require('fs');
const path = require('path');

// Probar directamente el almacenamiento en archivo / memoria
async function testUnitCache() {
  console.log("=== TEST UNITARIO DE CACHÉ Y VELOCIDAD ===");

  const dataDir = path.join(process.cwd(), 'data');
  const cacheFile = path.join(dataDir, 'traffic-cache.json');

  // Insertar un registro ficticio en la caché de disco
  const mockDays = [
    { fecha: "2026-09-09", downloadGb: 2.5, uploadGb: 0.8 },
    { fecha: "2026-09-08", downloadGb: 3.1, uploadGb: 1.1 }
  ];

  const current = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  current["904"] = {
    serviceId: "904",
    dias: mockDays,
    cachedAt: Date.now(), // Fresco ahora mismo
    version: 1
  };

  fs.writeFileSync(cacheFile, JSON.stringify(current, null, 2), 'utf8');
  console.log("✅ Registro de prueba guardado en", cacheFile);

  // Ahora hacer petición HTTP al endpoint de consumo
  const testUrl = "http://localhost:3000/api/cliente/consumo?id_servicio=904";
  console.log("\nConsultando /api/cliente/consumo?id_servicio=904...");

  const t0 = Date.now();
  const res = await fetch(testUrl);
  const dur = Date.now() - t0;
  const json = await res.json();
  const header = res.headers.get("x-traffic-cache");

  console.log(`- Status HTTP: ${res.status}`);
  console.log(`- Header X-Traffic-Cache: ${header}`);
  console.log(`- Cached?: ${json._trafficCached}`);
  console.log(`- Cache Status: ${json._cacheStatus}`);
  console.log(`- Duración total red (TCP + HTTP): ${dur}ms`);
  console.log(`- Tiempo de proceso servidor (X-Response-Time-Ms): ${res.headers.get("x-response-time-ms")}ms`);
  console.log(`- Días obtenidos de caché: ${json.consumo?.dias?.length || 0}`);
  console.log(`- ¿Cumple < 50ms en servidor?: ${parseInt(res.headers.get("x-response-time-ms") || "99") < 50 ? "✅ SÍ" : "⚠️ NO"}`);

  // Probar una segunda llamada que ahora estará en L1 RAM
  console.log("\nSegunda consulta inmediata (Nivel L1 RAM)...");
  const t1 = Date.now();
  const res2 = await fetch(testUrl);
  const dur2 = Date.now() - t1;
  const json2 = await res2.json();
  const header2 = res2.headers.get("x-traffic-cache");

  console.log(`- Status HTTP: ${res2.status}`);
  console.log(`- Header X-Traffic-Cache: ${header2}`);
  console.log(`- Duración total red: ${dur2}ms`);
  console.log(`- Tiempo de proceso servidor (L1 RAM): ${res2.headers.get("x-response-time-ms")}ms`);
  console.log(`- ¿Cumple < 50ms en servidor?: ${parseInt(res2.headers.get("x-response-time-ms") || "99") < 50 ? "✅ SÍ" : "⚠️ NO"}`);

  // Probar dato STALE (crear registro con 10 horas de antigüedad)
  console.log("\nSimulando dato STALE (10 horas de antigüedad) para probar SWR...");
  current["905"] = {
    serviceId: "905",
    dias: mockDays,
    cachedAt: Date.now() - (10 * 60 * 60 * 1000), // 10 horas atrás
    version: 1
  };
  fs.writeFileSync(cacheFile, JSON.stringify(current, null, 2), 'utf8');

  const staleUrl = "http://localhost:3000/api/cliente/consumo?id_servicio=905";
  const t2 = Date.now();
  const res3 = await fetch(staleUrl);
  const dur3 = Date.now() - t2;
  const json3 = await res3.json();
  const header3 = res3.headers.get("x-traffic-cache");

  console.log(`- Status HTTP: ${res3.status}`);
  console.log(`- Header X-Traffic-Cache: ${header3}`);
  console.log(`- Stale?: ${json3._trafficStale}`);
  console.log(`- Cache Status: ${json3._cacheStatus}`);
  console.log(`- Duración SWR: ${dur3}ms`);
  console.log(`- ¿Cumple < 50ms?: ${dur3 < 50 ? "✅ SÍ (" + dur3 + "ms)" : "⚠️ " + dur3 + "ms"}`);
}

testUnitCache().catch(console.error);
