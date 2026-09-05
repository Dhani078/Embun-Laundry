// functions/api/orders.js
import { getDb, jsonResponse, getUserFromSession } from '../_db.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  const user = await getUserFromSession(request, env);
  const isStaff = user && ['Admin', 'Owner', 'Staff'].includes(user.user_role);
  const myName = user?.user_name || '';

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  // GET - list orders
  if (request.method === 'GET' && !action) {
    try {
      const view = url.searchParams.get('view') || 'table';
      const q = url.searchParams.get('q') || '';
      const status = url.searchParams.get('status') || '';
      const start = url.searchParams.get('start') || '';
      const end = url.searchParams.get('end') || '';

      let sql = `
        SELECT o.*, s.name AS service_name
        FROM orders o
        JOIN services s ON s.id = o.service_id
        WHERE 1=1
      `;
      const params = [];

      if (!isStaff && myName) {
        sql += ' AND o.customer_name = ?';
        params.push(myName);
      }
      if (q) {
        sql += ` AND (o.order_code LIKE ? OR o.customer_name LIKE ? OR s.name LIKE ? OR o.customer_phone LIKE ? OR o.customer_address LIKE ?)`;
        const likeQ = `%${q}%`;
        params.push(likeQ, likeQ, likeQ, likeQ, likeQ);
      }
      if (['baru', 'proses', 'selesai', 'batal'].includes(status)) {
        sql += ' AND o.status = ?';
        params.push(status);
      }
      if (start && end) {
        sql += ' AND o.created_at BETWEEN ? AND ?';
        params.push(start + ' 00:00:00', end + ' 23:59:59');
      }

      sql += ' ORDER BY o.created_at DESC LIMIT 300';

      const orders = await db.query(sql, params);
      return jsonResponse({ ok: true, orders });
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  // POST - handle actions
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const act = body.action || action;

      if (act === 'create_order') {
        if (!isStaff && !user) {
          return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);
        }

        const customer = isStaff ? body.customer_name : myName;
        const phone = body.customer_phone || '';
        const address = body.customer_address || '';
        const serviceId = parseInt(body.service_id) || 0;
        const kg = Math.max(1, parseInt(body.weight_kg) || 1);
        const disc = Math.max(0, parseInt(body.discount) || 0);
        let priceKg = parseInt(body.price_per_kg) || 0;
        const voucherCode = (body.voucher_code || '').toUpperCase().trim();
        const status = isStaff && ['baru', 'proses', 'selesai', 'batal'].includes(body.status) ? body.status : 'baru';

        if (!customer || !serviceId) {
          return jsonResponse({ ok: false, msg: 'Data tidak lengkap' }, 400);
        }

        // Get price if not provided
        if (priceKg <= 0) {
          const svc = await db.query('SELECT price FROM services WHERE id = ?', [serviceId]);
          priceKg = svc[0]?.price || 20000;
        }

        const subtotal = kg * priceKg;
        let finalDisc = disc;

        // Validate voucher if provided
        if (voucherCode) {
          // Check user_vouchers first
          const uv = await db.query(
            `SELECT id, promo_id, code, name, type, value, min_spend, max_discount, expires_at, used_at
             FROM user_vouchers WHERE user_id = ? AND code = ? LIMIT 1`,
            [user.id, voucherCode]
          );
          if (uv.length > 0) {
            const v = uv[0];
            if (v.used_at) return jsonResponse({ ok: false, msg: 'Kode sudah digunakan' }, 400);
            if (v.expires_at && new Date(v.expires_at) < new Date()) return jsonResponse({ ok: false, msg: 'Kode kedaluwarsa' }, 400);
            if ((v.min_spend || 0) > 0 && subtotal < v.min_spend) return jsonResponse({ ok: false, msg: 'Belum memenuhi minimum belanja' }, 400);

            if (v.type === 'percent') {
              finalDisc = Math.floor(subtotal * (v.value / 100));
              if (v.max_discount > 0) finalDisc = Math.min(finalDisc, v.max_discount);
            } else {
              finalDisc = v.value;
            }
            finalDisc = Math.max(0, Math.min(finalDisc, subtotal));
          }
        }

        if (finalDisc > subtotal) finalDisc = subtotal;
        const total = subtotal - finalDisc;

        const code = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const finished = status === 'selesai' ? now : null;

        await db.execute(
          `INSERT INTO orders
           (order_code, customer_name, customer_phone, customer_address, service_id, weight_kg, price_per_kg, discount, total_amount, status, created_at, finished_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [code, customer, phone, address, serviceId, kg, priceKg, finalDisc, total, status, now, finished]
        );

        const newOrder = await db.query('SELECT * FROM orders WHERE order_code = ?', [code]);
        
        // Mark voucher as used
        if (voucherCode) {
          await db.execute(
            `UPDATE user_vouchers SET used_at = NOW() WHERE user_id = ? AND code = ? AND used_at IS NULL`,
            [user.id, voucherCode]
          );
          await db.execute(
            `INSERT INTO voucher_claims (user_id, promo_id, voucher_id, source, amount)
             SELECT ?, promo_id, id, 'code', ? FROM user_vouchers WHERE user_id = ? AND code = ?`,
            [user.id, finalDisc, user.id, voucherCode]
          );
        }

        return jsonResponse({ ok: true, order: newOrder[0] });
      }

      if (act === 'move_status' && isStaff) {
        const id = parseInt(body.id) || 0;
        const newStatus = body.status;
        if (!id || !['baru', 'proses', 'selesai', 'batal'].includes(newStatus)) {
          return jsonResponse({ ok: false, msg: 'Invalid params' }, 400);
        }
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute(
          `UPDATE orders SET status = ?, finished_at = IF(? = 'selesai', IFNULL(finished_at, ?), finished_at) WHERE id = ?`,
          [newStatus, newStatus, now, id]
        );
        return jsonResponse({ ok: true });
      }

      if (act === 'update_order' && isStaff) {
        const id = parseInt(body.id) || 0;
        if (!id) return jsonResponse({ ok: false, msg: 'Invalid id' }, 400);

        const customer = body.customer_name;
        const phone = body.customer_phone || '';
        const address = body.customer_address || '';
        const serviceId = parseInt(body.service_id) || 0;
        const kg = Math.max(1, parseInt(body.weight_kg) || 1);
        const disc = Math.max(0, parseInt(body.discount) || 0);
        let priceKg = parseInt(body.price_per_kg) || 0;
        const status = body.status || 'baru';

        if (!customer || !serviceId || !['baru', 'proses', 'selesai', 'batal'].includes(status)) {
          return jsonResponse({ ok: false, msg: 'Invalid data' }, 400);
        }

        if (priceKg <= 0) {
          const svc = await db.query('SELECT price FROM services WHERE id = ?', [serviceId]);
          priceKg = svc[0]?.price || 20000;
        }

        const total = Math.max(0, kg * priceKg - disc);
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await db.execute(
          `UPDATE orders SET
            customer_name=?, customer_phone=?, customer_address=?, service_id=?, weight_kg=?,
            price_per_kg=?, discount=?, total_amount=?, status=?, finished_at=IF(?='selesai',IFNULL(finished_at,?),finished_at)
            WHERE id=?`,
          [customer, phone, address, serviceId, kg, priceKg, disc, total, status, status, now, id]
        );

        return jsonResponse({ ok: true });
      }

      if (act === 'delete_order') {
        const id = parseInt(body.id) || 0;
        if (!id) return jsonResponse({ ok: false, msg: 'Invalid id' }, 400);

        if (isStaff) {
          await db.execute('DELETE FROM orders WHERE id = ?', [id]);
        } else {
          const order = await db.query('SELECT status, customer_name FROM orders WHERE id = ?', [id]);
          if (order.length > 0 && order[0].status === 'baru' && order[0].customer_name === myName) {
            await db.execute('DELETE FROM orders WHERE id = ?', [id]);
          } else {
            return jsonResponse({ ok: false, msg: 'Tidak diizinkan' }, 403);
          }
        }
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: false, msg: 'Unknown action' }, 400);
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}