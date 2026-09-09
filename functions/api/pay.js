// functions/api/pay.js
import { getDb, jsonResponse, getUserFromSession, readJson, corsOptions } from '../_db.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  if (request.method === 'OPTIONS') return corsOptions('GET, POST, OPTIONS');

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

      // B10 — ISOLASI DATA. Halaman pembayaran dibuka lewat kode pesanan
      // (semacam "capability URL"), jadi ia memang sengaja dapat diakses
      // tanpa login — dan kode `ORD-<base36 waktu><3 karakter acak>` hanya
      // punya ~46 ribu kemungkinan per milidetik, jadi bisa ditebak.
      // Yang DIBUTUHKAN halaman itu hanyalah kode, layanan, berat, total,
      // dan status bayar. Telepon dan alamat pelanggan tidak pernah
      // ditampilkan, jadi jangan dikirim ke pemanggil yang bukan pemiliknya.
      const isStaff = user && ['Admin', 'Owner', 'Staff'].includes(user.user_role);
      const isOwner = !!user && !!user.user_name && order.customer_name === user.user_name;
      const safeOrder = (isStaff || isOwner)
        ? order
        : { ...order, customer_phone: null, customer_address: null };

      // Get payment records
      const payments = await db.query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC', [order.id]);

      return jsonResponse({ ok: true, order: safeOrder, payments });
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      const parsed = await readJson(request);
      if (!parsed.ok) return parsed.response;
      const body = parsed.data;
      const code = body.order_code || orderCode;
      const method = body.method || 'QRIS';
      const amount = parseInt(body.amount) || 0;

      if (!code || amount <= 0) return jsonResponse({ ok: false, msg: 'Invalid params' }, 400);

      const orders = await db.query('SELECT * FROM orders WHERE order_code = ? LIMIT 1', [code]);
      if (orders.length === 0) return jsonResponse({ ok: false, msg: 'Pesanan tidak ditemukan' }, 404);
      const order = orders[0];

      const qrPayload = `DHLDR|${order.order_code}|${amount}|${Date.now()}`;
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      await db.execute(
        `INSERT INTO payments (order_id, method, provider, amount, status, qr_payload, created_at)
         VALUES (?, ?, 'manual', ?, 'pending', ?, ?)`,
        [order.id, method, amount, qrPayload, now]
      );

      return jsonResponse({
        ok: true,
        qr_payload: qrPayload,
        amount
      });
    } catch (e) {
      return jsonResponse({ ok: false, msg: e.message }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}
