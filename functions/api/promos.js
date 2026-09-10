// functions/api/promos.js
import { getDb, jsonResponse, getUserFromSession, readJson, corsOptions, SERVER_ERROR } from '../_db.js';
import { validateOr400, cleanStr } from '../_validate.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  if (request.method === 'OPTIONS') return corsOptions('GET, POST, OPTIONS');

  const user = await getUserFromSession(request, env);
  const isStaff = user && ['Admin', 'Owner', 'Staff'].includes(user.user_role);

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  if (request.method === 'GET' && !action) {
    try {
      const q = cleanStr(url.searchParams.get('q') || '').slice(0, 100);
      const active = cleanStr(url.searchParams.get('active') || '').slice(0, 10);

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
      return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
    }
  }

  if (request.method === 'POST') {
    if (!isStaff) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

    try {
      const parsed = await readJson(request);
      if (!parsed.ok) return parsed.response;
      const body = parsed.data;
      const act = body.action || action;

      if (act === 'create_promo') {
        // B2 — tipe promo wajib salah satu dari enum; nilai nominal tak boleh
        // negatif; `expires_at` harus berformat tanggal/waktu jika diberikan.
        const v = validateOr400(body, {
          code: { type: 'str', max: 40, label: 'Kode' },
          name: { type: 'str', required: true, min: 2, max: 120, label: 'Nama' },
          type: { type: 'enum', values: ['percent', 'nominal'], default: 'percent', label: 'Tipe' },
          value: { type: 'int', min: 0, max: 100000000, default: 0, label: 'Nilai' },
          min_spend: { type: 'int', min: 0, max: 1000000000, default: 0, label: 'Minimal belanja' },
          max_discount: { type: 'int', min: 0, max: 1000000000, default: 0, label: 'Maksimal diskon' },
          expires_at: { type: 'str', max: 32, label: 'Tanggal kedaluwarsa' },
          is_active: { type: 'bool', default: 1, label: 'Status aktif' }
        });
        if (!v.ok) return v.response;

        // Untuk tipe 'percent', nilai di atas 100 jelas salah input — bukan
        // sekadar "besar", tetapi mustahil secara bisnis.
        if (v.data.type === 'percent' && v.data.value > 100) {
          return jsonResponse({ ok: false, msg: 'Validasi gagal: Nilai persen maksimal 100' }, 400);
        }

        const d = v.data;
        const code = (d.code || `PROMO-${Date.now().toString(36).toUpperCase().slice(-6)}`).toUpperCase();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute(
          `INSERT INTO promos (code, name, type, value, min_spend, max_discount, is_active, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [code, d.name, d.type, d.value, d.min_spend, d.max_discount, d.is_active, d.expires_at || null, now, now]
        );

        const newP = await db.query('SELECT * FROM promos WHERE code = ?', [code]);
        return jsonResponse({ ok: true, promo: newP[0] });
      }

      if (act === 'update_promo') {
        const v = validateOr400(body, {
          id: { type: 'int', required: true, min: 1, label: 'ID' },
          code: { type: 'str', required: true, max: 40, label: 'Kode' },
          name: { type: 'str', required: true, min: 2, max: 120, label: 'Nama' },
          type: { type: 'enum', values: ['percent', 'nominal'], default: 'percent', label: 'Tipe' },
          value: { type: 'int', min: 0, max: 100000000, default: 0, label: 'Nilai' },
          min_spend: { type: 'int', min: 0, max: 1000000000, default: 0, label: 'Minimal belanja' },
          max_discount: { type: 'int', min: 0, max: 1000000000, default: 0, label: 'Maksimal diskon' },
          expires_at: { type: 'str', max: 32, label: 'Tanggal kedaluwarsa' },
          is_active: { type: 'bool', default: 1, label: 'Status aktif' }
        });
        if (!v.ok) return v.response;
        if (v.data.type === 'percent' && v.data.value > 100) {
          return jsonResponse({ ok: false, msg: 'Validasi gagal: Nilai persen maksimal 100' }, 400);
        }

        const d = v.data;
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute(
          `UPDATE promos SET code=?, name=?, type=?, value=?, min_spend=?, max_discount=?, is_active=?, expires_at=?, updated_at=? WHERE id=?`,
          [d.code.toUpperCase(), d.name, d.type, d.value, d.min_spend, d.max_discount, d.is_active, d.expires_at || null, now, d.id]
        );

        return jsonResponse({ ok: true });
      }

      if (act === 'delete_promo') {
        const v = validateOr400(body, { id: { type: 'int', required: true, min: 1, label: 'ID' } });
        if (!v.ok) return v.response;
        await db.execute('DELETE FROM promos WHERE id = ?', [v.data.id]);
        return jsonResponse({ ok: true });
      }

      if (act === 'toggle_active') {
        const v = validateOr400(body, {
          id: { type: 'int', required: true, min: 1, label: 'ID' },
          is_active: { type: 'bool', default: 0, label: 'Status aktif' }
        });
        if (!v.ok) return v.response;
        await db.execute('UPDATE promos SET is_active = ?, updated_at = NOW() WHERE id = ?', [v.data.is_active, v.data.id]);
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: false, msg: 'Unknown action' }, 400);
    } catch (e) {
      return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}