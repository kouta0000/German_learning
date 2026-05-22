/* ── Deutsch Lernen Service Worker ──────────────────────────────────────────
   戦略:
   - HTML / JSON → Network First（常に最新を取得、失敗時はキャッシュ）
   - 画像 / アイコン → Cache First（変わらないので速度優先）
   - CACHE_VERSION を上げるだけで全キャッシュが自動クリアされる
   ─────────────────────────────────────────────────────────────────────────── */
const CACHE_VERSION = 'dl-v8';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install: 必須ファイルをキャッシュ ────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting(); // 即座に新しいSWを有効化
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ── Activate: 古いキャッシュを削除 ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // 開いているページを即座に制御下に
  );
});

// ── Fetch: リクエスト種別ごとに戦略を切り替え ────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 別オリジンは素通り
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  const isData       = url.pathname.startsWith('/data/');
  const isHtml       = url.pathname.endsWith('.html') || url.pathname === '/';

  if (isNavigation || isData || isHtml) {
    // ── Network First ──────────────────────────────────────────────────────
    event.respondWith(
      fetch(request)
        .then(res => {
          // 有効なレスポンスのみキャッシュ
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request)) // オフライン時はキャッシュから
    );
  } else {
    // ── Cache First（画像・アイコン等）────────────────────────────────────
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(request, clone));
          }
          return res;
        })
      )
    );
  }
});
