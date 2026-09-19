// ===================================================================
// SERVICE WORKER - PORTAL INTERNET APONTE (PWA & WEB PUSH)
// ===================================================================

const CACHE_NAME = 'aponte-plus-pwa-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icon.png',
  '/badge.png',
  '/logo.png'
];

// 1. Ciclo de vida: Forzar activación inmediata sin esperar
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      })
    ])
  );
});

// 2. Intercepción de red solo para estáticos
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/') || event.request.mode === 'navigate') {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// 3. Listener simplificado al máximo con logs detallados para Push
self.addEventListener('push', (event) => {
  console.log('[SW] Evento push recibido:', event);
  let data = { title: "Internet Aponte", body: "Tu pago ha sido confirmado ✅" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Internet Aponte", {
      body: data.body || "Tu pago ha sido confirmado ✅",
      icon: '/icon.png',
      badge: '/icon.png',
      tag: 'pago-' + Date.now(),
      requireInteraction: true,
      data: {
        url: data.url || '/'
      }
    })
  );
});

// 4. Clic en notificación: enfocar ventana abierta o abrir una nueva
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(targetUrl) || client.url.includes(self.registration.scope)) {
            if ('navigate' in client && targetUrl !== '/') {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
