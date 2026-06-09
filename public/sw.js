const CACHE_NAME = 'tournament-pwa-v3';
const ASSETS = [
  './',
  './index.html',
  './favicon.svg',
  './manifest.json'
];

// インストール時に基本アセットをキャッシュ
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// アクティベート時に古いキャッシュをクリーンアップ
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// キャッシュ第一（Stale-While-Revalidate）戦略
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Vite開発サーバー関連（HMR接続など）はキャッシュ対象から除外
  if (
    url.pathname.includes('@vite') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('ws') ||
    url.hash.includes('vite') ||
    url.search.includes('v=')
  ) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          // ネットワークエラー時はキャッシュがあればそれを返す
          console.log('Fetch failed, service worker serving from cache:', err);
        });

      return cachedResponse || fetchPromise;
    })
  );
});
