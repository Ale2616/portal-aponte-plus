const apiKey = "KEZ5sFh7.ZPSv7WRxNHCw4I32lN2BLWIK0yaQxjAC";
const idServicio = "904";

const words = [
  "trafico",
  "traffic",
  "consumo",
  "flow",
  "traffic-flow",
  "accounting",
  "estadisticas",
  "historial",
  "reportes",
  "grafica",
  "graficas",
  "monitoreo",
  "bandwidth",
  "ancho-banda",
  "netflow",
];

async function checkAll() {
  const eps = [];
  for (const w of words) {
    eps.push(`/api/${w}/`);
    eps.push(`/api/${w}/${idServicio}/`);
    eps.push(`/api/${w}/servicio/${idServicio}/`);
    eps.push(`/api/${w}/cliente/${idServicio}/`);
    eps.push(`/api/${w}/ano/${idServicio}/`);
    eps.push(`/api/${w}/mes/${idServicio}/`);
    eps.push(`/api/${w}/semana/${idServicio}/`);
    eps.push(`/api/clientes/${idServicio}/${w}/`);
    eps.push(`/api/servicios/${idServicio}/${w}/`);
  }

  for (const ep of eps) {
    const url = `https://api.wisphub.net${ep}`;
    try {
      const res = await fetch(url, {
        headers: {
          "Authorization": `Api-Key ${apiKey}`,
          "Accept": "application/json",
        },
      });
      if (res.status !== 404) {
        console.log(`[${res.status}] ${url}`);
        const text = await res.text();
        console.log(`  -> ${text.slice(0, 200)}`);
      }
    } catch (e) {}
  }
}

checkAll();
