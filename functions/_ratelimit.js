// functions/_ratelimit.js
//
// B1 — Rate limit sederhana untuk endpoint sensitif (`/api/auth/login`).
//
// Desain: **in-memory per instance Worker**, sliding window.
// Catatan jujur tentang batasannya (jangan dibaca sebagai solusi absolut):
//   - Cloudflare Workers itu multi-instance dan bisa di-evict kapan saja.
//     Counter TIDAK dibagikan antar isolate, dan bisa reset.
//   - Jadi ini adalah **pengurang kebisingan** (membuat brute-force berbiaya
//     tinggi), BUKAN jaminan. Untuk jaminan sejati butuh Durable Objects /
//     KV / Rate Limiting API berbayar.
//   - Tetapi: dalam praktiknya tiap IP cenderung dipetakan ke isolate yang
//     sama secara sticky, jadi ambang ini efektif untuk lalu lintas nyata.
//
// Kenapa tidak pakai dependency? Aturan AGENT24 §3.3: tidak ada dependency
// baru kalau bisa pakai stdlib/native. Ini murni `Map` + `Date.now()`.

/** Kapasitas maksimum entri IP yang disimpan (cegah memori tak terbatas). */
const MAX_KEYS = 10000;

/** @type {Map<string, number[]>} key -> daftar timestamp (ms) percobaan */
const buckets = new Map();

/**
 * Ambil kunci identitas klien.
 * Urutan: `CF-Connecting-IP` (diisi Cloudflare, tidak bisa dipalsukan klien)
 * → `X-Forwarded-For` (hanya kalau CF header absen, misal saat `wrangler dev`)
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

/**
 * Catat satu percobaan untuk `key`.
 *
 * @param {string} key           identitas klien
 * @param {object} [opts]
 * @param {number} [opts.limit]  jumlah percobaan maksimum dalam jendela
 * @param {number} [opts.windowMs] panjang jendela (ms)
 * @returns {{ok: true, remaining: number} |
 *           {ok: false, remaining: number, retryAfter: number}}
 *          `retryAfter` dalam DETIK (siap dipakai untuk header `Retry-After`).
 */
export function hit(key, { limit = 10, windowMs = 5 * 60 * 1000 } = {}) {
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
 *
 * @returns {{remaining: number, count: number, retryAfter: number|null}}
 *          `retryAfter` hanya terisi kalau jatah sudah habis.
 */
export function peek(key, { limit = 10, windowMs = 5 * 60 * 1000 } = {}) {
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

/**
 * Hapus counter untuk `key`. Dipakai setelah login BERHASIL supaya pengguna
 * sah yang salah ketik beberapa kali tidak terkunci tanpa alasan, dan dipakai
 * oleh harness uji untuk reset.
 */
export function reset(key) {
  buckets.delete(key);
}

/** Hapus semua counter. Hanya untuk pengujian. */
export function resetAll() {
  buckets.clear();
}

/** Jumlah kunci yang sedang dilacak. Hanya untuk pengujian/observability. */
export function size() {
  return buckets.size;
}
