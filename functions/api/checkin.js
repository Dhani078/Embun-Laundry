// functions/api/checkin.js
import { getDb, jsonResponse, getUserFromSession } from '../_db.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  const user = await getUserFromSession(request, env);
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  if (request.method === 'GET') {
    try {
      const today = new Date().toISOString().split('T')[0];
      const rows = await db.query('SELECT * FROM daily_checkins WHERE user_id = ? AND day = ? LIMIT 1', [user.id, today]);
      const totalRows = await db.query('SELECT COUNT(*) as c FROM daily_checkins WHERE user_id = ?', [user.id]);

      return jsonResponse({
        ok: true,
        checked_today: rows.length > 0,
        total_checkins: totalRows[0]?.c || 0
      });
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      const today = new Date().toISOString().split('T')[0];
      const existing = await db.query('SELECT id FROM daily_checkins WHERE user_id = ? AND day = ? LIMIT 1', [user.id, today]);

      if (existing.length > 0) {
        return jsonResponse({ ok: false, msg: 'Sudah check-in hari ini' }, 400);
      }

      await db.execute('INSERT INTO daily_checkins (user_id, day, created_at) VALUES (?, ?, NOW())', [user.id, today]);
      
      // Bonus voucher if 5 days checkin
      const countRes = await db.query('SELECT COUNT(*) as c FROM daily_checkins WHERE user_id = ?', [user.id]);
      const totalDays = countRes[0]?.c || 0;

      return jsonResponse({
        ok: true,
        msg: 'Check-in sukses!',
        total_checkins: totalDays
      });
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}