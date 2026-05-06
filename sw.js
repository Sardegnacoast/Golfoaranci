const CACHE_NAME = 'wga-v2';
const ASSETS = [
  '/Golfoaranci/index.html',
  '/Golfoaranci/manifest.json',
  '/Golfoaranci/LOGO_WGA_orig.jpeg',
  '/Golfoaranci/bg_golfo_rot.jpg',
  '/Golfoaranci/icon-192.png',
  '/Golfoaranci/icon-512.png',
  '/Golfoaranci/hotel_gabbiano.jpg',
  '/Golfoaranci/hotel_margherita.jpg',
  '/Golfoaranci/hotel_caddinas.jpg',
  '/Golfoaranci/hotel_castello.jpg',
  '/Golfoaranci/hotel_maria.jpg',
  '/Golfoaranci/airbnb_bilo.jpg',
  '/Golfoaranci/airbnb_paradiso.jpg',
  '/Golfoaranci/airbnb_relax.jpg',
  '/Golfoaranci/airbnb_perlacea_relax.jpg',
  '/Golfoaranci/noleggio_driver.jpg',
  '/Golfoaranci/noleggio_smeralda.jpg',
];

// Install - cache assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch - serve from cache, fallback to network
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
    }).catch(() => caches.match('/Golfoaranci/index.html'))
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
      caches.open(CACHE_NAME).then(cache =>
        cache.add('/Golfoaranci/index.html')
      )
    );
  }
});

// Push notifications
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'Welcome Golfo Aranci', body: 'Nuovi aggiornamenti disponibili!' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/Golfoaranci/icon-192.png',
      badge: '/Golfoaranci/icon-72.png'
    })
  );
});
