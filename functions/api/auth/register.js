// functions/api/auth/register.js
import { getDb, hashPassword, jsonResponse, createSessionToken } from '../../_db.js';

export async function onRequestPost({ request, env }) {
  const db = await getDb(env);
  if (!db) {
    return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);
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

    if (!agree) {
      return jsonResponse({ ok: false, msg: 'Anda harus menyetujui Syarat & Ketentuan' }, 400);
    }

    // Check if email or full_name already exists
    const existing = await db.query(
      `SELECT id FROM users WHERE email = ? OR full_name = ? LIMIT 1`,
      [email, full_name]
    );

    if (existing.length > 0) {
      return jsonResponse({ ok: false, msg: 'Email atau Nama Lengkap sudah terdaftar' }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert new user (always Customer role)
    const result = await db.execute(
      `INSERT INTO users (full_name, email, phone, role, password_hash, created_at)
       VALUES (?, ?, ?, 'Customer', ?, NOW())`,
      [full_name, email, phone || '', passwordHash]
    );

    const userId = result.insertId;
    if (!userId) {
      return jsonResponse({ ok: false, msg: 'Registrasi gagal' }, 500);
    }

    // Create session token
    const user = { id: userId, full_name, email, role: 'Customer' };
    const token = await createSessionToken(user, env);

    const headers = new Headers();
    headers.set('Set-Cookie', `session_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`);

    return new Response(JSON.stringify({
      ok: true,
      user: { id: userId, user_name: full_name, user_role: 'Customer', email }
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...Object.fromEntries(headers.entries())
      }
    });

  } catch (e) {
    return jsonResponse({ ok: false, msg: 'Server error: ' + e.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}