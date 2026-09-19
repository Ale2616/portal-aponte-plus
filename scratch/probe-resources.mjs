const apiKey = "KEZ5sFh7.ZPSv7WRxNHCw4I32lN2BLWIK0yaQxjAC";

async function probeList() {
  const words = [
    "routers",
    "planes",
    "zonas",
    "servicios",
    "articulos",
    "pagos",
    "cajas",
    "tickets",
    "instalaciones",
    "promociones",
    "trafico-flow",
    "trafico_flow",
    "traffic-flow",
    "bandwidth",
    "consumos",
  ];

  for (const w of words) {
    try {
      const res = await fetch(`https://api.wisphub.net/api/${w}/`, {
        headers: {
          Authorization: `Api-Key ${apiKey}`,
          Accept: "application/json",
        },
      });
      console.log(`[${res.status}] /api/${w}/`);
      if (res.ok) {
        const d = await res.json();
        console.log(`  -> count:`, d.count ?? d.length);
      }
    } catch (e) {}
  }
}

probeList();
