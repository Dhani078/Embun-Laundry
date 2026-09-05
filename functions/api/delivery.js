// functions/api/delivery.js
import { getDb, jsonResponse, getUserFromSession } from '../_db.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  const user = await getUserFromSession(request, env);
  const isStaff = user && ['Admin', 'Owner', 'Staff'].includes(user.user_role);
  const myName = user?.user_name || '';

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  if (request.method === 'GET' && !action) {
    try {
      const q = url.searchParams.get('q') || '';
      const type = url.searchParams.get('type') || '';
      const status = url.searchParams.get('status') || '';
      const date = url.searchParams.get('date') || '';

      let sql = `
        SELECT pd.*, c.full_name as courier_name, c.phone as courier_phone, c.vehicle as courier_vehicle
        FROM pickup_delivery pd
        LEFT JOIN couriers c ON c.id = pd.courier_id
        WHERE 1=1
      `;
      const params = [];

      if (!isStaff && myName) {
        sql += ' AND pd.customer_name = ?';
        params.push(myName);
      }
      if (q) {
        sql += ' AND (pd.task_code LIKE ? OR pd.customer_name LIKE ? OR pd.phone LIKE ? OR pd.address LIKE ?)';
        const likeQ = `%${q}%`;
        params.push(likeQ, likeQ, likeQ, likeQ);
      }
      if (['pickup', 'delivery'].includes(type)) {
        sql += ' AND pd.type = ?';
        params.push(type);
      }
      if (status) {
        sql += ' AND pd.status = ?';
        params.push(status);
      }
      if (date) {
        sql += ' AND pd.schedule_date = ?';
        params.push(date);
      }

      sql += ' ORDER BY pd.schedule_date DESC, pd.id DESC LIMIT 300';
      const tasks = await db.query(sql, params);

      // Also return couriers list for staff
      let couriers = [];
      if (isStaff) {
        couriers = await db.query('SELECT * FROM couriers WHERE is_active = 1 ORDER BY full_name ASC');
      }

      return jsonResponse({ ok: true, tasks, couriers });
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const act = body.action || action;

      if (act === 'create_task') {
        const type = body.type;
        if (!['pickup', 'delivery'].includes(type)) return jsonResponse({ ok: false, msg: 'Tipe invalid' }, 400);

        const customer = isStaff ? body.customer_name : myName;
        const phone = body.phone || '';
        const address = body.address || '';
        const orderCode = body.order_code || null;
        const courierId = isStaff && body.courier_id ? parseInt(body.courier_id) : null;
        const scheduleDate = body.schedule_date || new Date().toISOString().split('T')[0];
        const startTime = body.start_time || '09:00:00';
        const endTime = body.end_time || '17:00:00';
        const notes = body.notes || '';
        const status = courierId ? 'assigned' : 'scheduled';

        if (!customer || !address) return jsonResponse({ ok: false, msg: 'Nama dan alamat wajib diisi' }, 400);

        const prefix = type === 'pickup' ? 'PU-' : 'DL-';
        const taskCode = prefix + Date.now().toString(36).toUpperCase().slice(-5);
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await db.execute(
          `INSERT INTO pickup_delivery
           (task_code, type, order_code, customer_name, phone, address, status, courier_id, schedule_date, start_time, end_time, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [taskCode, type, orderCode, customer, phone, address, status, courierId, scheduleDate, startTime, endTime, notes, now, now]
        );

        const newTask = await db.query('SELECT * FROM pickup_delivery WHERE task_code = ?', [taskCode]);
        return jsonResponse({ ok: true, task: newTask[0] });
      }

      if (act === 'update_status') {
        if (!isStaff) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);
        const id = parseInt(body.id) || 0;
        const status = body.status;
        if (!id || !['scheduled', 'assigned', 'onroute', 'completed', 'cancelled'].includes(status)) {
          return jsonResponse({ ok: false, msg: 'Invalid status' }, 400);
        }
        await db.execute('UPDATE pickup_delivery SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
        return jsonResponse({ ok: true });
      }

      if (act === 'assign_courier') {
        if (!isStaff) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);
        const id = parseInt(body.id) || 0;
        const courierId = parseInt(body.courier_id) || null;
        if (!id) return jsonResponse({ ok: false, msg: 'Invalid id' }, 400);

        const status = courierId ? 'assigned' : 'scheduled';
        await db.execute('UPDATE pickup_delivery SET courier_id = ?, status = ?, updated_at = NOW() WHERE id = ?', [courierId, status, id]);
        return jsonResponse({ ok: true });
      }

      if (act === 'delete_task') {
        const id = parseInt(body.id) || 0;
        if (!id) return jsonResponse({ ok: false, msg: 'Invalid id' }, 400);

        if (isStaff) {
          await db.execute('DELETE FROM pickup_delivery WHERE id = ?', [id]);
        } else {
          const t = await db.query('SELECT status, customer_name FROM pickup_delivery WHERE id = ?', [id]);
          if (t.length > 0 && t[0].status === 'scheduled' && t[0].customer_name === myName) {
            await db.execute('DELETE FROM pickup_delivery WHERE id = ?', [id]);
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