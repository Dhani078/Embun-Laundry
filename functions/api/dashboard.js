// functions/api/dashboard.js
import { getDb, jsonResponse, getUserFromSession } from '../_db.js';

export async function onRequestGet({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  const user = await getUserFromSession(request, env);
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  const isStaff = ['Admin', 'Owner', 'Staff'].includes(user.user_role);
  const myName = user.user_name || '';

  try {
    const custFilter = (!isStaff && myName) ? ' WHERE customer_name = ?' : '';
    const custFilterAnd = (!isStaff && myName) ? ' AND customer_name = ?' : '';
    const params = (!isStaff && myName) ? [myName] : [];

    // KPI: total revenue
    const revRes = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_rev FROM orders ${custFilter ? custFilter + " AND (status IS NULL OR status<>'batal')" : "WHERE (status IS NULL OR status<>'batal')"}`,
      params
    );
    const totalRev = revRes[0]?.total_rev || 0;

    // Active orders (baru or proses)
    const activeRes = await db.query(
      `SELECT COUNT(*) as total_active FROM orders WHERE status IN ('baru', 'proses') ${custFilterAnd}`,
      params
    );
    const activeOrders = activeRes[0]?.total_active || 0;

    // Finished orders today
    const finRes = await db.query(
      `SELECT COUNT(*) as fin_today FROM orders WHERE status = 'selesai' AND DATE(finished_at) = CURDATE() ${custFilterAnd}`,
      params
    );
    const finishedToday = finRes[0]?.fin_today || 0;

    // Total customers (staff only)
    let totalCustomers = 0;
    if (isStaff) {
      const custCountRes = await db.query('SELECT COUNT(*) as c FROM customers');
      totalCustomers = custCountRes[0]?.c || 0;
    }

    // Recent orders
    const recentOrders = await db.query(
      `SELECT o.*, s.name as service_name
       FROM orders o
       JOIN services s ON s.id = o.service_id
       ${custFilter}
       ORDER BY o.created_at DESC
       LIMIT 10`,
      params
    );

    // Vouchers available / claimed for user
    const vouchersRes = await db.query(
      `SELECT uv.*, p.name as promo_name, p.type, p.value, p.min_spend
       FROM user_vouchers uv
       JOIN promos p ON p.id = uv.promo_id
       WHERE uv.user_id = ? AND uv.used_at IS NULL AND (uv.expires_at IS NULL OR uv.expires_at > NOW())`,
      [user.id]
    );

    return jsonResponse({
      ok: true,
      stats: {
        total_revenue: totalRev,
        active_orders: activeOrders,
        finished_today: finishedToday,
        total_customers: totalCustomers
      },
      recent_orders: recentOrders,
      vouchers: vouchersRes,
      user: {
        id: user.id,
        name: user.user_name,
        role: user.user_role,
        email: user.email
      }
    });
  } catch (e) {
    return jsonResponse({ ok: false, msg: e.message }, 500);
  }
}