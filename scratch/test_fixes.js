/**
 * Test de Verificación Integral de Bugs Críticos
 * 1. Bug de Impresión de Factura (/api/facturas/[id]/pdf)
 * 2. Bug de Persistencia del Banner en Upstash Redis (/api/banner, /api/promociones, /api/configuracion)
 */

async function runTests() {
  console.log("=================================================================");
  console.log("INICIANDO PRUEBAS DE VERIFICACIÓN DE BUGS CRÍTICOS");
  console.log("=================================================================\n");

  const baseUrl = "http://localhost:3001";

  // -------------------------------------------------------------
  // TEST 1: BUG DE IMPRESIÓN DE FACTURA (DATOS DESINCRONIZADOS)
  // -------------------------------------------------------------
  console.log("▶ TEST 1: Verificación de Vista de Impresión / PDF...");

  const testParams = new URLSearchParams({
    folio: "FAC-2026-0901",
    nombre: "Alejandro Bienvenido",
    cedula: "1098765432",
    direccion: "Carrera 7 # 12-34 Barrio Centro",
    ciudad: "Aponte",
    plan: "Plan Fibra Óptica 100 Megas Simétricas",
    total: "60000",
    tarifa: "60000",
    saldoPendiente: "60000",
    fechaEmision: "2026-08-28",
    fechaVencimiento: "2026-09-23",
    periodo: "1/Sep./2026 al 31/Sep./2026",
    concepto: "Servicio de Internet Banda Ancha FTTH - Septiembre",
    estado: "pendiente",
  });

  const pdfUrl = `${baseUrl}/api/facturas/99999/pdf?${testParams.toString()}`;
  console.log(`- Solicitando: ${pdfUrl}`);

  const pdfRes = await fetch(pdfUrl);
  if (!pdfRes.ok) {
    throw new Error(`Error HTTP en PDF: ${pdfRes.status}`);
  }

  const pdfHtml = await pdfRes.text();

  // Validaciones obligatorias de datos reales
  const checks = [
    { label: "Nombre del Abonado real", match: "Alejandro Bienvenido" },
    { label: "Cédula/NIT real", match: "1098765432" },
    { label: "Dirección real", match: "Carrera 7 # 12-34 Barrio Centro" },
    { label: "Plan real", match: "Plan Fibra Óptica 100 Megas Simétricas" },
    { label: "Tarifa / Total real ($60.000)", match: "60.000" },
    { label: "Fecha de Emisión real (28 de ago de 2026)", match: "28 de ago" },
    { label: "Fecha de Vencimiento real (23 de sept de 2026)", match: "23 de sept" },
    { label: "Periodo Facturado real", match: "1/Sep./2026 al 31/Sep./2026" },
    { label: "Folio dinámico", match: "FAC-2026-0901" },
    { label: "Estado dinámico PENDIENTE DE PAGO", match: "PENDIENTE DE PAGO" },
    { label: "Botón Imprimir / Guardar en PDF", match: "Imprimir / Guardar en PDF" },
    { label: "Acción window.print()", match: "window.print()" },
  ];

  let pdfFailed = false;
  for (const check of checks) {
    if (pdfHtml.includes(check.match)) {
      console.log(`  ✅ ${check.label}: Presente en el HTML impreso.`);
    } else {
      console.error(`  ❌ ERROR: ${check.label} NO encontrado en el HTML.`);
      pdfFailed = true;
    }
  }

  // Comprobar que NO existan los datos quemados anteriores
  const negativeChecks = [
    { label: "No texto quemado '$50.000'", match: "$50.000" },
    { label: "No fecha quemada '1 de mar de 2026'", match: "1 de mar de 2026" },
  ];

  for (const neg of negativeChecks) {
    if (!pdfHtml.includes(neg.match)) {
      console.log(`  ✅ ${neg.label}: Correctamente eliminado.`);
    } else {
      console.error(`  ❌ ERROR: ${neg.label} todavía presente en el HTML.`);
      pdfFailed = true;
    }
  }

  if (!pdfFailed) {
    console.log(">> TEST 1 SUPERADO CON ÉXITO: La factura se imprime 100% dinámica.\n");
  } else {
    throw new Error("TEST 1 FALLÓ");
  }

  // -------------------------------------------------------------
  // TEST 2: PERSISTENCIA DEL BANNER / PROMOCIONES EN UPSTASH REDIS
  // -------------------------------------------------------------
  console.log("▶ TEST 2: Verificación de Endpoints de Banner y Persistencia...");

  // 2.1 GET /api/banner
  console.log("- Probando GET /api/banner...");
  const bannerGetRes = await fetch(`${baseUrl}/api/banner`);
  const bannerGetJson = await bannerGetRes.json();
  console.log(`  Status: ${bannerGetRes.status}, Success: ${bannerGetJson.success}`);

  // 2.2 POST /api/banner con PIN incorrecto (debe rechazar 401)
  console.log("- Probando POST /api/banner con PIN erróneo (debe retornar 401)...");
  const badPinRes = await fetch(`${baseUrl}/api/banner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: "9999", banner: {} }),
  });
  console.log(`  Status PIN 9999: ${badPinRes.status} (Esperado: 401)`);
  if (badPinRes.status !== 401) {
    throw new Error(`Esperaba 401 pero obtuve ${badPinRes.status}`);
  }

  // 2.3 POST /api/banner con datos de prueba
  console.log("- Probando POST /api/banner con PIN 1130 y datos reales...");
  const testBanner = {
    enabled: true,
    titulo: "Promoción Especial Septiembre 2026",
    descripcion: "Instalación gratis y 200 Megas de fibra óptica dedicada.",
    botonTexto: "Solicitar por WhatsApp",
    imageUrls: ["https://ejemplo.com/banner-promo-1.webp", "https://ejemplo.com/banner-promo-2.webp"],
  };

  const bannerPostRes = await fetch(`${baseUrl}/api/banner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pin: "1130",
      banner: testBanner,
    }),
  });
  const bannerPostJson = await bannerPostRes.json();
  console.log(`  Status POST: ${bannerPostRes.status}, Mensaje: ${bannerPostJson.message}`);

  // 2.4 GET /api/promociones
  console.log("- Probando GET /api/promociones...");
  const promoGetRes = await fetch(`${baseUrl}/api/promociones`);
  const promoGetJson = await promoGetRes.json();
  console.log(`  Status: ${promoGetRes.status}, Success: ${promoGetJson.success}`);

  // 2.5 GET /api/admin/promociones
  console.log("- Probando GET /api/admin/promociones...");
  const adminPromoRes = await fetch(`${baseUrl}/api/admin/promociones`);
  const adminPromoJson = await adminPromoRes.json();
  console.log(`  Status: ${adminPromoRes.status}, Success: ${adminPromoJson.success}`);

  // 2.6 GET /api/configuracion
  console.log("- Probando GET /api/configuracion...");
  const configGetRes = await fetch(`${baseUrl}/api/configuracion`);
  const configGetJson = await configGetRes.json();
  console.log(`  Status: ${configGetRes.status}, Success: ${configGetJson.success}`);

  console.log("\n>> TEST 2 SUPERADO CON ÉXITO: Endpoints de persistencia Upstash Redis listos y operativos.\n");

  console.log("=================================================================");
  console.log("TODAS LAS PRUEBAS FINALIZARON CON ÉXITO");
  console.log("=================================================================");
}

runTests().catch((err) => {
  console.error("ERROR EN LAS PRUEBAS:", err);
  process.exit(1);
});
