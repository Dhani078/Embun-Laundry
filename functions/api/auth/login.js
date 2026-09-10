// functions/api/auth/login.js
import { getDb, jsonResponse, createSessionToken, readJson, SERVER_ERROR } from '../../_db.js';
import { clientKey, consume, peek, clearAll } from '../../_ratelimit.js';
import { validateOr400 } from '../../_validate.js';
// B8 — verifikasi sandi kini PBKDF2 (dengan fallback ke format lawas).
import { verifyPassword, isPbkdf2Hash, hashPassword } from '../../_password.js';

// B1 — rate limit: 10 percobaan / 5 menit / IP.
const RL_LIMIT = 10;
const RL_WINDOW_MS = 5 * 60 * 1000;
const RL_OPTS = { limit: RL_LIMIT, windowMs: RL_WINDOW_MS };

/**
 * Tempel header informasi rate limit ke sebuah Response.
 * Dipakai agar klien yang patuh bisa melihat sisa jatahnya.
 */
function withRateHeaders(res, remaining, retryAfter) {
  res.headers.set('X-RateLimit-Limit', String(RL_LIMIT));
  res.headers.set('X-RateLimit-Remaining', String(remaining));
  if (retryAfter != null) res.headers.set('Retry-After', String(retryAfter));
  return res;
}

/**
 * Balas dengan header rate limit yang angkanya DIUKUR, bukan ditebak.
 *
 * `peek()` membaca ulang keadaan counter saat ini, jadi
 * `X-RateLimit-Remaining` selalu cocok dengan kenyataan — termasuk pada
 * jalur sukses dan jalur error.
 */
function reply(key, data, status, retryAfter = null) {
  const { remaining } = peek(key, RL_OPTS);
  return withRateHeaders(jsonResponse(data, status), remaining, retryAfter);
}

export async function onRequestPost({ request, env, ctx }) {
  // Cegah brute-force SEBELUM menyentuh database — percobaan yang ditolak
  // tidak boleh menghabiskan koneksi DB.
  const key = `login:${clientKey(request)}`;
  const rl = await consume(key, RL_OPTS);
  if (!rl.ok) {
    return reply(
      key,
      { ok: false, msg: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
      429,
      rl.retryAfter
    );
  }

  try {
    // Urutan penting: baca & validasi body DULU, baru sambung ke DB.
    // Kalau DB dicek lebih dulu, body yang rusak akan berubah menjadi 500
    // "Database tidak terhubung" padahal masalahnya ada di klien (400).
    const parsed = await readJson(request);
    if (!parsed.ok) {
      const detail = await parsed.response.json();
      return reply(key, { ok: false, msg: detail.msg }, parsed.response.status);
    }
    const body = parsed.data;

    // B2 — identitas & kata sandi dibatasi panjangnya. Nilainya tetap
    // ter-parameterisasi (B7), tetapi tanpa batas ini sebuah string 1 MB
    // bisa dikirim mentah ke TiDB pada setiap percobaan login.
    const v = validateOr400(body, {
      identity: { type: 'str', required: true, min: 2, max: 160, label: 'Identitas' },
      // 'raw': sandi TIDAK dibersihkan — hanya panjangnya yang dibatasi.
      password: { type: 'raw', required: true, min: 1, max: 200, label: 'Kata sandi' }
    });
    if (!v.ok) {
      const detail = await v.response.json();
      return reply(key, { ok: false, msg: detail.msg }, v.response.status);
    }
    const { identity, password } = v.data;

    const db = await getDb(env);
    if (!db) {
      return reply(key, { ok: false, msg: 'Database tidak terhubung' }, 500);
    }

    // Find user by email, phone, or full_name
    const users = await db.query(
      `SELECT id, full_name, email, phone, password_hash, role 
       FROM users 
       WHERE email = ? OR phone = ? OR full_name = ? 
       LIMIT 1`,
      [identity, identity, identity]
    );

    if (users.length === 0) {
      return reply(key, { ok: false, msg: 'Akun tidak ditemukan' }, 401);
    }

    const user = users[0];
    
    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return reply(key, { ok: false, msg: 'Kata sandi salah' }, 401);
    }

    // --- B8 — LAZY UPGRADE -------------------------------------------------
    // Login sah dengan hash LAWAS (SHA-256 + salt global) → tulis ulang ke
    // PBKDF2. Ini jalur migrasi tanpa downtime: pengguna tidak perlu ganti
    // sandi, tidak ada skrip massal, dan hash lama tidak dibuang sampai
    // pemiliknya benar-benar pernah login lagi.
    //
    // Dilewatkan ke `ctx.waitUntil()` agar tidak menahan respons login:
    // gagal tulis tidak boleh membuat login gagal (pengguna sudah sah).
    if (!isPbkdf2Hash(user.password_hash)) {
      ctx?.waitUntil?.(
        hashPassword(password)
          .then(newHash =>
            db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id])
          )
          .catch(() => {})   // diam: upgrade akan dicoba lagi pada login berikutnya
      );
    }
    // -----------------------------------------------------------------------

    // Create session token
    const token = await createSessionToken(user, env);

    // Login sah -> bersihkan jatah supaya pengguna yang tadi salah ketik
    // beberapa kali tidak terkunci pada kali berikutnya ia butuh masuk.
    const headers = new Headers();
    headers.set('Set-Cookie', `session_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`);

    const res = new Response(JSON.stringify({
      ok: true,
      msg: 'Login berhasil',
      user: {
        id: user.id,
        user_name: user.full_name,
        user_role: user.role,
        email: user.email
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...Object.fromEntries(headers.entries())
      }
    });

    // Catatan urutan: bersihkan DULU, lalu tempel header. Kalau dibalik,
    // header akan melaporkan sisa 0 pada login yang justru berhasil.
    // Tidak di-await: membersihkan jatah tidak boleh menahan respons login.
    ctx?.waitUntil?.(clearAll(key));
    return withRateHeaders(res, RL_LIMIT);
  } catch (e) {
    return reply(key, { ok: false, msg: SERVER_ERROR }, 500);
  }
}

// Catatan B8: `verifyPassword()` PINDAH ke `functions/_password.js` bersama
// `hashPassword()`. Dulu ada dua salinan algoritma (satu di `_db.js`, satu di
// sini) yang bisa menyimpang tanpa ketahuan — kini hanya ada satu sumber.

export async function onRequestOptions() {
  // B5: `Access-Control-Allow-Origin: *` DIHAPUS. Header yang bergantung
  // pada origin dipasang terpusat oleh applyCors() di src/index.js.
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
