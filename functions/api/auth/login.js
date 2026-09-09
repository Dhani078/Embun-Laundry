// functions/api/auth/login.js
import { getDb, hashPassword, jsonResponse, createSessionToken, readJson } from '../../_db.js';
import { clientKey, hit, peek, reset } from '../../_ratelimit.js';

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

export async function onRequestPost({ request, env }) {
  // Cegah brute-force SEBELUM menyentuh database — percobaan yang ditolak
  // tidak boleh menghabiskan koneksi DB.
  const key = `login:${clientKey(request)}`;
  const rl = hit(key, RL_OPTS);
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
    const { identity, password } = body;

    if (!identity || !password) {
      return reply(key, { ok: false, msg: 'Identitas dan kata sandi wajib diisi' }, 400);
    }

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

    // Catatan urutan: reset DULU, lalu tempel header. Kalau dibalik,
    // header akan melaporkan sisa 0 pada login yang justru berhasil.
    reset(key);
    return withRateHeaders(res, RL_LIMIT);
  } catch (e) {
    return reply(key, { ok: false, msg: 'Server error: ' + e.message }, 500);
  }
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  
  // 1. bcrypt - check if hash starts with $2y$, $2a$, $2b$
  if (hash.startsWith('$2')) {
    // Use Web Crypto API for bcrypt is not available natively
    // We'll use a simple check - for now use node's bcrypt if available
    // But in Cloudflare Workers, we need to use a compatible approach
    // For simplicity, we'll check using a custom implementation or use a library
    // Since we can't easily do bcrypt in Workers without a library,
    // let's check if we can use the existing password check logic
    // Actually, let's use the crypto.subtle with PBKDF2 or just add bcryptjs
    // But Workers don't have node bcrypt. Let's use a WASM bcrypt or just check
    // For now, let me add a simple bcrypt verification using a small implementation
    try {
      // Try to use bcryptjs if available in the worker
      const bcrypt = await import('bcryptjs');
      return await bcrypt.compare(password, hash);
    } catch (e) {
      // Fallback: direct compare for testing
      // In production, bcryptjs should be bundled
      return false;
    }
  }
  
  // 2. Direct match (plain text or legacy seeds)
  if (password === hash) return true;
  
  // 3. SHA-256 match with salt
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'dhani-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  if (computedHash === hash) return true;
  
  // 4. Fallback for simple SHA-256 without salt
  const data2 = encoder.encode(password);
  const hashBuffer2 = await crypto.subtle.digest('SHA-256', data2);
  const computedHash2 = Array.from(new Uint8Array(hashBuffer2)).map(b => b.toString(16).padStart(2, '0')).join('');
  if (computedHash2 === hash) return true;
  
  return false;
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
