// functions/api/auth/refresh.js
import { getDb, jsonResponse, getUserFromSession, createSessionToken, SERVER_ERROR } from '../../_db.js';

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);
    }

    const userId = user.id || user.user_id;
    const db = await getDb(env);
    if (!db) {
      return jsonResponse({ ok: false, msg: 'Database tidak terhubung' }, 500);
    }

    const users = await db.query(
      'SELECT id, full_name, email, phone, role, session_version FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!users || users.length === 0) {
      return jsonResponse({ ok: false, msg: 'Pengguna tidak ditemukan' }, 401);
    }

    const dbUser = users[0];
    const token = await createSessionToken(dbUser, env);

    const headers = new Headers();
    headers.set('Set-Cookie', `session_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`);

    return new Response(JSON.stringify({
      ok: true,
      msg: 'Token berhasil diperbarui',
      token,
      user: {
        id: dbUser.id,
        user_name: dbUser.full_name,
        user_role: dbUser.role,
        email: dbUser.email
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...Object.fromEntries(headers.entries())
      }
    });
  } catch (e) {
    return jsonResponse(SERVER_ERROR, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
