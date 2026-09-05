// functions/api/auth/login.js
import { getDb, hashPassword, jsonResponse, createSessionToken } from '../../_db.js';

export async function onRequestPost({ request, env }) {
  const db = await getDb(env);
  if (!db) {
    return jsonResponse({ ok: false, msg: 'Database tidak terhubung' }, 500);
  }

  try {
    const body = await request.json();
    const { identity, password } = body;

    if (!identity || !password) {
      return jsonResponse({ ok: false, msg: 'Identitas dan kata sandi wajib diisi' }, 400);
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
      return jsonResponse({ ok: false, msg: 'Akun tidak ditemukan' }, 401);
    }

    const user = users[0];
    
    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return jsonResponse({ ok: false, msg: 'Kata sandi salah' }, 401);
    }

    // Create session token
    const token = await createSessionToken(user, env);

    // Set cookie header
    const headers = new Headers();
    headers.set('Set-Cookie', `session_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`);

    return new Response(JSON.stringify({
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

  } catch (e) {
    return jsonResponse({ ok: false, msg: 'Server error: ' + e.message }, 500);
  }
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  // 1. Direct match (plain text or legacy seeds)
  if (password === hash) return true;

  // 2. SHA-256 match
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'dhani-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  if (computedHash === hash) return true;

  // 3. Fallback for simple SHA-256 without salt
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
