// Service Worker для PWA + Web Push уведомлений
const CACHE_NAME = 'bazar-sw-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Кеширование для офлайн-работы
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Получение push-уведомления
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Новый заказ!', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Новый заказ!';
  const options = {
    body: data.body || 'Покупатель оформил заказ',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || 'new-order',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      orderId: data.orderId || '',
      url: '/?tab=dashboard&section=orders',
    },
    actions: [
      { action: 'open', title: 'Открыть заказы' },
      { action: 'dismiss', title: 'Закрыть' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Если уже открыт — фокус + навигация
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE_ORDERS' });
          return;
        }
      }
      // Иначе открываем новое окно
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});