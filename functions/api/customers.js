// functions/api/customers.js
import { getDb, jsonResponse, getUserFromSession, readJson, corsOptions, SERVER_ERROR } from '../_db.js';
import { validateOr400, cleanStr, COL_SPEC } from '../_validate.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  if (request.method === 'OPTIONS') return corsOptions('GET, POST, OPTIONS');

  const user = await getUserFromSession(request, env);

  // B10 — ISOLASI DATA (IDOR). Daftar pelanggan berisi PII (nama, telepon,
  // alamat) dan tidak pernah dimaksudkan untuk umum: satu-satunya pemanggil
  // adalah halaman Pelanggan di dashboard, yang cuma ditautkan untuk staf.
  // Sebelumnya `isStaff` hanya dipakai untuk menolak POST, sehingga
  // permintaan anonim (dan akun Customer biasa) tetap menerima SELURUH baris.
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  const isStaff = ['Admin', 'Owner', 'Staff'].includes(user.user_role);

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  if (request.method === 'GET' && !isStaff) {
    return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);
  }

  if (request.method === 'GET' && !action) {
    try {
      // B2 — batasi panjang query pencarian; nilainya tetap ter-parameterisasi
      // (B7), tetapi pembatasan ini mencegah pemindaian LIKE raksasa.
      const q = cleanStr(url.searchParams.get('q') || '').slice(0, 100);
      const tag = cleanStr(url.searchParams.get('tag') || '').slice(0, 40);

      let sql = `
        SELECT c.*,
          (SELECT COUNT(*) FROM orders o WHERE o.customer_name = c.full_name) AS orders_count,
          (SELECT COALESCE(SUM(total_amount),0) FROM orders o WHERE o.customer_name = c.full_name) AS total_spent,
          (SELECT MAX(created_at) FROM orders o WHERE o.customer_name = c.full_name) AS last_order_at,
          (SELECT MIN(created_at) FROM orders o WHERE o.customer_name = c.full_name) AS first_order_at
        FROM customers c
        WHERE 1=1
      `;
      const params = [];

      if (q) {
        sql += ` AND (c.code LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ?)`;
        const likeQ = `%${q}%`;
        params.push(likeQ, likeQ, likeQ);
      }
      sql += ` ORDER BY c.updated_at DESC, c.id DESC LIMIT 300`;

      const rows = await db.query(sql, params);

      // Compute tags
      const VIP_MIN_ORDERS = 20;
      const VIP_MIN_SPENT = 2000000;
      const SERING_MIN_ORDERS = 5;
      const BARU_MAX_DAYS = 30;

      const now = new Date();
      const list = rows.map(r => {
        const orders = parseInt(r.orders_count) || 0;
        const spent = parseInt(r.total_spent) || 0;
        let computed = 'Reguler';
        if (orders >= VIP_MIN_ORDERS || spent >= VIP_MIN_SPENT) computed = 'VIP';
        else if (orders >= SERING_MIN_ORDERS) computed = 'Sering';
        else if (r.first_order_at) {
          const days = Math.floor((now - new Date(r.first_order_at)) / (1000 * 60 * 60 * 24));
          if (days <= BARU_MAX_DAYS) computed = 'Baru';
        }
        if (computed !== r.tag) {
          db.execute('UPDATE customers SET tag = ?, updated_at = NOW() WHERE id = ?', [computed, r.id]).catch(() => {});
        }
        r.computed_tag = computed;
        if (tag && computed !== tag) return null;
        return r;
      }).filter(Boolean);

      return jsonResponse({ ok: true, customers: list });
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

      if (act === 'create_customer') {
        // B2 — validasi & sanitasi sebelum menyentuh database.
        //
        // B16 — batas mengikuti lebar kolom TiDB, dua arah sekaligus:
        //   `address`  500 -> 255  (VARCHAR(255); 300 char -> 500 di produksi)
        //   `phone`     30 ->  32  (VARCHAR(32)). Ini arah SEBALIKNYA: batas
        //     lama TERLALU KETAT, jadi nomor 31–32 digit yang sah ditolak
        //     padahal kolomnya muat. Terbukti: 32 char -> 400 "maksimal 30".
        // `full_name` tetap 120 — persis VARCHAR(120), sudah tepat.
        const v = validateOr400(body, {
          full_name: COL_SPEC.customerName,
          phone: COL_SPEC.customerPhone,
          address: COL_SPEC.customerAddress
        });
        if (!v.ok) return v.response;
        const { full_name: name, phone, address } = v.data;

        // Generate unique code
        let code;
        for (let i = 0; i < 10; i++) {
          const c = 'CUST-' + Math.floor(1000 + Math.random() * 9000);
          const exists = await db.query('SELECT 1 FROM customers WHERE code = ? LIMIT 1', [c]);
          if (exists.length === 0) { code = c; break; }
        }
        if (!code) code = 'CUST-' + Date.now().toString(36).toUpperCase();

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute(
          `INSERT INTO customers (code, full_name, phone, address, tag, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'Reguler', ?, ?)`,
          [code, name, phone, address, now, now]
        );
        const newCust = await db.query('SELECT * FROM customers WHERE code = ?', [code]);
        return jsonResponse({ ok: true, customer: newCust[0] });
      }

      if (act === 'update_customer') {
        // B16 — batas mengikuti lebar kolom (lihat `create_customer`).
        const v = validateOr400(body, {
          id: { type: 'int', required: true, min: 1, label: 'ID' },
          full_name: COL_SPEC.customerName,
          phone: COL_SPEC.customerPhone,
          address: COL_SPEC.customerAddress
        });
        if (!v.ok) return v.response;
        const { id, full_name: name, phone, address } = v.data;
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute('UPDATE customers SET full_name=?, phone=?, address=?, updated_at=? WHERE id=?', [name, phone, address, now, id]);
        return jsonResponse({ ok: true });
      }

      if (act === 'delete_customer') {
        const v = validateOr400(body, { id: { type: 'int', required: true, min: 1, label: 'ID' } });
        if (!v.ok) return v.response;
        await db.execute('DELETE FROM customers WHERE id = ?', [v.data.id]);
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: false, msg: 'Unknown action' }, 400);
    } catch (e) {
      return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}