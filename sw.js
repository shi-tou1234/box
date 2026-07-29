const CACHE_VERSION = 'solder-pm-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin/',
  '/admin/index.html',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  // Delete ALL old caches, not just known versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // JS files: always fetch fresh, never cache
  if (url.pathname.endsWith('.js')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // HTML files: network-first, no cache
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname === '') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Other assets (CSS, fonts, images): stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
