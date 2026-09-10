// tools/verify_c_pay_sync.mjs
// Verifikasi bahwa pembayaran via POST /api/pay memperbarui orders.paid_amount
// dan orders.payment_status (menutup celah fungsional yang dicatat di tick 28).

import { onRequest as pay } from '../functions/api/pay.js';
import { createSessionToken } from '../functions/_db.js';
import { __calls } from './mock_tidb.mjs';

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret-abcdefghijklmnopqrstuvwxyz' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

let passes = 0;
let fails = 0;

function check(name, cond, detail = '') {
  if (cond) {
    passes++;
    console.log(`HIJAU  ${name}`);
  } else {
    fails++;
    console.error(`MERAH  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

const TOTAL = 60000;
let state = { paid: 0, pending: 0 };

function order() {
  return {
    id: 1,
    order_code: 'ORD-TEST',
    customer_name: 'Budi Santoso',
    total_amount: TOTAL,
    paid_amount: state.paid,
    payment_status: state.paid >= TOTAL ? 'paid' : (state.paid > 0 ? 'partial' : 'unpaid')
  };
}

globalThis.__MOCK_ROWS = (sql) => {
  const s = String(sql).replace(/\s+/g, ' ');
  if (/FROM payments/i.test(s)) {
    return [{ outstanding: state.pending }];
  }
  if (/FROM orders/i.test(sql)) {
    return [order()];
  }
  return [];
};

const staffTok = await createSessionToken(
  { id: 1001, role: 'Staff', full_name: 'Kasir Satu', email: 'kasir@gmail.com' },
  ENV
);

async function postPay(amount) {
  __calls.length = 0;
  const req = new Request(`${BASE}/api/pay`, {
    method: 'POST',
    headers: {
      'Cookie': `session_token=${staffTok}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      order_code: 'ORD-TEST',
      amount: amount,
      method: 'CASH'
    })
  });
  const res = await pay({ request: req, env: ENV });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) console.error("401 Unauthorized, token was:", staffTok);
  
  // Ambil data INSERT payments dan UPDATE orders yang terekam
  const inserts = __calls.filter(c => /INSERT INTO payments/i.test(c.sql));
  const updates = __calls.filter(c => /UPDATE orders/i.test(c.sql));

  return { status: res.status, json, inserts, updates };
}

console.log('[1] Pembayaran bertahap (partial -> paid)');

// 1. Bayar sebagian (20000 dari 60000)
{
  state.paid = 0;
  state.pending = 0;

  const r = await postPay(20000);
  check('status response 200', r.status === 200);
  check('ada 1 baris payment ter-insert', r.inserts.length === 1);
  check('ada 1 baris orders ter-update', r.updates.length === 1);
  
  // params: [newPaid, paymentStatus, order.id]
  const updateParams = r.updates[0]?.params || [];
  check('paid_amount pesanan menjadi 20000', updateParams[0] === 20000);
  check('payment_status pesanan menjadi "partial"', updateParams[1] === 'partial');

  // Perbarui state lokal menirukan DB
  state.paid = 20000;
}

// 2. Bayar pelunasan (sisa 40000)
{
  const r = await postPay(40000);
  check('status response pelunasan 200', r.status === 200);
  check('ada 1 baris payment ter-insert', r.inserts.length === 1);
  check('ada 1 baris orders ter-update', r.updates.length === 1);

  const updateParams = r.updates[0]?.params || [];
  check('paid_amount pesanan menjadi 60000', updateParams[0] === 60000);
  check('payment_status pesanan menjadi "paid"', updateParams[1] === 'paid');

  state.paid = 60000;
}

// 3. Coba bayar lagi saat sudah lunas
{
  const r = await postPay(1000);
  check('bayar saat sudah lunas ditolak 400', r.status === 400);
  check('tidak ada baris payment baru', r.inserts.length === 0);
  check('tidak ada baris order ter-update', r.updates.length === 0);
}

console.log(`\nHASIL: ${passes} hijau, ${fails} merah`);
process.exit(fails > 0 ? 1 : 0);
