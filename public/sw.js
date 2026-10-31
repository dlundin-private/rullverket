// Offline-cache. Höj VERSION vid varje ändring, annars visar installerade kopior den gamla versionen.
const VERSION = 'rullverket-6';
const FILER = ['./', 'index.html', 'style.css', 'spel.js', 'motor.js', 'banor.json', 'vendor/matter.min.js',
  'manifest.webmanifest', 'ikoner/ikon.svg', 'ikoner/ikon-180.png', 'ikoner/ikon-192.png', 'ikoner/ikon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILER)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
