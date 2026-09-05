// functions/api/services.js
import { getDb, jsonResponse, getUserFromSession } from '../_db.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  const user = await getUserFromSession(request, env);
  const isStaff = user && ['Admin', 'Owner', 'Staff'].includes(user.user_role);

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  // GET - list services
  if (request.method === 'GET' && !action) {
    try {
      const q = url.searchParams.get('q') || '';
      const cat = url.searchParams.get('cat') || '';
      const status = url.searchParams.get('status') || '';

      let sql = `SELECT * FROM services WHERE 1=1`;
      const params = [];

      if (q) {
        sql += ` AND (code LIKE ? OR name LIKE ? OR description LIKE ?)`;
        const likeQ = `%${q}%`;
        params.push(likeQ, likeQ, likeQ);
      }
      if (cat) {
        sql += ` AND category = ?`;
        params.push(cat);
      }
      if (status === 'aktif') sql += ` AND is_active = 1`;
      if (status === 'nonaktif') sql += ` AND is_active = 0`;

      sql += ` ORDER BY is_active DESC, id ASC LIMIT 300`;

      const services = await db.query(sql, params);
      return jsonResponse({ ok: true, services });
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  // POST - handle actions
  if (request.method === 'POST') {
    if (!isStaff) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

    try {
      const body = await request.json();
      const act = body.action || action;

      if (act === 'toggle_active') {
        const id = parseInt(body.id) || 0;
        const val = parseInt(body.is_active) || 0;
        await db.execute('UPDATE services SET is_active = ?, updated_at = NOW() WHERE id = ?', [val, id]);
        return jsonResponse({ ok: true });
      }

      if (act === 'create_service') {
        const code = body.code || `SRV-${Date.now().toString(36).toUpperCase().slice(-4)}`;
        const name = body.name || '';
        const description = body.description || '';
        const unit = body.unit || 'kg';
        const price = Math.max(0, parseInt(body.price) || 0);
        const hours = Math.max(0, parseInt(body.est_hours) || 0);
        const cat = body.category || 'Reguler';
        const badge = body.badge || '';
        const active = parseInt(body.is_active) || 1;

        if (!name) return jsonResponse({ ok: false, msg: 'Nama wajib diisi' }, 400);

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute(
          `INSERT INTO services (code, name, description, unit, price, duration_hours, category, is_active, badge, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [code, name, description, unit, price, hours, cat, active, badge, now, now]
        );

        const newSvc = await db.query('SELECT * FROM services WHERE code = ?', [code]);
        return jsonResponse({ ok: true, service: newSvc[0] });
      }

      if (act === 'update_service') {
        const id = parseInt(body.id) || 0;
        if (!id) return jsonResponse({ ok: false, msg: 'Invalid id' }, 400);

        const code = body.code || '';
        const name = body.name || '';
        const description = body.description || '';
        const unit = body.unit || 'kg';
        const price = Math.max(0, parseInt(body.price) || 0);
        const hours = Math.max(0, parseInt(body.est_hours) || 0);
        const cat = body.category || 'Reguler';
        const badge = body.badge || '';
        const active = parseInt(body.is_active) || 1;

        if (!name) return jsonResponse({ ok: false, msg: 'Nama wajib diisi' }, 400);

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute(
          `UPDATE services SET code=?, name=?, description=?, unit=?, price=?, duration_hours=?, category=?, is_active=?, badge=?, updated_at=? WHERE id=?`,
          [code, name, description, unit, price, hours, cat, active, badge, now, id]
        );

        return jsonResponse({ ok: true });
      }

      if (act === 'delete_service') {
        const id = parseInt(body.id) || 0;
        if (!id) return jsonResponse({ ok: false, msg: 'Invalid id' }, 400);
        await db.execute('DELETE FROM services WHERE id = ?', [id]);
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: false, msg: 'Unknown action' }, 400);
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}