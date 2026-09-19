import fs from 'fs';

async function testLogin() {
  const res1 = await fetch('https://wisphub.net/accounts/login/');
  const cookies1 = res1.headers.getSetCookie ? res1.headers.getSetCookie() : [];
  const text1 = await res1.text();
  const csrfMatch = text1.match(/name=['"]csrfmiddlewaretoken['"]\s+value=['"]([^'"]+)['"]/);
  const csrf = csrfMatch ? csrfMatch[1] : '';
  const cookieHeader = cookies1.map(c => c.split(';')[0]).join('; ');
  
  console.log('CSRF:', csrf);
  console.log('Initial cookies:', cookieHeader);

  const res2 = await fetch('https://wisphub.net/accounts/login/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHeader,
      'Referer': 'https://wisphub.net/accounts/login/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: new URLSearchParams({
      csrfmiddlewaretoken: csrf,
      login: 'bot@aponteplus',
      password: 'aponteplus21',
      token_device: '',
      name_device: '',
      type_device: 'web',
      remember: '1',
    }).toString(),
    redirect: 'manual',
  });

  console.log('Login status:', res2.status, res2.statusText);
  console.log('Location:', res2.headers.get('location'));
  const cookies2 = res2.headers.getSetCookie ? res2.headers.getSetCookie() : [];
  console.log('Cookies after login:', cookies2.map(c => c.split(';')[0]));
  
  const text2 = await res2.text();
  if (res2.status === 200) {
    const err = text2.match(/class=['"][^'"]*alert[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i);
    console.log('Alert in page:', err ? err[1].trim() : 'None found');
    const formErrors = text2.match(/class=['"][^'"]*errorlist[^'"]*['"][^>]*>([\s\S]*?)<\/ul>/i);
    console.log('Form errors:', formErrors ? formErrors[1].trim() : 'None found');
    const hasCaptcha = text2.includes('recaptcha') || text2.includes('hcaptcha') || text2.includes('turnstile');
    console.log('Has captcha:', hasCaptcha);
    fs.writeFileSync('scratch/login-res-200.html', text2);
    console.log('Saved to scratch/login-res-200.html');
  } else if (res2.status === 302) {
    console.log('Login SUCCESSFUL!');
    // Merge cookies
    const allCookies = [...cookies1, ...cookies2].map(c => c.split(';')[0]).join('; ');
    fs.writeFileSync('scratch/wisphub-session-cookies.txt', allCookies);
    console.log('Saved session cookies to scratch/wisphub-session-cookies.txt');
  }
}

testLogin();
