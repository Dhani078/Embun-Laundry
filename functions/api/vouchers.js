// functions/api/vouchers.js
import { getDb, jsonResponse, getUserFromSession } from '../_db.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  const user = await getUserFromSession(request, env);
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  const isStaff = ['Admin', 'Owner', 'Staff'].includes(user.user_role);
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  if (request.method === 'GET' && !action) {
    try {
      const q = url.searchParams.get('q') || '';
      let sql, params;

      if (isStaff) {
        sql = `SELECT uv.*, p.code as promo_code, p.name as promo_name, p.type, p.value, p.min_spend, p.max_discount, p.expires_at as promo_expires
               FROM user_vouchers uv
               JOIN promos p ON p.id = uv.promo_id
               WHERE 1=1`;
        params = [];
      } else {
        sql = `SELECT uv.*, p.code as promo_code, p.name as promo_name, p.type, p.value, p.min_spend, p.max_discount, p.expires_at as promo_expires
               FROM user_vouchers uv
               JOIN promos p ON p.id = uv.promo_id
               WHERE uv.user_id = ?`;
        params = [user.id];
      }

      if (q) {
        sql += ` AND (p.code LIKE ? OR p.name LIKE ? OR uv.code LIKE ?)`;
        const likeQ = `%${q}%`;
        params.push(likeQ, likeQ, likeQ);
      }

      sql += ` ORDER BY uv.created_at DESC LIMIT 300`;

      const vouchers = await db.query(sql, params);
      return jsonResponse({ ok: true, vouchers });
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    if (!isStaff) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

    try {
      const body = await request.json();
      const act = body.action || action;

      if (act === 'claim') {
        const promoId = parseInt(body.promo_id) || 0;
        const userId = parseInt(body.user_id) || user.id;
        if (!promoId) return jsonResponse({ ok: false, msg: 'Promo ID wajib' }, 400);

        const promo = await db.query('SELECT * FROM promos WHERE id = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())', [promoId]);
        if (promo.length === 0) return jsonResponse({ ok: false, msg: 'Promo tidak valid/expired' }, 400);
        const p = promo[0];

        // Check if user already has this promo voucher unused
        const existing = await db.query(
          `SELECT * FROM user_vouchers WHERE user_id = ? AND promo_id = ? AND used_at IS NULL LIMIT 1`,
          [userId, promoId]
        );
        if (existing.length > 0) return jsonResponse({ ok: false, msg: 'User sudah memiliki voucher ini' }, 400);

        const code = 'VOU-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await db.execute(
          `INSERT INTO user_vouchers (user_id, promo_id, code, name, type, value, min_spend, max_discount, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, promoId, code, p.name, p.type, p.value, p.min_spend, p.max_discount, p.expires_at, now]
        );

        const newV = await db.query('SELECT * FROM user_vouchers WHERE code = ?', [code]);
        return jsonResponse({ ok: true, voucher: newV[0] });
      }

      if (act === 'bulk_claim') {
        const promoId = parseInt(body.promo_id) || 0;
        const userIds = Array.isArray(body.user_ids) ? body.user_ids : [];
        if (!promoId || userIds.length === 0) return jsonResponse({ ok: false, msg: 'Data tidak lengkap' }, 400);

        const promo = await db.query('SELECT * FROM promos WHERE id = ? AND is_active = 1', [promoId]);
        if (promo.length === 0) return jsonResponse({ ok: false, msg: 'Promo tidak valid' }, 400);
        const p = promo[0];

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        let created = 0;
        for (const uid of userIds) {
          const exists = await db.query('SELECT 1 FROM user_vouchers WHERE user_id = ? AND promo_id = ? AND used_at IS NULL', [uid, promoId]);
          if (exists.length === 0) {
            const code = 'VOU-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
            await db.execute(
              `INSERT INTO user_vouchers (user_id, promo_id, code, name, type, value, min_spend, max_discount, expires_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [uid, promoId, code, p.name, p.type, p.value, p.min_spend, p.max_discount, p.expires_at, now]
            );
            created++;
          }
        }
        return jsonResponse({ ok: true, created });
      }

      if (act === 'create_voucher') {
        const promoId = parseInt(body.promo_id) || 0;
        const userId = parseInt(body.user_id) || 0;
        if (!promoId || !userId) return jsonResponse({ ok: false, msg: 'Promo ID & User ID wajib' }, 400);

        const promo = await db.query('SELECT * FROM promos WHERE id = ?', [promoId]);
        if (promo.length === 0) return jsonResponse({ ok: false, msg: 'Promo tidak ditemukan' }, 404);
        const p = promo[0];

        const code = 'VOU-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await db.execute(
          `INSERT INTO user_vouchers (user_id, promo_id, code, name, type, value, min_spend, max_discount, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, promoId, code, p.name, p.type, p.value, p.min_spend, p.max_discount, p.expires_at, now]
        );

        const newV = await db.query('SELECT * FROM user_vouchers WHERE code = ?', [code]);
        return jsonResponse({ ok: true, voucher: newV[0] });
      }

      if (act === 'delete_voucher') {
        const id = parseInt(body.id) || 0;
        if (!id) return jsonResponse({ ok: false, msg: 'Invalid id' }, 400);
        await db.execute('DELETE FROM user_vouchers WHERE id = ?', [id]);
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: false, msg: 'Unknown action' }, 400);
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}