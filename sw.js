/* Bump CACHE whenever a shipped file changes. Phones keep this name until the new worker activates. */
const CACHE = 'ledger-v7';

const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/money.js',
  './js/dates.js',
  './js/keypad.js',
  './js/icons.js',
  './js/categories.js',
  './js/stats.js',
  './js/xlsx-read.js',
  './js/import-parse.js',
  './js/backup.js',
  './js/views.js',
  './manifest.json',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async (path) => {
      const url = new URL(path, self.location);
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) throw new Error(`无法缓存 ${url.pathname}`);
      await cache.put(url, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(handle(req));
});

async function handle(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const path = new URL(req.url).pathname;
      const scope = new URL('./', self.location).pathname;
      if (path.startsWith(scope)) cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    if (req.mode === 'navigate') {
      return (await cache.match('./index.html')) || (await cache.match('./'));
    }
    throw e;
  }
}
