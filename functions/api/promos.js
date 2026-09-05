// functions/api/promos.js
import { getDb, jsonResponse, getUserFromSession } from '../_db.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  const user = await getUserFromSession(request, env);
  const isStaff = user && ['Admin', 'Owner', 'Staff'].includes(user.user_role);

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  if (request.method === 'GET' && !action) {
    try {
      const q = url.searchParams.get('q') || '';
      const active = url.searchParams.get('active') || '';

      let sql = `SELECT * FROM promos WHERE 1=1`;
      const params = [];

      if (q) {
        sql += ` AND (code LIKE ? OR name LIKE ?)`;
        const likeQ = `%${q}%`;
        params.push(likeQ, likeQ);
      }
      if (active === 'true') sql += ` AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())`;
      if (active === 'false') sql += ` AND (is_active = 0 OR (expires_at IS NOT NULL AND expires_at <= NOW()))`;

      sql += ` ORDER BY created_at DESC LIMIT 300`;

      const promos = await db.query(sql, params);
      return jsonResponse({ ok: true, promos });
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    if (!isStaff) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

    try {
      const body = await request.json();
      const act = body.action || action;

      if (act === 'create_promo') {
        const code = (body.code || `PROMO-${Date.now().toString(36).toUpperCase().slice(-6)}`).toUpperCase();
        const name = body.name || '';
        const type = body.type || 'percent';
        const value = Math.max(0, parseInt(body.value) || 0);
        const minSpend = Math.max(0, parseInt(body.min_spend) || 0);
        const maxDisc = Math.max(0, parseInt(body.max_discount) || 0);
        const expires = body.expires_at || null;
        const active = parseInt(body.is_active) || 1;

        if (!name) return jsonResponse({ ok: false, msg: 'Nama wajib diisi' }, 400);
        if (!['percent', 'nominal'].includes(type)) return jsonResponse({ ok: false, msg: 'Tipe invalid' }, 400);

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute(
          `INSERT INTO promos (code, name, type, value, min_spend, max_discount, is_active, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [code, name, type, value, minSpend, maxDisc, active, expires, now, now]
        );

        const newP = await db.query('SELECT * FROM promos WHERE code = ?', [code]);
        return jsonResponse({ ok: true, promo: newP[0] });
      }

      if (act === 'update_promo') {
        const id = parseInt(body.id) || 0;
        if (!id) return jsonResponse({ ok: false, msg: 'Invalid id' }, 400);

        const code = (body.code || '').toUpperCase();
        const name = body.name || '';
        const type = body.type || 'percent';
        const value = Math.max(0, parseInt(body.value) || 0);
        const minSpend = Math.max(0, parseInt(body.min_spend) || 0);
        const maxDisc = Math.max(0, parseInt(body.max_discount) || 0);
        const expires = body.expires_at || null;
        const active = parseInt(body.is_active) || 1;

        if (!name || !code) return jsonResponse({ ok: false, msg: 'Data tidak lengkap' }, 400);
        if (!['percent', 'nominal'].includes(type)) return jsonResponse({ ok: false, msg: 'Tipe invalid' }, 400);

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute(
          `UPDATE promos SET code=?, name=?, type=?, value=?, min_spend=?, max_discount=?, is_active=?, expires_at=?, updated_at=? WHERE id=?`,
          [code, name, type, value, minSpend, maxDisc, active, expires, now, id]
        );

        return jsonResponse({ ok: true });
      }

      if (act === 'delete_promo') {
        const id = parseInt(body.id) || 0;
        if (!id) return jsonResponse({ ok: false, msg: 'Invalid id' }, 400);
        await db.execute('DELETE FROM promos WHERE id = ?', [id]);
        return jsonResponse({ ok: true });
      }

      if (act === 'toggle_active') {
        const id = parseInt(body.id) || 0;
        const val = parseInt(body.is_active) || 0;
        await db.execute('UPDATE promos SET is_active = ?, updated_at = NOW() WHERE id = ?', [val, id]);
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: false, msg: 'Unknown action' }, 400);
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}