import fs from 'fs';

async function main() {
  const user = "bot@aponteplus";
  const pass = "aponteplus21";

  console.log("1. Fetching login page...");
  const res1 = await fetch("https://wisphub.net/accounts/login/");
  const setCookies1 = res1.headers.getSetCookie ? res1.headers.getSetCookie() : [];
  const csrfCookie = setCookies1.find(c => c.startsWith("csrftoken="))?.split(";")[0] || "";
  const body1 = await res1.text();
  const csrfTokenMatch = body1.match(/name=['"]csrfmiddlewaretoken['"]\s+value=['"]([^'"]+)['"]/);
  const csrfToken = csrfTokenMatch ? csrfTokenMatch[1] : "";

  console.log("CSRF Cookie:", csrfCookie);
  console.log("CSRF Token:", csrfToken);

  if (!csrfToken || !csrfCookie) {
    console.error("Failed to get CSRF token/cookie");
    return;
  }

  console.log("2. Submitting login form...");
  const res2 = await fetch("https://wisphub.net/accounts/login/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": csrfCookie,
      "Referer": "https://wisphub.net/accounts/login/",
      "Origin": "https://wisphub.net",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: new URLSearchParams({
      csrfmiddlewaretoken: csrfToken,
      login: user,
      password: pass,
      token_device: "",
      name_device: "",
      type_device: "web",
      remember: "1",
    }).toString(),
    redirect: "manual",
  });

  console.log("Login POST status:", res2.status, res2.statusText);
  console.log("Location header:", res2.headers.get("location"));
  const setCookies2 = res2.headers.getSetCookie ? res2.headers.getSetCookie() : [];
  console.log("Cookies returned:", setCookies2);

  const allCookies = [...setCookies1, ...setCookies2]
    .map(c => c.split(';')[0])
    .filter((v, i, a) => a.indexOf(v) === i)
    .join('; ');

  console.log("Combined cookie string:", allCookies);

  if (res2.status === 302) {
    console.log("LOGIN SUCCESS! Now testing /trafico/...");
    const res3 = await fetch("https://wisphub.net/trafico/", {
      headers: {
        "Cookie": allCookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    console.log("/trafico/ status:", res3.status);
    const text3 = await res3.text();
    fs.writeFileSync("scratch/logged-in-trafico.html", text3);
    console.log("Saved scratch/logged-in-trafico.html, length:", text3.length);

    // Also check client 904 URLs
    const clientUrls = [
      "https://wisphub.net/clientes/",
      "https://wisphub.net/clientes/904/",
      "https://wisphub.net/servicios/904/",
    ];
    for (const cu of clientUrls) {
      const cr = await fetch(cu, {
        headers: {
          "Cookie": allCookies,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      console.log(`${cu} status:`, cr.status);
    }
  } else {
    const text2 = await res2.text();
    fs.writeFileSync("scratch/failed-login.html", text2);
    console.log("Failed login saved to scratch/failed-login.html");
  }
}

main();
