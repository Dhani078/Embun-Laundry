// functions/_db.js
import { connect } from '@tidbcloud/serverless';

// B8 — hash sandi kini PBKDF2-HMAC-SHA256 + salt acak per pengguna
// (lihat functions/_password.js). Sengaja di-re-export dari sini supaya
// pemanggil lama (register.js, profile.js) ikut ter-migrasi tanpa disentuh
// satu per satu — tidak ada lagi salinan algoritma di `_db.js`.
export { hashPassword, verifyPassword, isPbkdf2Hash } from './_password.js';

export async function getDb(env) {
  const connUrl = env.TIDB_DATABASE_URL || env.DATABASE_URL;
  if (!connUrl) {
    return null;
  }
  const conn = connect({ url: connUrl });
  // Provide both .execute and .query methods for maximum compatibility
  return {
    execute: (sql, params) => conn.execute(sql, params),
    query: (sql, params) => conn.execute(sql, params)
  };
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      // B5: `Access-Control-Allow-Origin: *` DIHAPUS dari sini.
      // Header CORS kini dipasang oleh `applyCors()` di src/index.js
      // berdasarkan daftar izin origin (functions/_cors.js).
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

// ---------------------------------------------------------------------------
// A4 — Kontrak respons API
// ---------------------------------------------------------------------------

/**
 * Baca body permintaan sebagai JSON dengan aman.
 *
 * Memanggil `request.json()` langsung di banyak handler membuat body yang
 * rusak berubah menjadi reject promise -> 500 dari runtime, BUKAN dari
 * handler. Helper ini mengembalikan objek hasil, bukan melempar, sehingga
 * setiap handler bisa membalas dengan JSON `{ ok: false }` yang rapi.
 *
 * @returns {{ok: true, data: object} | {ok: false, response: Response}}
 */
export async function readJson(request) {
  try {
    const data = await request.json();
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return {
        ok: false,
        response: jsonResponse({ ok: false, msg: 'Body harus berupa objek JSON' }, 400)
      };
    }
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      response: jsonResponse({ ok: false, msg: 'Body JSON tidak valid' }, 400)
    };
  }
}

/**
 * Balasan preflight CORS standar.
 * Digunakan handler yang belum punya `onRequestOptions` sendiri supaya
 * browser tidak menerima 405 saat melakukan preflight.
 *
 * B5: `Access-Control-Allow-Origin: *` DIHAPUS. Header `Access-Control-*`
 * yang bergantung pada origin kini dipasang terpusat oleh `applyCors()` di
 * `src/index.js` (lihat `functions/_cors.js`). Yang masih dipasang di sini
 * hanyalah daftar metode — itu tidak membocorkan apa pun karena tanpa
 * `Access-Control-Allow-Origin` browser akan tetap memblokir responsnya.
 */
export function corsOptions(methods = 'GET, POST, OPTIONS') {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// B14 — Pesan generik untuk seluruh kegagalan 500.
//
// Sebelum tick ini, 20 titik di 11 modul mengirim `msg: e.message` (atau
// `'Server error: ' + e.message`) ke klien. `e.message` berasal dari driver
// @tidbcloud/serverless dan dapat memuat connection string, nama database,
// nama tabel, dan nomor baris — informasi yang tidak pernah perlu diketahui
// pengguna. Kontrak A4 hanya menuntut `{ ok: false, msg }` yang aman
// ditampilkan; detailnya cukup di log server.
//
// Satu konstanta agar pesannya seragam dan tidak ada modul yang "lupa".
// Jangan pernah mengganti ini kembali ke `e.message` — lihat
// AGENT_BACKLOG.md entri 12 dan `tools/verify_b14.mjs`.
export const SERVER_ERROR = 'Terjadi kesalahan pada server';

// Security headers applied to every response (B4).
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

// Attach security headers to a Response, preserving existing ones.
export function withSecurityHeaders(response) {
  const res = response.clone ? response.clone() : response;
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!res.headers.has(k)) res.headers.set(k, v);
  }
  return res;
}

export function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

// ---------------------------------------------------------------------------
// B3 — Rahasia sesi WAJIB datang dari lingkungan
// ---------------------------------------------------------------------------
//
// SEBELUM perbaikan ini, kedua fungsi di bawah menulis:
//
//     const secret = env.JWT_SECRET || '<literal-yang-ikut-ter-commit>';
//
// Fallback itu bukan sekadar "nilai bawaan". Karena `wrangler.toml` ikut
// ter-commit, literal itu **dipublikasikan**: siapa pun yang punya salinan
// repository bisa menghitung tanda tangan HMAC yang sah untuk payload mana
// pun — termasuk `user_role: 'Admin'` — tanpa perlu punya akun. Itu bukan
// celah teori: kodenya ada di repositori publik.
//
// Yang membuatnya lebih berbahaya daripada kelihatannya: fallback itu
// bekerja **diam-diam**. Ia hanya aktif tepat pada saat yang paling
// tidak terduga (secret belum terpasang di lingkungan), dan saat itu
// sistem justru tampak sehat — login berhasil, sesi diterima — hanya saja
// kunci gerbangnya sedang dipajang di etalase.
//
// Karena itu aturannya dibalik: **tanpa secret, tidak ada sesi.**
// Konfigurasi yang hilang harus berbunyi keras (tidak ada yang bisa masuk),
// bukan gagal-terbuka ke kunci yang sudah bocor.
function getJwtSecret(env) {
  const secret = env?.JWT_SECRET;
  // Tolak juga nilai kosong/whitespace: `JWT_SECRET=""` di dasbor terlihat
  // seperti "sudah diisi", padahal nilainya sama-sama tidak bisa dipakai.
  if (typeof secret !== 'string' || secret.trim() === '') return null;
  return secret;
}

export async function getUserFromSession(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sessionToken = cookies['session_token'] || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!sessionToken) return null;

  // Gagal-tertutup: tanpa secret, TIDAK ADA token yang dianggap sah —
  // termasuk token yang sebelumnya pernah diterbitkan.
  const secret = getJwtSecret(env);
  if (!secret) return null;

  try {
    const [payloadBase64, signature] = sessionToken.split('.');
    if (!payloadBase64 || !signature) return null;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const sigBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payloadBase64));
    
    if (!valid) return null;
    
    const payloadStr = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const user = JSON.parse(payloadStr);
    
    if (user.exp && user.exp < Date.now() / 1000) return null;
    return user;
  } catch (e) {
    return null;
  }
}

export async function createSessionToken(user, env) {
  // Gagal-tertutup. Melempar di sini sengaja: kalau secret tidak ada,
  // login TIDAK BOLEH mengembalikan token yang tampak sah. Melempar
  // membuatnya 500 generik (lihat `catch` di auth/login.js) — keras dan
  // terlihat. Mengembalikan `null` justru berbahaya: pemanggil akan tetap
  // menyetel `session_token=null` pada cookie, yang tampak seperti
  // "login berhasil, sesi kosong" dan jauh lebih sulit dilacak.
  const secret = getJwtSecret(env);
  if (!secret) {
    throw new Error('JWT_SECRET tidak dikonfigurasi');
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

    const payload = {
      id: user.id,
      user_id: user.id,
      user_name: user.full_name || user.name || user.user_name || 'User',
      user_role: user.role || 'Customer',
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
    };

  const payloadBase64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64));
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${payloadBase64}.${signature}`;
}
