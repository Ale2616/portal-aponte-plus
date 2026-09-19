const CACHE_NAME = 'aponte-plus-pwa-v3';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/logo.jpg',
  '/logo.png',
  '/icon.png',
  '/badge.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones GET
  if (event.request.method !== 'GET') return;

  // No interceptar peticiones dinámicas de API ni navegación HTML para servir siempre la versión en vivo
  if (event.request.url.includes('/api/') || event.request.mode === 'navigate') {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ===================================================================
// GESTIÓN DE NOTIFICACIONES PUSH (Web Push API)
// ===================================================================
self.addEventListener('push', function (event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Internet Aponte',
        body: event.data.text() || 'Tu pago del servicio de internet ha sido registrado con éxito.',
      };
    }
  }

  const title = data.title || 'Internet Aponte';
  const options = {
    body: data.body || 'Tu pago del servicio de internet ha sido registrado con éxito.',
    icon: data.icon || '/logo.png',
    badge: data.badge || '/badge.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'pago-confirmado',
    renotify: true,
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Si ya hay una pestaña abierta con el portal, enfocarla
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
      // 2. Si no hay pestaña abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

