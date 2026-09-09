// functions/_ratelimit.js
//
// B1 — Rate limit untuk endpoint sensitif (`/api/auth/login`).
//
// ===========================================================================
// Kenapa dua lapis? Karena satu lapis terbukti tidak cukup di produksi.
// ===========================================================================
// Pengukuran langsung terhadap produksi (commit sebelumnya, memori saja)
// menunjukkan X-RateLimit-Remaining melonjak 7 -> 6 -> 9 -> 5 -> 9 -> 8 pada
// enam percobaan berurutan dari IP yang sama. Itu bukan kebetulan: Workers
// berjalan di banyak isolate yang TIDAK berbagi memori, sehingga ambang 10
// praktis menjadi 10 x (jumlah isolate yang kebetulan disentuh).
//
// Lapisan:
//   1. MEMORI  — sliding window per isolate. Cepat, presisi, tapi lokal.
//   2. CACHE   — `caches.default`, shared per datacenter lintas isolate.
//                Best-effort & eventually-consistent, tapi menutup celah
//                utama di atas. Tidak butuh binding baru (KV butuh API
//                token yang sedang terblokir, lihat A6).
//
// Yang TIDAK diklaim: ini bukan jaminan absolut. Cache API bisa evict,
// dan dua isolate bisa menimpa hitungan secara berbarengan. Yang diklaim:
// biaya brute-force naik berlipat dibanding tanpa pembatas, dan batasnya
// kini terukur lintas-isolate, bukan per-isolate.

/** Kapasitas maksimum entri IP di memori (cegah memori tak terbatas). */
const MAX_KEYS = 10000;

/** Ambang per isolate: 10 percobaan / 5 menit. */
const MEM_LIMIT = 10;

/** Ambang shared per datacenter: 20 percobaan / 5 menit. */
const SHARED_LIMIT = 20;

/** Panjang jendela (ms) — sama untuk kedua lapis. */
const WINDOW_MS = 5 * 60 * 1000;

/** @type {Map<string, number[]>} key -> daftar timestamp (ms) percobaan */
const buckets = new Map();

/**
 * Ambil kunci identitas klien.
 * Urutan: `CF-Connecting-IP` (diisi Cloudflare, tidak bisa dipalsukan klien)
 * → `X-Forwarded-For` (hanya kalau CF header absen, misal `wrangler dev`)
 * → fallback konstan.
 */
export function clientKey(request) {
  const cf = request.headers.get('CF-Connecting-IP');
  if (cf) return cf.trim();
  const xff = request.headers.get('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

function prune(bucket, now, windowMs) {
  // Buang timestamp yang sudah keluar jendela.
  const cutoff = now - windowMs;
  let i = 0;
  while (i < bucket.length && bucket[i] <= cutoff) i++;
  if (i > 0) bucket.splice(0, i);
}

// ---------------------------------------------------------------------------
// Lapis 1 — memori (sinkron)
// ---------------------------------------------------------------------------

/**
 * Catat satu percobaan di memori isolate ini.
 * @returns {{ok: boolean, remaining: number} | {ok: false, remaining: 0, retryAfter: number}}
 */
export function hit(key, { limit = MEM_LIMIT, windowMs = WINDOW_MS } = {}) {
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    // Cegah pertumbuhan tak terbatas: evict entri terlama dulu (Map menjaga
    // urutan penyisipan, jadi iterator pertama = yang paling lama disisipkan).
    if (buckets.size >= MAX_KEYS) {
      const oldest = buckets.keys().next().value;
      buckets.delete(oldest);
    }
    bucket = [];
    buckets.set(key, bucket);
  }

  prune(bucket, now, windowMs);

  if (bucket.length >= limit) {
    // Jangan catat percobaan yang ditolak — kalau dicatat, jendela geser
    // terus dan klien yang jahat tidak pernah bisa keluar dari penalti.
    const retryAfter = Math.max(1, Math.ceil((bucket[0] + windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfter };
  }

  bucket.push(now);
  return { ok: true, remaining: limit - bucket.length };
}

/**
 * Lihat keadaan counter TANPA menambah percobaan.
 * @returns {{remaining: number, count: number, retryAfter: number|null}}
 */
export function peek(key, { limit = MEM_LIMIT, windowMs = WINDOW_MS } = {}) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket) return { remaining: limit, count: 0, retryAfter: null };

  prune(bucket, now, windowMs);
  if (bucket.length >= limit) {
    return {
      remaining: 0,
      count: bucket.length,
      retryAfter: Math.max(1, Math.ceil((bucket[0] + windowMs - now) / 1000))
    };
  }
  return { remaining: limit - bucket.length, count: bucket.length, retryAfter: null };
}

/** Hapus counter memori untuk `key`. */
export function reset(key) {
  buckets.delete(key);
}

/** Hapus semua counter memori. Untuk pengujian. */
export function resetAll() {
  buckets.clear();
}

/** Jumlah kunci yang dilacak di memori. Untuk pengujian/observability. */
export function size() {
  return buckets.size;
}

// ---------------------------------------------------------------------------
// Lapis 2 — Cache API (async, shared per datacenter)
// ---------------------------------------------------------------------------

// Cache API butuh URL absolut; host ini tidak pernah benar-benar di-request.
const SHARED_ORIGIN = 'https://ratelimit.internal';

/**
 * Apakah Cache API tersedia?
 * Di Node (harness uji) tidak ada — semua operasi menjadi no-op yang aman.
 */
function cacheAvailable() {
  return typeof caches !== 'undefined' && caches && typeof caches.default?.match === 'function';
}

function sharedUrl(key) {
  return `${SHARED_ORIGIN}/${encodeURIComponent(key)}`;
}

/**
 * Hitung mundur jatah shared untuk `key`.
 *
 * Best-effort: kalau Cache API gagal/evict, lapis ini mengembalikan
 * `ok: true` dan lapis memori tetap berlaku. Kegagalan di sini tidak boleh
 * mengunci pengguna sah, jadi semua error ditelan.
 *
 * @returns {Promise<{ok: boolean, remaining: number, retryAfter: number|null, via: string}>}
 */
export async function hitShared(key, { limit = SHARED_LIMIT, windowMs = WINDOW_MS } = {}) {
  if (!cacheAvailable()) {
    return { ok: true, remaining: limit, retryAfter: null, via: 'cache-unavailable' };
  }

  const now = Date.now();
  const url = sharedUrl(key);

  try {
    const cache = caches.default;
    const hitRes = await cache.match(url);
    let stamps = [];

    if (hitRes) {
      const raw = await hitRes.text();
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) stamps = parsed.filter(n => typeof n === 'number');
      } catch {
        // Entri rusak -> anggap kosong, jangan kunci pengguna.
        stamps = [];
      }
    }

    prune(stamps, now, windowMs);

    if (stamps.length >= limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfter: Math.max(1, Math.ceil((stamps[0] + windowMs - now) / 1000)),
        via: 'cache'
      };
    }

    stamps.push(now);
    // max-age = sisa jendela; entries kedaluwarsa sendiri dan tidak menumpuk.
    const maxAge = Math.max(1, Math.ceil(windowMs / 1000));
    await cache.put(
      url,
      new Response(JSON.stringify(stamps), {
        headers: { 'Cache-Control': `public, max-age=${maxAge}` }
      })
    );

    return { ok: true, remaining: limit - stamps.length, retryAfter: null, via: 'cache' };
  } catch {
    // Cache API menolak / tidak tersedia -> jangan blokir login karenanya.
    return { ok: true, remaining: limit, retryAfter: null, via: 'cache-error' };
  }
}

/** Hapus entri shared untuk `key` (dipakai setelah login berhasil). */
export async function resetShared(key) {
  if (!cacheAvailable()) return false;
  try {
    return await caches.default.delete(sharedUrl(key));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// API gabungan — dipakai handler
// ---------------------------------------------------------------------------

/**
 * Catat satu percobaan di KEDUA lapis.
 * Urutan memori dulu (murah, sinkron), lalu cache (mahal, async).
 *
 * @returns {Promise<{ok: boolean, remaining: number, retryAfter: number|null, blockedBy: string|null}>}
 */
export async function consume(key, { limit = MEM_LIMIT, windowMs = WINDOW_MS } = {}) {
  const mem = hit(key, { limit, windowMs });
  if (!mem.ok) {
    return { ...mem, blockedBy: 'memory' };
  }

  const shared = await hitShared(key, { windowMs });
  if (!shared.ok) {
    return { ok: false, remaining: 0, retryAfter: shared.retryAfter, blockedBy: 'cache' };
  }

  // Laporkan sisa yang lebih ketat dari kedua lapis — angka yang jujur
  // untuk klien, bukan angka yang terlihat paling longgar.
  return {
    ok: true,
    remaining: Math.min(mem.remaining, shared.remaining),
    retryAfter: null,
    blockedBy: null
  };
}

/**
 * Bersihkan kedua lapis — dipakai setelah login BERHASIL supaya pengguna
 * yang tadi salah ketik tidak terkunci pada kali berikutnya.
 */
export async function clearAll(key) {
  reset(key);
  await resetShared(key);
}
