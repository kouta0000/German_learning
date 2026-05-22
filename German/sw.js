/* ── Deutsch Lernen Service Worker ──────────────────────────────────────────
   戦略:
   - HTML / JSON → Network First（常に最新を取得、失敗時はキャッシュ）
   - 画像 / アイコン → Cache First（変わらないので速度優先）
   - CACHE_VERSION を上げるだけで全キャッシュが自動クリアされる
   ─────────────────────────────────────────────────────────────────────────── */
const CACHE_VERSION = 'dl-v16';
const GTTS_CACHE    = 'dl-gtts-v1';  // Google TTS プロキシキャッシュ（独立管理）
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

  // ── Google TTS プロキシ (/gtts-proxy?q=TEXT) ───────────────────────────────
  // iOS Safari は Audio 要素でも Google TTS を直接取得できない場合がある。
  // SW が中継することで同一オリジンリクエストとして扱われ、制限を回避できる。
  // 同じテキストはキャッシュして Google への負荷を減らす。
  if (url.pathname === '/gtts-proxy') {
    const q = url.searchParams.get('q') || '';
    if (!q) return;
    const googleUrl = `https://translate.google.com/translate_tts` +
      `?ie=UTF-8&tl=de&client=tw-ob&q=${encodeURIComponent(q.slice(0, 200))}`;
    event.respondWith(
      caches.open(GTTS_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          // SW からの fetch は同一オリジン扱いされないが、
          // no-cors で opaque response を取得し audio 要素に渡せる
          return fetch(googleUrl, { mode: 'no-cors' })
            .then(res => {
              // opaque response (type='opaque') もキャッシュ・再生可能
              if (res.type === 'opaque' || res.ok) {
                cache.put(request, res.clone());
              }
              return res;
            });
        })
      ).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

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
