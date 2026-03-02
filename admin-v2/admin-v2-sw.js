const CACHE_VERSION = 'ccg-admin-v2-20260302a';
const SHELL_ASSETS = [
  '/admin-v2/',
  '/admin-v2/index.html',
  '/admin-v2/admin-v2.webmanifest',
  '/admin-v2/aurora.svg',
  '/images/favicon/apple-touch-icon.png',
  '/images/favicon/favicon-32x32.png',
  '/images/favicon/favicon-16x16.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => (key === CACHE_VERSION ? Promise.resolve() : caches.delete(key))));
      await self.clients.claim();
    })(),
  );
});

function shouldHandle(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname.startsWith('/images/uploads/')) return false;

  return (
    url.pathname.startsWith('/admin-v2/') ||
    url.pathname.startsWith('/images/favicon/')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!shouldHandle(request)) return;

  const accept = request.headers.get('accept') || '';
  const isDocument = request.mode === 'navigate' || accept.includes('text/html');

  if (isDocument) {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(request);
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, network.clone()).catch(() => undefined);
          return network;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;

          const appShell = (await caches.match('/admin-v2/')) || (await caches.match('/admin-v2/index.html'));
          if (appShell) return appShell;

          throw new Error('offline');
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
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
    })(),
  );
});
