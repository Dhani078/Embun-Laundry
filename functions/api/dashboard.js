// functions/api/dashboard.js
import { getDb, jsonResponse, getUserFromSession, corsOptions } from '../_db.js';

// B7 — Fragmen WHERE untuk memisahkan data milik pelanggan.
//
// INI KONSTANTA, bukan hasil olahan input. Tidak ada satu pun nilai yang
// berasal dari user; nama pelanggan sendiri dikirim lewat placeholder `?`
// (lihat `params` di bawah). Konstanta sengaja diberi nama agar audit
// SQL-injection bisa memutihkan pemakaiannya.
const FILTER_WHERE = ' WHERE customer_name = ?';

export async function onRequestGet({ request, env }) {
  if (request.method === 'OPTIONS') return corsOptions('GET, OPTIONS');

  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  const user = await getUserFromSession(request, env);
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  const isStaff = ['Admin', 'Owner', 'Staff'].includes(user.user_role);
  const myName = user.user_name || '';

  try {
    // Pelanggan non-staff hanya melihat order atas namanya sendiri.
    const scoped = !isStaff && !!myName;
    const params = scoped ? [myName] : [];

    // KPI: total revenue.
    // Dua bentuk SQL dipisah penuh (bukan disambung) supaya tidak ada
    // operator logika yang bisa "dibajak" lewat fragmen.
    const revSql = scoped
      ? "SELECT COALESCE(SUM(total_amount), 0) as total_rev FROM orders WHERE customer_name = ? AND (status IS NULL OR status<>'batal')"
      : "SELECT COALESCE(SUM(total_amount), 0) as total_rev FROM orders WHERE (status IS NULL OR status<>'batal')";
    const revRes = await db.query(revSql, params);
    const totalRev = revRes[0]?.total_rev || 0;

    // Active orders (baru or proses) — dua bentuk terpisah, bukan disambung.
    const activeRes = await db.query(
      scoped
        ? "SELECT COUNT(*) as total_active FROM orders WHERE status IN ('baru', 'proses') AND customer_name = ?"
        : "SELECT COUNT(*) as total_active FROM orders WHERE status IN ('baru', 'proses')",
      params
    );
    const activeOrders = activeRes[0]?.total_active || 0;

    // Finished orders today
    const finRes = await db.query(
      scoped
        ? "SELECT COUNT(*) as fin_today FROM orders WHERE status = 'selesai' AND DATE(finished_at) = CURDATE() AND customer_name = ?"
        : "SELECT COUNT(*) as fin_today FROM orders WHERE status = 'selesai' AND DATE(finished_at) = CURDATE()",
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
    const recentSql = scoped
      ? `SELECT o.*, s.name as service_name
         FROM orders o
         JOIN services s ON s.id = o.service_id
         ${FILTER_WHERE}
         ORDER BY o.created_at DESC
         LIMIT 10`
      : `SELECT o.*, s.name as service_name
         FROM orders o
         JOIN services s ON s.id = o.service_id
         ORDER BY o.created_at DESC
         LIMIT 10`;
    const recentOrders = await db.query(recentSql, params);

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