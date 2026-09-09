// functions/_cors.js
// B5 — CORS ketat.
//
// SEBELUM tick ini, `functions/_db.js` mengirim
// `Access-Control-Allow-Origin: *` pada SETIAP respons `jsonResponse()` dan
// `corsOptions()`. Artinya situs mana pun di internet bisa membaca isi
// endpoint API dari browser pengunjung yang sedang login — termasuk
// `/api/orders`, `/api/customers`, `/api/profile`, `/api/reports`.
//
// SESUDAH tick ini: header CORS hanya dikirim bila header `Origin` ada DAN
// tercantum dalam daftar izin. Origin lain tidak mendapat header CORS sama
// sekali, sehingga browser memblokir pembacaan respons.
//
// Semua logika CORS kini terpusat di modul ini supaya tidak ada lagi
// hardcoded `*` yang tersebar di 6 titik (4 handler + 2 helper).

// Origin produksi. Sumber kebenaran: public/sitemap.xml.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://embun-laundry.dhanisepeda.workers.dev'
];

// `wrangler dev` dan preview lokal (Workers pakai port acak 8787/8788 dst).
const DEV_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

// Deployment preview Cloudflare Workers untuk akun ini.
const PREVIEW_HOST_SUFFIX = '.dhanisepeda.workers.dev';

/**
 * Origin tambahan dari environment (opsional).
 * Format: dipisahkan koma, mis. "https://a.example, https://b.example".
 * Bisa diset lewat dasbor Cloudflare tanpa mengubah kode.
 */
function envOrigins(env) {
  const raw = env && env.ALLOWED_ORIGINS;
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Apakah origin ini boleh menerima header CORS?
 *
 * @param {string|null} origin nilai header `Origin`
 * @param {object} [env] environment Worker
 * @returns {boolean}
 */
export function isOriginAllowed(origin, env) {
  if (!origin) return false;

  let url;
  try {
    url = new URL(origin);
  } catch (e) {
    return false;
  }

  // Hanya skema yang bisa dipakai browser untuk request CORS.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;

  for (const allowed of [...DEFAULT_ALLOWED_ORIGINS, ...envOrigins(env)]) {
    if (allowed === url.origin) return true;
  }

  if (DEV_ORIGIN_RE.test(url.origin)) return true;

  // Preview deployment: https://<hash>.dhanisepeda.workers.dev
  if (url.protocol === 'https:' && url.hostname.endsWith(PREVIEW_HOST_SUFFIX)) {
    return true;
  }

  return false;
}

/**
 * Header CORS yang boleh dikirim untuk permintaan ini.
 *
 * - Tanpa header `Origin` (same-origin GET, curl, health check server):
 *   tidak ada header CORS. Same-origin tidak memerlukannya.
 * - Origin tidak dikenal: hanya `Vary: Origin` (supaya cache tidak
 *   mencampur respons antar-origin), TANPA `Access-Control-Allow-Origin`.
 *
 * @param {Request} request
 * @param {object} [env]
 * @returns {Record<string, string>}
 */
export function corsHeaders(request, env) {
  const origin = request && request.headers && request.headers.get('Origin');

  // `Vary: Origin` wajib ada agar CDN/cache tidak menyajikan respons yang
  // dibuat untuk satu origin kepada origin lain.
  if (!origin) return {};

  if (!isOriginAllowed(origin, env)) {
    return { Vary: 'Origin' };
  }

  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin'
  };

  // Preflight butuh informasi tambahan; respons biasa tidak.
  if (request.method === 'OPTIONS') {
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['Access-Control-Max-Age'] = '86400';
  }

  return headers;
}

/**
 * Tempel header CORS ke Response yang sudah ada.
 * Mengembalikan Response baru (header Response asli bisa immutable).
 *
 * @param {Response} response
 * @param {Request} request
 * @param {object} [env]
 * @returns {Response}
 */
export function applyCors(response, request, env) {
  const headers = corsHeaders(request, env);
  if (Object.keys(headers).length === 0) return response;

  // Response yang dibuat dari Cache API / ASSETS bisa ber-header immutable,
  // jadi selalu bekerja di atas salinan.
  const res = response.clone ? response.clone() : response;
  for (const [k, v] of Object.entries(headers)) {
    if (k === 'Vary') {
      // Gabungkan, jangan menimpa Vary yang sudah ada.
      const existing = res.headers.get('Vary');
      if (!existing) res.headers.set('Vary', v);
      else if (!existing.includes('Origin')) res.headers.set('Vary', `${existing}, Origin`);
    } else {
      res.headers.set(k, v);
    }
  }
  return res;
}
