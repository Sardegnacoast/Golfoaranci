/* Service worker — Welcome Golfo Aranci
   Rete prima, cache solo come fallback offline + gestione tap sulle notifiche locali.

   IMPORTANTE (bug corretto il 24 Sett 2026): la versione precedente usava una
   strategia "cache-first" che, dopo il primo avvio, continuava a servire per
   sempre la index.html salvata in cache quella prima volta — anche dopo ogni
   aggiornamento pubblicato su Play Store/App Store, perché il Service Worker
   non veniva mai davvero invalidato (il fetch handler controllava la cache
   PRIMA della rete). Chi aveva installato l'app da un po' restava bloccato su
   una versione vecchia del codice (bandierine lingua incluse) a prescindere
   da quante release nuove pubblicavamo. Ora la rete ha sempre la priorità:
   la cache serve solo quando il dispositivo è offline. */

const WGA_CACHE = 'wga-v5';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== WGA_CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      const resClone = res.clone();
      caches.open(WGA_CACHE).then(function (c) { c.put(e.request, resClone); }).catch(function () {});
      return res;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});

/* Quando l'utente tocca una notifica, apre/mette in primo piano l'app */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function (clientList) {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
