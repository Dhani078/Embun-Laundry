// functions/api/activity-log.js
import { getDb, jsonResponse, getUserFromSession, corsOptions, SERVER_ERROR } from '../_db.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  if (request.method === 'OPTIONS') return corsOptions('GET, OPTIONS');

  const user = await getUserFromSession(request, env);
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  const isStaff = ['Admin', 'Owner', 'Staff'].includes(user.user_role);
  if (!isStaff) return jsonResponse({ ok: false, msg: 'Forbidden' }, 403);

  // GET — retrieve recent activity logs
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
      const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
      const filterType = url.searchParams.get('type') || '';

      let sql = `SELECT id, actor_name, actor_role, action_type, entity_type, entity_id, entity_label, detail, ip_address, created_at
                 FROM activity_log`;
      const params = [];

      if (filterType) {
        sql += ` WHERE action_type = ?`;
        params.push(filterType);
      }

      sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const logs = await db.query(sql, params);

      // Count total
      let countSql = `SELECT COUNT(*) as total FROM activity_log`;
      const countParams = [];
      if (filterType) {
        countSql += ` WHERE action_type = ?`;
        countParams.push(filterType);
      }
      const countRes = await db.query(countSql, countParams);
      const total = countRes[0]?.total || 0;

      return jsonResponse({ ok: true, logs, total, limit, offset });
    } catch (e) {
      return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}
