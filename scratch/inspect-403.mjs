const apiKey = "KEZ5sFh7.ZPSv7WRxNHCw4I32lN2BLWIK0yaQxjAC";
const idServicio = "904";

async function inspect403() {
  const url = `https://wisphub.net/api/trafico/semana/servicio/${idServicio}/`;
  const res = await fetch(url, {
    headers: {
      "Authorization": `Api-Key ${apiKey}`,
      "Api-Key": apiKey,
      "Accept": "application/json",
    },
  });
  console.log("Status:", res.status);
  console.log("Headers:", Object.fromEntries(res.headers.entries()));
  const text = await res.text();
  console.log("Body:", text.slice(0, 500));
}

inspect403();
