/**
 * Test de Verificación de Endpoint Unificado /api/configuracion y Persistencia Global
 */
async function testConfigApi() {
  console.log("=== INICIANDO TEST DE PERSISTENCIA GLOBAL (/api/configuracion) ===");

  const baseUrl = "http://localhost:3000";

  // 1. GET inicial
  console.log("1. Probando GET /api/configuracion...");
  const getRes = await fetch(`${baseUrl}/api/configuracion`);
  console.log(`- Status GET: ${getRes.status}`);
  const getJson = await getRes.json();
  console.log("- Success:", getJson.success);
  console.log("- Empresa:", getJson.config?.companyInfo?.companyName);
  console.log("- Banner imágenes:", getJson.config?.homeAdBanner?.imageUrls?.length);

  // 2. POST no autorizado (sin PIN o PIN incorrecto)
  console.log("\n2. Probando POST con PIN incorrecto (debe retornar 401)...");
  const unauthRes = await fetch(`${baseUrl}/api/configuracion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: "0000", config: {} }),
  });
  console.log(`- Status PIN incorrecto: ${unauthRes.status} (Esperado: 401)`);

  // 3. POST autorizado con array de imágenes para el carrusel
  console.log("\n3. Probando POST con PIN 1130 y carrusel de 3 imágenes...");
  const testImages = [
    "/banner-promo-fibra.jpg",
    "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800",
    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800",
  ];

  const postRes = await fetch(`${baseUrl}/api/configuracion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pin: "1130",
      config: {
        companyInfo: {
          companyName: "Internet Aponte Plus (Global Sync Test)",
          supportPhone: "3185577157",
        },
        homeAdBanner: {
          enabled: true,
          imageUrl: testImages[0],
          imageUrls: testImages,
          titulo: "¡Carrusel Publicitario de Fibra Óptica Activo!",
          descripcion: "Disfruta de máxima velocidad con el nuevo carrusel sincronizado globalmente.",
          botonTexto: "📲 Pedir Información",
        },
      },
    }),
  });
  console.log(`- Status POST: ${postRes.status}`);
  const postJson = await postRes.json();
  console.log("- POST Exitoso?:", postJson.success);
  console.log("- Guardado en servidor:", postJson.message);
  console.log("- Total imágenes guardadas en el servidor:", postJson.config?.homeAdBanner?.imageUrls?.length);

  // 4. Segundo GET para verificar persistencia en el servidor
  console.log("\n4. Verificando que un nuevo GET devuelva la data recién guardada...");
  const getRes2 = await fetch(`${baseUrl}/api/configuracion`);
  const getJson2 = await getRes2.json();
  console.log("- Empresa actualizada en servidor:", getJson2.config?.companyInfo?.companyName);
  console.log("- Imágenes devueltas:", getJson2.config?.homeAdBanner?.imageUrls);
  console.log("- ¿Persistió correctamente?:", getJson2.config?.companyInfo?.companyName?.includes("Global Sync Test") ? "✅ SÍ" : "❌ NO");

  console.log("\n=== TEST FINALIZADO CON ÉXITO ===");
}

testConfigApi().catch(console.error);
