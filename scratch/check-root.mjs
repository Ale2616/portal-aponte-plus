const apiKey = "KEZ5sFh7.ZPSv7WRxNHCw4I32lN2BLWIK0yaQxjAC";

async function checkApiRoot() {
  const res = await fetch("https://api.wisphub.net/api/", {
    method: "GET",
    headers: {
      "Authorization": `Api-Key ${apiKey}`,
      "Accept": "application/json",
    },
  });
  console.log("Status:", res.status);
  if (res.ok) {
    const data = await res.json();
    console.log("Root endpoints:", data);
  } else {
    const text = await res.text();
    console.log("Text:", text.slice(0, 300));
  }
}

checkApiRoot();
