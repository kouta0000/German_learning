/* ── Deutsch Lernen Service Worker ──────────────────────────────────────────
   戦略:
   - HTML / JSON → Network First（常に最新を取得、失敗時はキャッシュ）
   - 画像 / アイコン → Cache First（変わらないので速度優先）
   - CACHE_VERSION を上げるだけで全キャッシュが自動クリアされる
   ─────────────────────────────────────────────────────────────────────────── */
const CACHE_VERSION = 'dl-v17';
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
        keys.filter(k => k !== CACHE_VERSION && k !== GTTS_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // 開いているページを即座に制御下に
  );
});

// ── Fetch: リクエスト種別ごとに戦略を切り替え ────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ── Google TTS プロキシ (/gtts-proxy?q=TEXT) ───────────────────────────────
  // opaque response は Content-Type が空になり Audio 要素が再生できない。
  // CORS fetch で実際の音声データを読み取り、Content-Type を付与して返す。
  // 試行順:
  //   1. translate.googleapis.com?client=gtx  (外部ウィジェット向け、CORS ヘッダーあり)
  //   2. translate.google.com?client=tw-ob    (非公式、CORS なしの場合あり)
  if (url.pathname === '/gtts-proxy') {
    const q = url.searchParams.get('q') || '';
    if (!q) return;
    const encoded = encodeURIComponent(q.slice(0, 200));
    const candidates = [
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=de&client=gtx&q=${encoded}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q=${encoded}`,
    ];

    event.respondWith((async () => {
      // キャッシュヒット
      const cache  = await caches.open(GTTS_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;

      // 各URLを順番に試す（CORS fetchで実際のbodyを取得）
      for (const googleUrl of candidates) {
        try {
          const res = await fetch(googleUrl);
          if (!res.ok) continue;
          const buffer = await res.arrayBuffer();
          const response = new Response(buffer, {
            status: 200,
            headers: {
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=86400',
            },
          });
          cache.put(request, response.clone());
          return response;
        } catch (_) {
          // CORS エラー or ネットワークエラー → 次のURLを試す
        }
      }
      return new Response('', { status: 503 });
    })());
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
