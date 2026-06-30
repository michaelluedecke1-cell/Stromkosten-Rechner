// Service Worker für den Stromkosten-Rechner
const CACHE_NAME = 'stromkosten-v2';
const urlsToCache = [
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
  // Weitere Ressourcen (z.B. externe Fonts, CSS) werden dynamisch gecacht
];

// Installationsphase – statische Assets cachen
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache geöffnet');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.warn('Fehler beim Cachen:', err))
  );
  // Den Service Worker sofort aktivieren (nicht auf nächste Navigation warten)
  self.skipWaiting();
});

// Aktivierungsphase – alte Caches bereinigen
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Service Worker: Lösche alten Cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim()) // Übernimmt sofort die Kontrolle
  );
});

// Fetch-Strategie: Cache-first für statische Ressourcen, Network-first für HTML
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Nur GET-Anfragen behandeln
  if (request.method !== 'GET') return;

  // Für HTML-Dokumente (index.html) Netzwerk zuerst, fallback auf Cache
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Klon für Cache speichern (aktuelle Version)
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback: aus Cache liefern
          return caches.match(request);
        })
    );
    return;
  }

  // Für alle anderen Anfragen (CSS, JS, Bilder) – Cache-first
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Falls nicht im Cache, aus dem Netzwerk holen und speichern
        return fetch(request)
          .then(response => {
            // Nur gültige Antworten cachen
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
            return response;
          })
          .catch(err => {
            // Bei Netzwerkfehler: nichts weiter (optional Offline-Seite anzeigen)
            console.warn('Service Worker: Fetch fehlgeschlagen für', request.url, err);
          });
      })
  );
});
