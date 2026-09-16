// functions/api/notifications.js — Notifikasi status order polling (FASE C3)
// Endpoint publik: GET /api/notifications?order_code=***
// Rate limit: 30 req/5m per IP

import { getDb, jsonResponse, withSecurityHeaders, SERVER_ERROR } from '../_db.js';
import { validateOr400 } from '../_validate.js';
import { clientKey, consume } from '../_ratelimit.js';

const NOTIFICATION_FIELDS = ['id', 'order_code', 'message', 'status', 'created_at'];
const RATE_LIMIT_TIER = 'notifications';
const RL_OPTS = { limit: 30, windowMs: 5 * 60 * 1000 };

/**
 * Validasi parameter query
 * @param {object} query
 */
function validateQuery(query) {
  return validateOr400(query, {
    order_code: { type: 'str', required: true, min: 3, max: 20, label: 'Kode pesanan' }
  });
}

/**
 * Handler GET /api/notifications?order_code=...
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());

  // 1. Validasi input (B2)
  const v = validateQuery(query);
  if (!v.ok) {
    return v.response;
  }
  const orderCode = v.data.order_code.toUpperCase();

  // 2. Rate limiting (B1)
  const ip = clientKey(request);
  const rlKey = `${RATE_LIMIT_TIER}:${ip}`;
  const rlRes = await consume(rlKey, RL_OPTS);
  if (!rlRes.ok) {
    return jsonResponse({ ok: false, msg: 'Terlalu banyak permintaan notifikasi. Coba lagi nanti.' }, 429);
  }

  // 3. Database query
  try {
    const db = await getDb(env);
    if (!db) {
      return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
    }

    // Cek apakah order ada
    const ordersResult = await db.execute(
      'SELECT id, status FROM orders WHERE order_code = ? LIMIT 1',
      [orderCode]
    );

    const orderRows = ordersResult?.rows || ordersResult?.results || ordersResult || [];
    if (orderRows.length === 0) {
      return jsonResponse({ ok: false, msg: 'Pesanan tidak ditemukan' }, 404);
    }

    const order = orderRows[0];
    const orderStatus = order.status || 'pending';

    // Ambil notifikasi jika tabel notifications ada
    let notifications = [];
    try {
      const notificationsResult = await db.execute(
        `SELECT ${NOTIFICATION_FIELDS.join(', ')}
         FROM notifications
         WHERE order_code = ?
         ORDER BY created_at DESC
         LIMIT 50`,
        [orderCode]
      );

      const notifRows = notificationsResult?.rows || notificationsResult?.results || notificationsResult || [];
      notifications = notifRows.map(row => ({
        id: row.id,
        order_code: row.order_code,
        message: row.message,
        status: row.status,
        created_at: row.created_at
      }));
    } catch (tblErr) {
      // Tabel notifications belum ada (fitur C3 belum diaktifkan penuh)
      notifications = [];
    }

    // Format output kontrak JSON
    return jsonResponse({
      ok: true,
      order_code: orderCode,
      order_status: orderStatus,
      notifications
    }, 200);

  } catch (e) {
    console.error('notifications/get error:', e);
    return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
  }
}

export default {
  onRequestGet
};
