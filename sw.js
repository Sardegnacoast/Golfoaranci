const CACHE_NAME = 'wga-v1';
const ASSETS = [
  '/Golfoaranci/WGA_slim.html',
  '/Golfoaranci/manifest.json',
  '/Golfoaranci/LOGO_WGA_orig.jpeg',
  '/Golfoaranci/bg_golfo_rot.jpg',
  '/Golfoaranci/icon-192.png',
  '/Golfoaranci/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
