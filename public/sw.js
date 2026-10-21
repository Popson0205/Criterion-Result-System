// ============================================================
// SERVICE WORKER — Criterion Results PWA
// Network-first, so a new deployment reaches every phone straight away.
// Bump CACHE_NAME on each release: phones that already have the app open
// then drop the old cache and reload themselves — nobody has to clear
// their browser data.
// ============================================================
const CACHE_NAME = 'criterion-v3';

const PRECACHE_URLS = [
  '/', '/index.html', '/styles.css', '/theme.js', '/logo.js', '/schools.js',
  '/api.js', '/data.js', '/app.js', '/receipts.js', '/print.js', '/creche_print.js',
  '/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // cache:'reload' bypasses the browser HTTP cache so we never store stale copies
      Promise.all(PRECACHE_URLS.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const hadOldVersion = keys.some(k => k !== CACHE_NAME);
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    // An older version was installed: reload any open copy so the new
    // home page / portals show immediately.
    if (hadOldVersion) {
      const open = await self.clients.matchAll({ type: 'window' });
      open.forEach(c => { try { c.navigate(c.url); } catch (_) {} });
    }
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // API calls always go to the network.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline — no network connection' }), {
          status: 503, headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Everything else: newest copy first, saved copy only when offline.
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() =>
      caches.match(event.request).then(cached =>
        cached || (event.request.mode === 'navigate' ? caches.match('/index.html') : undefined)
      )
    )
  );
});
