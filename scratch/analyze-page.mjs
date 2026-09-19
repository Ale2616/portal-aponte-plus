import fs from 'fs';

const html = fs.readFileSync('scratch/trafico-page.html', 'utf8');
console.log('Title:', html.match(/<title>([^<]+)<\/title>/)?.[1]);

// Check if page redirected to login or is actual page
if (html.includes('id_login') || html.includes('Iniciar sesión')) {
  console.log('PAGE IS LOGIN PAGE (unauthenticated)!');
} else {
  console.log('PAGE IS LOGGED IN CONTENT!');
}

const urls = [...new Set(html.match(/['"][^'"]*trafico[^'"]*['"]/gi) || [])];
console.log('Trafico URLs in page:', urls.slice(0, 30));

const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
console.log('Scripts count:', scripts.length);
for (const s of scripts) {
  if (s.includes('trafico') || s.includes('highcharts') || s.includes('ajax') || s.includes('url:')) {
    console.log('Relevant script snippet:', s.slice(0, 300));
  }
}
