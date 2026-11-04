// BlaiseVR service worker: cache-first so the app works offline after the first visit.
const CACHE = 'blaisevr-v6';
const CORE = ['./', './index.html', './css/style.css', './js/main.js', './js/models.js', './js/models2.js', './js/ao.js', './js/aoWorker.js', './js/handWorker.js', './js/mirror.js', './js/sampler.js', './js/particles.js', './js/gestures.js', './js/importers.js', './assets/icon.svg', './manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable = url.origin === location.origin || /cdn\.jsdelivr\.net|storage\.googleapis\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!cacheable) return;
  // local files: network first (fresh deploys win), fall back to cache; CDN files: cache first
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; }).catch(() => caches.match(req)));
  } else {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
  }
});
