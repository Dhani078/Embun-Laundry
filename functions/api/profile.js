// functions/api/profile.js
import { getDb, jsonResponse, getUserFromSession, hashPassword } from '../_db.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  const user = await getUserFromSession(request, env);
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  if (request.method === 'GET') {
    try {
      const rows = await db.query('SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = ? LIMIT 1', [user.id]);
      if (rows.length === 0) return jsonResponse({ ok: false, msg: 'User not found' }, 404);
      return jsonResponse({ ok: true, user: rows[0] });
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const act = body.action || '';

      if (act === 'update_profile') {
        const name = (body.full_name || '').trim();
        const phone = (body.phone || '').trim();
        if (!name) return jsonResponse({ ok: false, msg: 'Nama wajib diisi' }, 400);

        await db.execute('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [name, phone, user.id]);
        return jsonResponse({ ok: true, user_name: name, phone });
      }

      if (act === 'change_password') {
        const oldPass = body.old_password || '';
        const newPass = body.new_password || '';
        const repPass = body.repeat_password || '';

        if (!newPass || !repPass) return jsonResponse({ ok: false, msg: 'Sandi baru wajib diisi' }, 400);
        if (newPass !== repPass) return jsonResponse({ ok: false, msg: 'Konfirmasi sandi berbeda' }, 400);

        const rows = await db.query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [user.id]);
        if (rows.length === 0) return jsonResponse({ ok: false, msg: 'User not found' }, 404);

        const oldHash = await hashPassword(oldPass);
        if (rows[0].password_hash !== oldPass && rows[0].password_hash !== oldHash) {
          return jsonResponse({ ok: false, msg: 'Sandi lama salah' }, 400);
        }

        const newHash = await hashPassword(newPass);
        await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
        return jsonResponse({ ok: true, msg: 'Sandi berhasil diganti' });
      }

      return jsonResponse({ ok: false, msg: 'Unknown action' }, 400);
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}