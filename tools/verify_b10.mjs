// Harness verifikasi B10 — isolasi data (IDOR) pada endpoint yang mengandung
// data pribadi.
//
// PERTANYAAN YANG DIJAWAB: "kalau aku tidak login, berapa baris milik orang
// lain yang bisa kubaca?" Jawaban yang benar: nol.
//
// Cara ukur: panggil handler SUNGGUHAN dengan driver DB tiruan
// (tools/mock_tidb.mjs) yang mengembalikan 3 baris untuk SELECT apa pun, lalu
// periksa:
//   1. statusnya 401 (bukan 200), dan
//   2. TIDAK ada satu pun SELECT yang benar-benar dikirim ke DB — karena
//      membaca data yang akan dibuang adalah pekerjaan yang sia-sia dan
//      membuka jendela waktu bagi kebocoran.
//
// Untuk sesi SAH, yang diukur adalah kebalikannya: query harus berjalan DAN
// harus menyertakan filter `customer_name` (pemisahan data antar pelanggan
// tetap berfungsi — ini mencegah "perbaikan" yang mematikan fitur).
//
// Jalankan:  node tools/verify_b10_run.mjs

import { onRequest as orders } from '../functions/api/orders.js';
import { onRequest as customers } from '../functions/api/customers.js';
import { onRequest as delivery } from '../functions/api/delivery.js';
import { onRequest as pay } from '../functions/api/pay.js';
import { createSessionToken } from '../functions/_db.js';
import { __calls } from './mock_tidb.mjs';

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

// Baris tiruan: cukup untuk membuktikan "3 baris milik orang lain".
const ROWS = [
  { id: 1, customer_name: 'Orang Lain A', phone: '081', address: 'Jl. A' },
  { id: 2, customer_name: 'Orang Lain B', phone: '082', address: 'Jl. B' },
  { id: 3, customer_name: 'Orang Lain C', phone: '083', address: 'Jl. C' }
];

let pass = 0;
let fail = 0;

function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`HIJAU  ${name}`);
  } else {
    fail++;
    console.log(`MERAH  ${name}${detail ? '  — ' + detail : ''}`);
  }
}

function req(method, path, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = `session_token=${cookie}`;
  return new Request(BASE + path, { method, headers });
}

async function call(handler, path, cookie) {
  __calls.length = 0;
  globalThis.__MOCK_ROWS = ROWS;
  let status = 0;
  let json = null;
  try {
    const res = await handler({ request: req('GET', path, cookie), env: ENV, ctx: {} });
    status = res.status;
    try { json = await res.json(); } catch { /* bukan JSON */ }
  } catch (e) {
    return { status: 0, json: null, err: e.message };
  }
  return { status, json, calls: __calls.slice() };
}

// --- token untuk tiap peran ------------------------------------------------

const staffToken = await createSessionToken(
  { id: 1, full_name: 'Admin', role: 'Admin', email: 'admin@gmail.com' }, ENV);
const custToken = await createSessionToken(
  { id: 9, full_name: 'Budi Santoso', role: 'Customer', email: 'budi@gmail.com' }, ENV);
// Pemilik pesanan uji di bagian 2b (`customer_name: 'Orang Lain A'`).
const ownerToken = await createSessionToken(
  { id: 11, full_name: 'Orang Lain A', role: 'Customer', email: 'lain@gmail.com' }, ENV);

// --- 1. TANPA SESI: 401 dan nol query --------------------------------------

const HANDLERS = [
  ['/api/orders', orders, 'FROM orders'],
  ['/api/customers', customers, 'FROM customers'],
  ['/api/delivery', delivery, 'FROM pickup_delivery']
];

for (const [path, handler, sqlMarker] of HANDLERS) {
  const r = await call(handler, path, null);
  check(`${path} tanpa sesi -> 401`, r.status === 401, `status=${r.status}`);
  check(`${path} tanpa sesi -> ok:false`,
    r.json && r.json.ok === false, JSON.stringify(r.json));
  check(`${path} tanpa sesi -> TIDAK ada baris bocor`,
    !r.json || (r.json.orders === undefined && r.json.customers === undefined &&
      r.json.tasks === undefined), JSON.stringify(r.json)?.slice(0, 120));
  const leaked = (r.calls || []).filter(c => c.sql.includes(sqlMarker));
  check(`${path} tanpa sesi -> nol SELECT ke DB`,
    leaked.length === 0, `SELECT terkirim=${leaked.length}`);
}

// --- 2. SESI SAH: query jalan DAN terfilter --------------------------------

{
  const r = await call(orders, '/api/orders', custToken);
  check('orders sebagai Customer -> 200', r.status === 200, `status=${r.status}`);
  const sel = (r.calls || []).find(c => c.sql.includes('FROM orders'));
  check('orders sebagai Customer -> SELECT dijalankan', !!sel);
  check('orders sebagai Customer -> ADA filter customer_name',
    sel && /customer_name\s*=\s*\?/.test(sel.sql), sel ? sel.sql.replace(/\s+/g, ' ').slice(0, 90) : '-');
  check('orders sebagai Customer -> param berisi namanya sendiri',
    sel && sel.params.includes('Budi Santoso'), sel ? JSON.stringify(sel.params) : '-');
}

{
  const r = await call(orders, '/api/orders', staffToken);
  check('orders sebagai Admin -> 200', r.status === 200, `status=${r.status}`);
  const sel = (r.calls || []).find(c => c.sql.includes('FROM orders'));
  check('orders sebagai Admin -> TANPA filter (staf melihat semua)',
    sel && !/customer_name\s*=\s*\?/.test(sel.sql), sel ? sel.sql.replace(/\s+/g, ' ').slice(0, 90) : '-');
}

{
  const r = await call(customers, '/api/customers', staffToken);
  check('customers sebagai Admin -> 200', r.status === 200, `status=${r.status}`);
}

{
  const r = await call(customers, '/api/customers', custToken);
  check('customers sebagai Customer -> 401 (bukan daftar lengkap)',
    r.status === 401, `status=${r.status}`);
}

{
  const r = await call(delivery, '/api/delivery', custToken);
  check('delivery sebagai Customer -> 200', r.status === 200, `status=${r.status}`);
  const sel = (r.calls || []).find(c => c.sql.includes('FROM pickup_delivery'));
  check('delivery sebagai Customer -> ADA filter customer_name',
    sel && /customer_name\s*=\s*\?/.test(sel.sql), sel ? sel.sql.replace(/\s+/g, ' ').slice(0, 90) : '-');
}

// --- 2b. /api/pay: kode pesanan bukan tiket untuk membaca alamat -----------
//
// Halaman pembayaran MEMANG sengaja bisa dibuka tanpa login (capability URL),
// jadi 401 di sini justru akan merusak fitur. Yang diuji: PII tidak ikut
// terkirim ke pemanggil yang bukan pemilik pesanannya.

{
  __calls.length = 0;
  globalThis.__MOCK_ROWS = [{
    id: 7,
    order_code: 'ORD-TEST01',
    customer_name: 'Orang Lain A',
    customer_phone: '08123456789',
    customer_address: 'Jl. Rahasia No. 9',
    service_name: 'Cuci Kering',
    total_amount: 75000,
    payment_status: 'unpaid'
  }];

  const anon = await pay({
    request: req('GET', '/api/pay?order_code=ORD-TEST01', null), env: ENV, ctx: {}
  });
  const anonJson = await anon.json();
  check('pay anonim -> 200 (fitur tetap jalan)', anon.status === 200, `status=${anon.status}`);
  check('pay anonim -> telepon TIDAK dikirim',
    anonJson?.order?.customer_phone === null, JSON.stringify(anonJson?.order?.customer_phone));
  check('pay anonim -> alamat TIDAK dikirim',
    anonJson?.order?.customer_address === null, JSON.stringify(anonJson?.order?.customer_address));
  check('pay anonim -> total & status tetap dikirim (halaman butuh)',
    anonJson?.order?.total_amount === 75000 && anonJson?.order?.payment_status === 'unpaid',
    JSON.stringify(anonJson?.order));

  // Pemilik yang sah tetap menerima data lengkapnya.
  const owner = await pay({
    request: req('GET', '/api/pay?order_code=ORD-TEST01', ownerToken), env: ENV, ctx: {}
  });
  const ownerJson = await owner.json();
  check('pay sebagai pemilik -> PII tetap utuh',
    ownerJson?.order?.customer_phone === '08123456789' &&
    ownerJson?.order?.customer_address === 'Jl. Rahasia No. 9',
    JSON.stringify(ownerJson?.order));

  const staff = await pay({
    request: req('GET', '/api/pay?order_code=ORD-TEST01', staffToken), env: ENV, ctx: {}
  });
  const staffJson = await staff.json();
  check('pay sebagai Admin -> PII tetap utuh',
    staffJson?.order?.customer_phone === '08123456789',
    JSON.stringify(staffJson?.order?.customer_phone));
}

// --- 3. SESI RUSAK: token palsu tidak boleh jadi jalan masuk ---------------

{
  const r = await call(orders, '/api/orders', 'payload-palsu.tanda-tangan-palsu');
  check('orders dengan token palsu -> 401', r.status === 401, `status=${r.status}`);
}

// --- ringkasan -------------------------------------------------------------

console.log('');
console.log(`HASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
