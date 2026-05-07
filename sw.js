const CACHE_NAME = 'wga-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/LOGO_WGA_orig.jpeg',
  '/bg_golfo_rot.jpg',
  '/icon-192.png',
  '/icon-512.png',
  '/hotel_gabbiano.jpg',
  '/hotel_margherita.jpg',
  '/hotel_caddinas.jpg',
  '/hotel_castello.jpg',
  '/hotel_maria.jpg',
  '/airbnb_bilo.jpg',
  '/airbnb_paradiso.jpg',
  '/airbnb_relax.jpg',
  '/airbnb_perlacea_relax.jpg',
  '/noleggio_driver.jpg',
  '/noleggio_smeralda.jpg',
];

// Install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch - cache first, then network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});

// Background Sync
self.addEventListener('sync', e => {
  if (e.tag === 'sync-data') {
    e.waitUntil(Promise.resolve());
  }
});

// Periodic Background Sync
self.addEventListener('periodicsync', e => {
  if (e.tag === 'update-content') {
    e.waitUntil(
      caches.open(CACHE_NAME).then(cache => cache.add('/index.html'))
    );
  }
});

// Push notifications
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {
    title: 'Welcome Golfo Aranci',
    body: 'Nuovi aggiornamenti disponibili! 🌊'
  };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-72.png'
    })
  );
});

// Notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
