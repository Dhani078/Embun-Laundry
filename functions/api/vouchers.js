// functions/api/vouchers.js
import { getDb, jsonResponse, getUserFromSession, readJson, corsOptions } from '../_db.js';
import { validateOr400, cleanStr } from '../_validate.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  if (request.method === 'OPTIONS') return corsOptions('GET, POST, OPTIONS');

  const user = await getUserFromSession(request, env);
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  const isStaff = ['Admin', 'Owner', 'Staff'].includes(user.user_role);
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  if (request.method === 'GET' && !action) {
    try {
      const q = cleanStr(url.searchParams.get('q') || '').slice(0, 100);
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
      const parsed = await readJson(request);
      if (!parsed.ok) return parsed.response;
      const body = parsed.data;
      const act = body.action || action;

      if (act === 'claim') {
        const v = validateOr400(body, {
          promo_id: { type: 'int', required: true, min: 1, label: 'Promo ID' },
          user_id: { type: 'int', min: 1, max: 2147483647, label: 'User ID' }
        });
        if (!v.ok) return v.response;
        const promoId = v.data.promo_id;
        const userId = v.data.user_id || user.id;

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
        const v = validateOr400(body, { promo_id: { type: 'int', required: true, min: 1, label: 'Promo ID' } });
        if (!v.ok) return v.response;
        const promoId = v.data.promo_id;

        // B2 — daftar id harus berupa angka bulat valid, maksimal 500 sekaligus
        // (mencegah satu permintaan yang mengunci baris dalam jumlah besar).
        const rawIds = Array.isArray(body.user_ids) ? body.user_ids : [];
        if (rawIds.length === 0) return jsonResponse({ ok: false, msg: 'Data tidak lengkap' }, 400);
        if (rawIds.length > 500) return jsonResponse({ ok: false, msg: 'Validasi gagal: Maksimal 500 pengguna sekali klaim' }, 400);
        const userIds = [];
        for (const uid of rawIds) {
          const n = Number(uid);
          if (!Number.isInteger(n) || n < 1 || n > 2147483647) {
            return jsonResponse({ ok: false, msg: 'Validasi gagal: Daftar pengguna tidak valid' }, 400);
          }
          userIds.push(n);
        }

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
        const v = validateOr400(body, {
          promo_id: { type: 'int', required: true, min: 1, label: 'Promo ID' },
          user_id: { type: 'int', required: true, min: 1, label: 'User ID' }
        });
        if (!v.ok) return v.response;
        const { promo_id: promoId, user_id: userId } = v.data;

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
        const v = validateOr400(body, { id: { type: 'int', required: true, min: 1, label: 'ID' } });
        if (!v.ok) return v.response;
        await db.execute('DELETE FROM user_vouchers WHERE id = ?', [v.data.id]);
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: false, msg: 'Unknown action' }, 400);
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}