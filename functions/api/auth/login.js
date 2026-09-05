// functions/api/auth/login.js
import { getDb, hashPassword, jsonResponse, getUserFromSession, createSessionToken } from '../../_db.js';

export async function onRequestPost({ request, env }) {
  const db = await getDb(env);
  if (!db) {
    return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);
  }

  try {
    const body = await request.json();
    const { identity, password } = body;

    if (!identity || !password) {
      return jsonResponse({ ok: false, msg: 'Identity and password required' }, 400);
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
  // For bcrypt hashes, we'd need bcrypt. For now, simple comparison
  // In production, use bcrypt or similar
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'dhani-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Check both hash formats
  return hash === password || hash === computedHash;
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