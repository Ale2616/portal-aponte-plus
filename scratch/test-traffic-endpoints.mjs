const apiKey = "KEZ5sFh7.ZPSv7WRxNHCw4I32lN2BLWIK0yaQxjAC";
const idServicio = "904";

const hosts = [
  "https://api.wisphub.net",
  "https://wisphub.net",
];

const paths = [
  // Tráfico semana / mes / año
  `/api/trafico/semana/servicio/${idServicio}/`,
  `/api/trafico/mes/servicio/${idServicio}/`,
  `/api/trafico/ano/servicio/${idServicio}/`,
  `/api/trafico/año/servicio/${idServicio}/`,
  `/api/trafico/hoy/servicio/${idServicio}/`,
  `/api/trafico/24horas/servicio/${idServicio}/`,
  `/api/trafico/servicio/${idServicio}/`,
  `/api/trafico/cliente/${idServicio}/`,
  `/api/trafico/${idServicio}/`,
  `/api/trafico/?id_servicio=${idServicio}`,
  `/api/trafico/?servicio=${idServicio}`,
  `/api/trafico/`,
  // Clientes tráfico
  `/api/clientes/${idServicio}/trafico/`,
  `/api/clientes/${idServicio}/consumo/`,
  `/api/clientes/${idServicio}/estadisticas/`,
  // Servicios tráfico
  `/api/servicios/${idServicio}/trafico/`,
  `/api/servicios/${idServicio}/consumo/`,
  // Web routes with Api-Key
  `/trafico/servicio/${idServicio}/`,
  `/trafico/cliente/${idServicio}/`,
  `/trafico/api/${idServicio}/`,
  `/trafico/consumo/${idServicio}/`,
  `/trafico/`,
];

async function run() {
  for (const host of hosts) {
    console.log(`\n================ Testing host: ${host} ================`);
    for (const p of paths) {
      const url = `${host}${p}`;
      try {
        const res = await fetch(url, {
          headers: {
            "Authorization": `Api-Key ${apiKey}`,
            "Api-Key": apiKey,
            "Accept": "application/json",
          },
        });
        if (res.status !== 404 && res.status !== 403 && res.status !== 301 && res.status !== 302) {
          console.log(`[${res.status}] ${url}`);
          const text = await res.text();
          console.log(`  -> Content (${text.length} chars):`, text.slice(0, 300));
        } else if (res.status === 200) {
          console.log(`[200 OK] ${url}`);
          const text = await res.text();
          console.log(`  -> Content:`, text.slice(0, 300));
        } else if (res.status !== 404) {
          console.log(`[${res.status}] ${url}`);
        }
      } catch (err) {
        // ignore network error
      }
    }
  }
}

run();
