// functions/api/auth/register.js
import { getDb, hashPassword, jsonResponse, createSessionToken } from '../../_db.js';

export async function onRequestPost({ request, env }) {
  const db = await getDb(env);
  if (!db) {
    return jsonResponse({ ok: false, msg: 'Database tidak terhubung' }, 500);
  }

  try {
    const body = await request.json();
    const { full_name, email, phone, password, confirm, agree } = body;

    if (!full_name || !email || !password) {
      return jsonResponse({ ok: false, msg: 'Nama lengkap, email, dan kata sandi wajib diisi' }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ ok: false, msg: 'Format email tidak valid' }, 400);
    }

    if (password !== confirm) {
      return jsonResponse({ ok: false, msg: 'Konfirmasi sandi tidak sama' }, 400);
    }

    if (agree === false) {
      return jsonResponse({ ok: false, msg: 'Anda harus menyetujui Syarat & Ketentuan' }, 400);
    }

    // Check if email already exists
    const existing = await db.query(
      `SELECT id FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (existing.length > 0) {
      return jsonResponse({ ok: false, msg: 'Email sudah terdaftar. Silakan gunakan email lain atau masuk.' }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert new user (always Customer role)
    await db.execute(
      `INSERT INTO users (full_name, email, phone, role, password_hash, created_at)
       VALUES (?, ?, ?, 'Customer', ?, NOW())`,
      [full_name, email, phone || '', passwordHash]
    );

    // Fetch newly created user
    const newlyCreated = await db.query(
      `SELECT id, full_name, email, role FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (newlyCreated.length === 0) {
      return jsonResponse({ ok: false, msg: 'Registrasi gagal dibuat' }, 500);
    }

    const user = newlyCreated[0];
    const userId = user.id;

    // Create customer record if customers table exists
    try {
      const custCode = 'CUST-' + Math.floor(1000 + Math.random() * 9000);
      await db.execute(
        `INSERT INTO customers (code, full_name, phone, address, tag, created_at, updated_at)
         VALUES (?, ?, ?, '', 'Baru', NOW(), NOW())`,
        [custCode, full_name, phone || '']
      );
    } catch (e) {
      // Ignore if customer entry fails
    }

    // Create session token
    const token = await createSessionToken(user, env);

    const headers = new Headers();
    headers.set('Set-Cookie', `session_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`);

    return new Response(JSON.stringify({
      ok: true,
      msg: 'Registrasi berhasil!',
      user: { id: userId, user_name: full_name, user_role: 'Customer', email }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...Object.fromEntries(headers.entries())
      }
    });

  } catch (e) {
    return jsonResponse({ ok: false, msg: 'Terjadi kesalahan: ' + e.message }, 500);
  }
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
