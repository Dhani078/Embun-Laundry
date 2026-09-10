// functions/api/services.js
import { getDb, jsonResponse, getUserFromSession, readJson, corsOptions, SERVER_ERROR } from '../_db.js';
import { validateOr400, cleanStr, COL_SPEC } from '../_validate.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  if (request.method === 'OPTIONS') return corsOptions('GET, POST, OPTIONS');

  const user = await getUserFromSession(request, env);
  const isStaff = user && ['Admin', 'Owner', 'Staff'].includes(user.user_role);

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  // GET - list services
  if (request.method === 'GET' && !action) {
    try {
      const q = cleanStr(url.searchParams.get('q') || '').slice(0, 100);
      const cat = cleanStr(url.searchParams.get('cat') || '').slice(0, 50);
      const status = cleanStr(url.searchParams.get('status') || '').slice(0, 20);

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
      if (status === 'aktif') {
        sql += ` AND is_active = 1`;
      } else if (status === 'nonaktif' && isStaff) {
        sql += ` AND is_active = 0`;
      } else if (!isStaff) {
        // Publik secara default hanya melihat layanan yang aktif
        sql += ` AND is_active = 1`;
      }

      sql += ` ORDER BY is_active DESC, id ASC LIMIT 300`;

      const services = await db.query(sql, params);
      return jsonResponse({ ok: true, services });
    } catch (e) {
      return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
    }
  }

  // POST - handle actions
  if (request.method === 'POST') {
    if (!isStaff) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

    try {
      const parsed = await readJson(request);
      if (!parsed.ok) return parsed.response;
      const body = parsed.data;
      const act = body.action || action;

      if (act === 'toggle_active') {
        const v = validateOr400(body, {
          id: { type: 'int', required: true, min: 1, label: 'ID' },
          is_active: { type: 'bool', default: 0, label: 'Status aktif' }
        });
        if (!v.ok) return v.response;
        await db.execute('UPDATE services SET is_active = ?, updated_at = NOW() WHERE id = ?', [v.data.is_active, v.data.id]);
        return jsonResponse({ ok: true });
      }

      if (act === 'create_service') {
        // B2 — nama wajib; harga dan durasi dijaga tidak negatif;
        // panjang semua teks dibatasi supaya tidak ada baris raksasa di TiDB.
        //
        // B16 — batas teks kini mengikuti LEBAR KOLOM TiDB (`_schema.js`),
        // bukan angka yang dikira-kira. Empat di antaranya terbukti terlalu
        // longgar sehingga klien menerima 500, bukan 400 (diukur di
        // produksi: nilai N -> 200, N+1 -> 500):
        //   `name`      120 -> 80   (VARCHAR(80))
        //   `code`       40 -> 20   (VARCHAR(20))
        //   `category`   60 -> 20   (VARCHAR(20))
        //   `badge`      40 -> 30   (VARCHAR(30))
        // `description` sengaja TETAP 1000: kolomnya TEXT, jadi tidak pernah
        // menghasilkan 500, dan memotongnya justru merusak deskripsi sah.
        const v = validateOr400(body, {
          code: COL_SPEC.serviceCode,
          name: COL_SPEC.serviceName,
          description: { type: 'str', max: 1000, label: 'Deskripsi' },
          unit: { type: 'enum', values: ['kg', 'pcs', 'item', 'meter', 'set'], default: 'kg', label: 'Satuan' },
          price: { type: 'int', min: 0, max: 100000000, default: 0, label: 'Harga' },
          est_hours: { type: 'int', min: 0, max: 720, default: 0, label: 'Estimasi jam' },
          category: { ...COL_SPEC.serviceCategory, default: 'Reguler' },
          badge: COL_SPEC.serviceBadge,
          is_active: { type: 'bool', default: 1, label: 'Status aktif' }
        });
        if (!v.ok) return v.response;

        const d = v.data;
        const code = d.code || `SRV-${Date.now().toString(36).toUpperCase().slice(-4)}`;
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute(
          `INSERT INTO services (code, name, description, unit, price, duration_hours, category, is_active, badge, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [code, d.name, d.description, d.unit, d.price, d.est_hours, d.category, d.is_active, d.badge, now, now]
        );

        const newSvc = await db.query('SELECT * FROM services WHERE code = ?', [code]);
        return jsonResponse({ ok: true, service: newSvc[0] });
      }

      if (act === 'update_service') {
        const v = validateOr400(body, {
          id: { type: 'int', required: true, min: 1, label: 'ID' },
          // B16 — batas mengikuti lebar kolom (lihat `create_service`).
          code: { ...COL_SPEC.serviceCode, required: true },
          name: COL_SPEC.serviceName,
          description: { type: 'str', max: 1000, label: 'Deskripsi' },
          unit: { type: 'enum', values: ['kg', 'pcs', 'item', 'meter', 'set'], default: 'kg', label: 'Satuan' },
          price: { type: 'int', min: 0, max: 100000000, default: 0, label: 'Harga' },
          est_hours: { type: 'int', min: 0, max: 720, default: 0, label: 'Estimasi jam' },
          category: { ...COL_SPEC.serviceCategory, default: 'Reguler' },
          badge: COL_SPEC.serviceBadge,
          is_active: { type: 'bool', default: 1, label: 'Status aktif' }
        });
        if (!v.ok) return v.response;

        const d = v.data;
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute(
          `UPDATE services SET code=?, name=?, description=?, unit=?, price=?, duration_hours=?, category=?, is_active=?, badge=?, updated_at=? WHERE id=?`,
          [d.code, d.name, d.description, d.unit, d.price, d.est_hours, d.category, d.is_active, d.badge, now, d.id]
        );

        return jsonResponse({ ok: true });
      }

      if (act === 'delete_service') {
        const v = validateOr400(body, { id: { type: 'int', required: true, min: 1, label: 'ID' } });
        if (!v.ok) return v.response;
        await db.execute('DELETE FROM services WHERE id = ?', [v.data.id]);
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: false, msg: 'Unknown action' }, 400);
    } catch (e) {
      return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}