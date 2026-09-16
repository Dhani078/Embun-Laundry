// Harness verifikasi Fase 0.6 — Penggantian Dasar Kepemilikan Pesanan dari Nama ke user_id (K4)
//
// Mencegah kerentanan IDOR fatal di mana pelanggan dengan nama yang sama (atau nama hasil manipulasi)
// dapat mengakses, melihat PII, membayar, atau menghapus pesanan milik pelanggan lain.
//
// Jalankan: node tools/verify_fase0_6_run.mjs

import fs from 'node:fs';
import path from 'node:path';
import { onRequest as ordersHandler } from '../functions/api/orders.js';
import { onRequest as payHandler } from '../functions/api/pay.js';
import { createSessionToken } from '../functions/_db.js';
import { __calls, reset as resetMockCalls } from './mock_tidb.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..');

let pass = 0;
let fail = 0;

function check(name, cond, detail = '') {
  const short = String(detail).length > 200 ? String(detail).slice(0, 200) + '…' : detail;
  if (cond) {
    pass++;
    console.log(`HIJAU  ${name}`);
  } else {
    fail++;
    console.log(`MERAH  ${name}${short ? '  — ' + short : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Bagian 1 — Audit Berkas Migrasi Database (0002_add_user_id_to_orders.sql)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit Berkas Migrasi Database');

const migPath = path.join(ROOT, 'db', 'migrations', '0002_add_user_id_to_orders.sql');
check('berkas migrasi 0002_add_user_id_to_orders.sql ada', fs.existsSync(migPath));

const migSql = fs.existsSync(migPath) ? fs.readFileSync(migPath, 'utf8') : '';
check(
  'migrasi memuat ALTER TABLE orders ADD COLUMN user_id INT NULL',
  /ALTER\s+TABLE\s+orders\s+ADD\s+COLUMN\s+user_id\s+INT\s+NULL/i.test(migSql)
);
check(
  'migrasi menambahkan indeks pada kolom user_id',
  /ALTER\s+TABLE\s+orders\s+ADD\s+INDEX\s+idx_orders_user_id\s*\(user_id\)/i.test(migSql)
);
check(
  'migrasi memuat skrip backfill user_id dari tabel users',
  /UPDATE\s+orders\s+o\s+JOIN\s+users\s+u\s+ON\s+u\.full_name\s*=\s*o\.customer_name\s+SET\s+o\.user_id\s*=\s*u\.id/i.test(migSql)
);
check(
  'migrasi memuat petunjuk rollback',
  /ROLLBACK/i.test(migSql) && /DROP\s+COLUMN\s+user_id/i.test(migSql)
);

// ---------------------------------------------------------------------------
// Bagian 2 — Audit Kode Statik functions/api/orders.js dan pay.js
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Audit Kode Statik');

const ordersCode = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'orders.js'), 'utf8');
const payCode = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'pay.js'), 'utf8');

check(
  'orders.js memeriksa o.user_id dalam klausa WHERE GET /api/orders',
  /o\.user_id\s*=\s*\?/.test(ordersCode)
);
check(
  'orders.js menyertakan user_id pada INSERT INTO orders',
  /INSERT\s+INTO\s+orders\s*\([^)]*user_id[^)]*\)/i.test(ordersCode)
);
check(
  'orders.js memeriksa user_id pada delete_order',
  /order\[0\]\.user_id/.test(ordersCode)
);
check(
  'pay.js GET memeriksa order.user_id untuk isolasi PII',
  /order\.user_id\s*!=\s*null\s*\?\s*order\.user_id\s*===\s*user\.id/.test(payCode)
);
check(
  'pay.js POST memeriksa order.user_id sebelum menerima pembayaran',
  /order\.user_id\s*!=\s*null\s*\?\s*order\.user_id\s*===\s*user\.id/.test(payCode)
);

// ---------------------------------------------------------------------------
// Bagian 3 — Uji Runtime Isolasi Kepemilikan (Pencegahan IDOR Nama Kembar)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 3 — Uji Runtime IDOR');

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret-k4' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

// Dua pengguna berbeda dengan nama identik "Budi Santoso"
const user1Token = await createSessionToken(
  { id: 10, full_name: 'Budi Santoso', role: 'Customer', email: 'budi1@gmail.com' }, ENV
);
const user2Token = await createSessionToken(
  { id: 20, full_name: 'Budi Santoso', role: 'Customer', email: 'budi2@gmail.com' }, ENV
);
const adminToken = await createSessionToken(
  { id: 99, full_name: 'Admin Utama', role: 'Admin', email: 'admin@gmail.com' }, ENV
);

// Pesanan ORD-BUDI-1 milik User 1 (user_id = 10, customer_name = 'Budi Santoso')
const orderUser1 = {
  id: 101,
  user_id: 10,
  order_code: 'ORD-BUDI-1',
  customer_name: 'Budi Santoso',
  customer_phone: '08123456789',
  customer_address: 'Jl. Rahasia User 1 No. 10',
  service_name: 'Cuci Kering',
  service_id: 1,
  total_amount: 50000,
  paid_amount: 0,
  status: 'baru',
  payment_status: 'unpaid'
};

function mkReq(method, urlPath, token, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `session_token=${token}`;
  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);
  return new Request(BASE + urlPath, init);
}

// 1. GET /api/orders: User 2 memanggil daftar pesanan
resetMockCalls();
globalThis.__MOCK_ROWS = (sql, params) => {
  return [orderUser1];
};
const resUser2Orders = await ordersHandler({ request: mkReq('GET', '/api/orders', user2Token), env: ENV });
check('GET /api/orders User 2 -> status 200', resUser2Orders.status === 200);

const ordersCall = __calls.find(c => c.sql.includes('FROM orders'));
check('GET /api/orders User 2 menyertakan filter o.user_id = ?',
  ordersCall && ordersCall.sql.includes('o.user_id = ?'));
check('GET /api/orders User 2 menyertakan user.id (20) dalam parameter',
  ordersCall && ordersCall.params.includes(20));

// 2. GET /api/pay?order_code=ORD-BUDI-1 oleh User 2 (nama sama, user_id beda)
globalThis.__MOCK_ROWS = (sql) => {
  if (sql.includes('FROM orders')) return [orderUser1];
  if (sql.includes('FROM payments')) return [];
  return [];
};
const resUser2PayGet = await payHandler({
  request: mkReq('GET', '/api/pay?order_code=ORD-BUDI-1', user2Token),
  env: ENV
});
check('GET /api/pay User 2 -> status 200', resUser2PayGet.status === 200);
const jsonUser2PayGet = await resUser2PayGet.json();
check(
  'GET /api/pay User 2 BUKAN pemilik: customer_phone disensor (null)',
  jsonUser2PayGet.order.customer_phone === null
);
check(
  'GET /api/pay User 2 BUKAN pemilik: customer_address disensor (null)',
  jsonUser2PayGet.order.customer_address === null
);

// 3. GET /api/pay?order_code=ORD-BUDI-1 oleh User 1 (pemilik sah)
const resUser1PayGet = await payHandler({
  request: mkReq('GET', '/api/pay?order_code=ORD-BUDI-1', user1Token),
  env: ENV
});
const jsonUser1PayGet = await resUser1PayGet.json();
check(
  'GET /api/pay User 1 ADALAH pemilik: customer_phone terlihat utuh',
  jsonUser1PayGet.order.customer_phone === '08123456789'
);
check(
  'GET /api/pay User 1 ADALAH pemilik: customer_address terlihat utuh',
  jsonUser1PayGet.order.customer_address === 'Jl. Rahasia User 1 No. 10'
);

// 4. POST /api/pay oleh User 2 pada pesanan User 1 (nama sama, user_id beda) -> DITOLAK 401
const resUser2PayPost = await payHandler({
  request: mkReq('POST', '/api/pay', user2Token, {
    order_code: 'ORD-BUDI-1',
    amount: 50000,
    method: 'QRIS'
  }),
  env: ENV
});
check('POST /api/pay User 2 pada pesanan User 1 -> DITOLAK 401 (Unauthorized)', resUser2PayPost.status === 401);

// 5. POST /api/pay oleh User 1 pada pesanan miliknya -> DITERIMA 200
resetMockCalls();
globalThis.__MOCK_ROWS = (sql) => {
  if (sql.includes('FROM orders')) return [orderUser1];
  if (sql.includes('FROM payments')) return [];
  return [];
};
const resUser1PayPost = await payHandler({
  request: mkReq('POST', '/api/pay', user1Token, {
    order_code: 'ORD-BUDI-1',
    amount: 50000,
    method: 'QRIS'
  }),
  env: ENV
});
check('POST /api/pay User 1 pada pesanannya sendiri -> DITERIMA 200', resUser1PayPost.status === 200);

// 6. POST /api/orders (delete_order) oleh User 2 pada pesanan User 1 -> DITOLAK 403
const resUser2Delete = await ordersHandler({
  request: mkReq('POST', '/api/orders', user2Token, {
    action: 'delete_order',
    id: 101
  }),
  env: ENV
});
check('delete_order User 2 pada pesanan User 1 -> DITOLAK 403 (Tidak diizinkan)', resUser2Delete.status === 403);

// 7. Akses Staf / Admin: Bebas mengakses semua pesanan
const resAdminPayGet = await payHandler({
  request: mkReq('GET', '/api/pay?order_code=ORD-BUDI-1', adminToken),
  env: ENV
});
const jsonAdminPayGet = await resAdminPayGet.json();
check('Staf/Admin memiliki akses penuh ke rincian pesanan pelanggan',
  jsonAdminPayGet.order.customer_phone === '08123456789' &&
  jsonAdminPayGet.order.customer_address === 'Jl. Rahasia User 1 No. 10');

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL FASE 0.6: HIJAU ${pass}, MERAH ${fail} (${pass}/${pass + fail})`);
if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
