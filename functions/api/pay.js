// functions/api/pay.js
import { getDb, jsonResponse, getUserFromSession } from '../_db.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  const user = await getUserFromSession(request, env);
  const url = new URL(request.url);
  const orderCode = url.searchParams.get('order_code') || '';

  if (request.method === 'GET') {
    if (!orderCode) return jsonResponse({ ok: false, msg: 'Order code required' }, 400);

    try {
      const orders = await db.query(
        `SELECT o.*, s.name as service_name
         FROM orders o
         JOIN services s ON s.id = o.service_id
         WHERE o.order_code = ? LIMIT 1`,
        [orderCode]
      );

      if (orders.length === 0) return jsonResponse({ ok: false, msg: 'Pesanan tidak ditemukan' }, 404);
      const order = orders[0];

      // Get payment records
      const payments = await db.query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC', [order.id]);

      return jsonResponse({ ok: true, order, payments });
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const code = body.order_code || orderCode;
      const method = body.method || 'QRIS';
      const amount = parseInt(body.amount) || 0;

      if (!code || amount <= 0) return jsonResponse({ ok: false, msg: 'Invalid params' }, 400);

      const orders = await db.query('SELECT * FROM orders WHERE order_code = ? LIMIT 1', [code]);
      if (orders.length === 0) return jsonResponse({ ok: false, msg: 'Pesanan tidak ditemukan' }, 404);
      const order = orders[0];

      const qrPayload = `DHLDR|${order.order_code}|${amount}|${Date.now()}`;
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      const res = await db.execute(
        `INSERT INTO payments (order_id, method, provider, amount, status, qr_payload, created_at)
         VALUES (?, ?, 'manual', ?, 'pending', ?, ?)`,
        [order.id, method, amount, qrPayload, now]
      );

      return jsonResponse({
        ok: true,
        payment_id: res.insertId,
        qr_payload: qrPayload,
        amount
      });
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}