// functions/api/reports.js
import { getDb, jsonResponse, getUserFromSession } from '../_db.js';

export async function onRequestGet({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  const user = await getUserFromSession(request, env);
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  const isStaff = ['Admin', 'Owner', 'Staff'].includes(user.user_role);
  const myName = user.user_name || '';

  const url = new URL(request.url);
  const group = url.searchParams.get('group') || 'bulan';
  const startS = url.searchParams.get('start') || '';
  const endS = url.searchParams.get('end') || '';

  try {
    const custFilter = (!isStaff && myName) ? ' AND customer_name = ?' : '';
    const custFilterParams = (!isStaff && myName) ? [myName] : [];

    let dateCond = '';
    const dateParams = [];
    if (startS && endS) {
      dateCond = ' AND created_at BETWEEN ? AND ?';
      dateParams.push(startS + ' 00:00:00', endS + ' 23:59:59');
    }

    // KPI: Rev, Orders, Avg Weight
    const kpiSql = `
      SELECT COALESCE(SUM(total_amount), 0) as rev, COUNT(*) as ord, ROUND(AVG(weight_kg), 1) as avg_wt
      FROM orders
      WHERE (status IS NULL OR status<>'batal') ${dateCond} ${custFilter}
    `;
    const kpiRes = await db.query(kpiSql, [...dateParams, ...custFilterParams]);

    // Chart grouping
    let groupExpr;
    if (group === 'hari') groupExpr = 'DATE(created_at)';
    else if (group === 'minggu') groupExpr = "CONCAT(YEAR(created_at), '-W', LPAD(WEEK(created_at, 3), 2, '0'))";
    else groupExpr = "DATE_FORMAT(created_at, '%Y-%m')";

    const chartSql = `
      SELECT ${groupExpr} as g,
             COALESCE(SUM(paid_amount), 0) as paid,
             COALESCE(SUM(GREATEST(total_amount - paid_amount, 0)), 0) as unpaid
      FROM orders
      WHERE (status IS NULL OR status<>'batal') ${dateCond} ${custFilter}
      GROUP BY ${groupExpr}
      ORDER BY g ASC
    `;
    const chartRows = await db.query(chartSql, [...dateParams, ...custFilterParams]);

    // Daily breakdown table
    const dailySql = `
      SELECT DATE(created_at) as d,
             COUNT(*) as orders,
             COALESCE(SUM(total_amount), 0) as revenue,
             COALESCE(SUM(weight_kg), 0) as weight
      FROM orders
      WHERE (status IS NULL OR status<>'batal') ${dateCond} ${custFilter}
      GROUP BY DATE(created_at)
      ORDER BY d DESC
      LIMIT 60
    `;
    const dailyRows = await db.query(dailySql, [...dateParams, ...custFilterParams]);

    return jsonResponse({
      ok: true,
      kpi: kpiRes[0] || { rev: 0, ord: 0, avg_wt: 0 },
      chart: chartRows,
      daily: dailyRows
    });
  } catch (e) {
    return jsonResponse({ ok: false, msg: e.message }, 500);
  }
}