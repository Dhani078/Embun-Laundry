// public/sw.js — Service worker dasar untuk Embun Laundry (Task C9)
//
// Strategi: app-shell precache + stale-while-revalidate untuk aset statis,
// network-first untuk API. Tujuannya: halaman yang sudah dibuka minimal satu
// kali tetap dapat dibaca saat jaringan mati; tidak ada data DB yang di-cache
// (lihat catatan di bawah).
//
// Ponytail: SW ini tidak menyangga data TiDB. Endpoint /api/* sengaja
// network-first + no-store pada POST/PUT/DELETE. Bila nanti dibutuhkan
// offline write-queue (mis. kasir mencatat pesanan saat listrik/matang),
// naikkan ke IndexedDB + background sync — jangan memperluas cache ini.

const APP_SHELL = '/sw.js'; // marker: precache versi ini
const CACHE_VERSION = 'v3';
const SHELL_CACHE = `embun-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `embun-assets-${CACHE_VERSION}`;

// Aplikasi inti (app shell). Daftar eksplisit, bukan wildcard — ukuran
// tetap kecil dan terprediksi.
const SHELL_URLS = [
  '/',
  '/dashboard',
  '/dashboard.html',
  '/track',
  '/track.html',
  '/pay.html',
  '/auth/login.html',
  '/auth/register.html',
  '/assets/design-tokens.css',
  '/assets/style.css',
  '/assets/escape.js',
  '/assets/hero-canvas.js',
  '/app.js',
  '/img/Logo.png',
  '/robots.txt'
];

// Prefetch tidak boleh gagal total kalau satu file 404 — abaikan saja.
async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.all(
    SHELL_URLS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res && res.ok) await cache.put(url, res);
      } catch (e) {
        /* offline saat install — diisi nanti via swr */
      }
    })
  );
}

// Hapus versi cache lama.
async function cleanupStaleCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((k) => !k.endsWith(CACHE_VERSION))
      .map((k) => caches.delete(k))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    cleanupStaleCaches().then(() => self.clients.claim())
  );
});

// Aset statis: stale-while-revalidate. Cepat, dan tetap segar.
async function handleAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

// API: network-first, fallback ke cache hanya untuk GET baca.
// Tulisan (POST/PUT/DELETE) selalu menyentuh jaringan dan tidak pernah
// di-cache — mencegah data basi / pembayaran dobel.
async function handleApi(request) {
  if (request.method !== 'GET') {
    return fetch(request);
  }
  try {
    const res = await fetch(request);
    // Hanya simpan respons GET yang sukses dan aman untuk diulang.
    if (res && res.ok) {
      const cache = await caches.open(ASSET_CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw e;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') {
    // Biarkan browser menangani non-GET (termasuk POST yang butuh jaringan).
    return;
  }
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // CDN pihak ketiga (font, p5.js) — biarkan penanganan default browser.
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApi(req).catch(() =>
      new Response(
        JSON.stringify({ ok: false, msg: 'Sedang offline — data tidak tersedia' }),
        { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      )
    ));
    return;
  }
  // Navigasi halaman: fallback ke app shell (SPA tetap terbuka).
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          if (res && res.ok) cache.put(req.url, res.clone());
          return res;
        } catch (e) {
          const shellCache = await caches.open(SHELL_CACHE);
          const cached =
            (await shellCache.match(req.url)) ||
            (await shellCache.match('/')) ||
            (await shellCache.match('/dashboard'));
          return cached || Response.error();
        }
      })()
    );
    return;
  }
  event.respondWith(handleAsset(req));
});
