// functions/api/pay.js
import { getDb, jsonResponse, getUserFromSession, readJson, corsOptions, SERVER_ERROR } from '../_db.js';
// B14 — validasi & sanitasi untuk `amount`, `method`, `order_code`.
// Modul ini sudah ada sejak B2, hanya belum dipakai di `/api/pay` — persis
// pola yang sama dengan celah B13 di `/api/profile`.
import { validateOr400, cleanStr } from '../_validate.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  if (request.method === 'OPTIONS') return corsOptions('GET, POST, OPTIONS');

  const user = await getUserFromSession(request, env);
  const url = new URL(request.url);
  const orderCode = url.searchParams.get('order_code') || '';

  // B14 — `?order_code=` pada GET juga tidak pernah dibatasi. Kode pesanan
  // adalah VARCHAR(20); tanpa batas ini, nilai 1 MB dikirim mentah ke TiDB
  // pada setiap permintaan halaman pembayaran.
  if (request.method === 'GET' && orderCode.length > 40) {
    return jsonResponse({ ok: false, msg: 'Validasi gagal: Kode pesanan tidak valid' }, 400);
  }

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
      return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      const parsed = await readJson(request);
      if (!parsed.ok) return parsed.response;
      const body = parsed.data;

      // B14 — validasi `amount`, `method`, dan `order_code` (celah B2).
      //
      // Dulu barisnya `parseInt(body.amount) || 0`, yang ternyata lolos dari
      // audit B2. Tiga akibat nyata, semuanya terbukti oleh
      // tools/verify_b14.mjs sebelum diperbaiki:
      //   1. `amount: [1, 2]`  -> `parseInt([1,2])` = 1. Sebuah ARRAY menjadi
      //      nilai uang yang sah, dan INSERT tetap dijalankan.
      //   2. `amount: 2000000000` -> diterima mentah. Tidak ada batas atas,
      //      padahal kolomnya INT.
      //   3. `method` dikirim apa adanya ke kolom
      //      ENUM('QRIS','DANA','OVO','GOPAY','TRANSFER','CASH'). Nilai asing
      //      membuat TiDB menolak -> 500, bukan 400 yang semestinya.
      // `order_code` juga tidak dibatasi: kolomnya VARCHAR(20), jadi 5000
      // karakter hanya berakhir sebagai 500 dari DB.
      const v = validateOr400(body, {
        order_code: { type: 'str', required: true, min: 1, max: 40, label: 'Kode pesanan' },
        // 'QRIS' adalah nilai bawaan lama — dipertahankan agar klien yang
        // tidak mengirim `method` tetap berperilaku seperti sebelumnya.
        method: {
          type: 'enum',
          values: ['QRIS', 'DANA', 'OVO', 'GOPAY', 'TRANSFER', 'CASH'],
          default: 'QRIS',
          label: 'Metode pembayaran'
        },
        amount: { type: 'int', required: true, min: 1, max: 100000000, label: 'Jumlah bayar' }
      });
      if (!v.ok) return v.response;

      const code = v.data.order_code || orderCode;
      const method = v.data.method;
      const amount = v.data.amount;

      if (!code) return jsonResponse({ ok: false, msg: 'Invalid params' }, 400);

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
      return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}
