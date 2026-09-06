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
