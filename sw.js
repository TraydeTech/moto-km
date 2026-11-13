// Guarda o app no aparelho para abrir sem internet.
const CACHE = 'motokm-v5';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-512.png', './apple-touch-icon.png', './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css', './vendor/maplibre/maplibre-gl.js', './vendor/maplibre/maplibre-gl.css', './vendor/maplibre/leaflet-maplibre-gl.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Rede primeiro (pega atualizações), cache se estiver offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok && new URL(e.request.url).origin === location.origin) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
