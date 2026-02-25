const CACHE_VERSION = 'ccg-admin-dd0a92a7a8';
const SHELL_ASSETS = [
  '/admin/index.html',
  '/admin/inventory.html',
  '/admin/inventory-item.html',
  '/admin/listing-evaluator.html',
  '/admin/listing-evaluator-results.html',
  '/admin/listing-evaluator-item.html',
  '/admin/listing-radar.html',
  '/admin/marketplace-listings.html',
  '/admin/custom-item-eval.html',
  '/styles.css',
  '/admin.webmanifest',
  '/images/favicon/apple-touch-icon.png',
  '/images/favicon/favicon-32x32.png',
  '/images/favicon/favicon-16x16.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => (key === CACHE_VERSION ? Promise.resolve() : caches.delete(key))));
    await self.clients.claim();
  })());
});

function shouldHandle(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname.startsWith('/images/uploads/')) return false;
  return (
    url.pathname.startsWith('/admin/') ||
    url.pathname.startsWith('/dist/') ||
    url.pathname === '/styles.css' ||
    url.pathname === '/admin.webmanifest' ||
    url.pathname.startsWith('/images/favicon/')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!shouldHandle(request)) return;

  const accept = request.headers.get('accept') || '';
  const isDocument = request.mode === 'navigate' || accept.includes('text/html');

  if (isDocument) {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(request, network.clone()).catch(() => undefined);
        return network;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        const adminHome = await caches.match('/admin/index.html');
        if (adminHome) return adminHome;
        throw new Error('offline');
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const networkPromise = fetch(request)
      .then(async (response) => {
        const cache = await caches.open(CACHE_VERSION);
        cache.put(request, response.clone()).catch(() => undefined);
        return response;
      })
      .catch(() => null);
    if (cached) {
      networkPromise.then(() => undefined);
      return cached;
    }
    const network = await networkPromise;
    if (network) return network;
    throw new Error('offline');
  })());
});
