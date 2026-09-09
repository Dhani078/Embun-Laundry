// Harness verifikasi B2 — validasi & sanitasi input server-side.
//
// Pola yang sama seperti B7: ganti driver DB dengan mock pencatat lewat ESM
// loader, lalu ukur apa yang BENAR-BENAR dikirim — bukan apa yang tertulis
// di sumber. Bedanya, di sini yang diukur adalah:
//   1. handler MENOLAK input buruk dengan 400 (bukan 500, bukan lolos), dan
//   2. input yang DITERIMA sudah dibersihkan/dibatasi sebelum sampai ke SQL.
//
// Jalan: node tools/verify_b2_run.mjs  (pembungkus register loader)

import { onRequest as customers } from '../functions/api/customers.js';
import { onRequest as services } from '../functions/api/services.js';
import { onRequest as orders } from '../functions/api/orders.js';
import { onRequest as promos } from '../functions/api/promos.js';
import { onRequest as vouchers } from '../functions/api/vouchers.js';
import { onRequestPost as register } from '../functions/api/auth/register.js';
import { onRequestPost as login } from '../functions/api/auth/login.js';

import { __calls } from './mock_tidb.mjs';

// --- lingkungan tiruan -----------------------------------------------------

const ENV = {
  TIDB_DATABASE_URL: 'mysql://mock',
  JWT_SECRET: 'test-secret'
};

let REAL_TOKEN = null;

function req(method, url, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = `session_token=${cookie}`;
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

const HANDLERS = { customers, services, orders, promos, vouchers };
const BASE = 'https://example.test';

async function call(target, method, path, body, cookie) {
  const fn = HANDLERS[target];
  const res = await fn({ request: req(method, BASE + path, body, cookie), env: ENV, ctx: {} });
  let json = null;
  try { json = await res.json(); } catch { /* bukan JSON */ }
  return { status: res.status, json };
}

async function callAuth(fn, body) {
  const res = await fn({ request: req('POST', BASE + '/api/auth/x', body), env: ENV, ctx: {} });
  let json = null;
  try { json = await res.json(); } catch { /* bukan JSON */ }
  return { status: res.status, json };
}

// --- kerangka uji ----------------------------------------------------------

const results = [];
let failures = 0;

function check(name, condition, detail = '') {
  const ok = !!condition;
  if (!ok) failures++;
  results.push({ name, ok, detail });
  console.log(`${ok ? 'HIJAU' : 'MERAH'}  ${name}${detail ? '  — ' + detail : ''}`);
}

/** Nilai buruk standar yang wajib ditolak oleh SETIAP field teks/angka. */
const BAD = {
  xss: '<script>alert(1)</script>',
  ctrl: 'nama\u0000\u0007dengan\u007Fkontrol',
  long: 'A'.repeat(5000),
  negInt: -999,
  float: 1.5,
  nanString: 'bukan-angka'
};

// --- 1. Modul validator: uji satuan ---------------------------------------

const { validate, cleanStr, isEmail, isDate } = await import('../functions/_validate.js');

// Karakter kontrol diganti SPASI, bukan dihapus: 'Budi\0Santoso' harus menjadi
// 'Budi Santoso' (dua kata tetap terpisah), bukan 'BudiSantoso' (melebur).
// Yang diuji: tidak ada satu pun karakter kontrol yang tersisa.
const cleaned = cleanStr('a\u0000b\u0007c\u007F');
check('cleanStr membuang karakter kontrol',
  !/[\u0000-\u001F\u007F]/.test(cleaned) && cleaned === 'a b c',
  JSON.stringify(cleaned));

check('cleanStr merapikan spasi ganda',
  cleanStr('  dua   spasi  ') === 'dua spasi');

check('isEmail menolak "a@b"', !isEmail('a@b'));
check('isEmail menerima "a@b.co"', isEmail('a@b.co'));
check('isDate menolak 2026-02-30', !isDate('2026-02-30'));
check('isDate menerima 2026-02-28', isDate('2026-02-28'));

check('validate: field wajib kosong -> ok:false',
  validate({}, { name: { type: 'str', required: true } }).ok === false);

check('validate: melebihi max -> ok:false',
  validate({ name: 'A'.repeat(300) }, { name: { type: 'str', max: 120 } }).ok === false);

check('validate: enum asing -> ok:false',
  validate({ s: 'apapun' }, { s: { type: 'enum', values: ['baru'] } }).ok === false);

check('validate: enum sah -> ok:true',
  validate({ s: 'baru' }, { s: { type: 'enum', values: ['baru'] } }).ok === true);

check('validate: int negatif -> ok:false',
  validate({ n: -5 }, { n: { type: 'int', min: 1 } }).ok === false);

check('validate: int desimal -> ok:false',
  validate({ n: 1.5 }, { n: { type: 'int' } }).ok === false);

check('validate: sandi TIDAK dibersihkan (spasi ganda terjaga)',
  validate({ p: 'sandi  dengan  spasi' }, { p: { type: 'raw', max: 200 } }).data.p === 'sandi  dengan  spasi');

// --- 2. Handler menolak input buruk dengan 400 ----------------------------

// Buat token staf yang benar-benar sah untuk menguji jalur admin.
{
  const { createSessionToken } = await import('../functions/_db.js');
  REAL_TOKEN = await createSessionToken({ id: 1, full_name: 'Admin', role: 'Admin', email: 'admin@gmail.com' }, ENV);
}

const STAFF = REAL_TOKEN;

// customers: create_customer
for (const [label, payload] of [
  ['nama kosong', { action: 'create_customer', full_name: '', phone: '', address: '' }],
  ['nama 5000 char', { action: 'create_customer', full_name: BAD.long }],
  ['nama 1 char', { action: 'create_customer', full_name: 'A' }]
]) {
  const r = await call('customers', 'POST', '/api/customers', payload, STAFF);
  check(`customers create: ${label} -> 400`, r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);
}

// customers: update/delete dengan id buruk
{
  const r = await call('customers', 'POST', '/api/customers', { action: 'delete_customer', id: 'abc' }, STAFF);
  check('customers delete: id "abc" -> 400', r.status === 400, `status=${r.status}`);
  const r2 = await call('customers', 'POST', '/api/customers', { action: 'delete_customer', id: -1 }, STAFF);
  check('customers delete: id -1 -> 400', r2.status === 400, `status=${r2.status}`);
}

// services: create_service
for (const [label, payload] of [
  ['nama kosong', { action: 'create_service', name: '' }],
  ['harga negatif', { action: 'create_service', name: 'Cuci', price: -100 }],
  ['berat/durasi 10^9', { action: 'create_service', name: 'Cuci', est_hours: 1000000000 }],
  ['satuan asing', { action: 'create_service', name: 'Cuci', unit: 'kilogram' }]
]) {
  const r = await call('services', 'POST', '/api/services', payload, STAFF);
  check(`services create: ${label} -> 400`, r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);
}

// orders: create_order
for (const [label, payload] of [
  ['service_id 0', { action: 'create_order', service_id: 0 }],
  ['berat 100000 kg', { action: 'create_order', service_id: 1, weight_kg: 100000 }],
  ['diskon negatif', { action: 'create_order', service_id: 1, discount: -500 }]
]) {
  const r = await call('orders', 'POST', '/api/orders', payload, STAFF);
  check(`orders create: ${label} -> 400`, r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);
}

// orders: move_status dengan status asing
{
  const r = await call('orders', 'POST', '/api/orders', { action: 'move_status', id: 1, status: 'ludes' }, STAFF);
  check('orders move_status: status asing -> 400', r.status === 400, `status=${r.status}`);
}

// orders: GET dengan tanggal buruk
{
  const r = await call('orders', 'GET', '/api/orders?start=abc&end=2026-01-01', undefined, STAFF);
  check('orders GET: start tidak berformat -> 400', r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);
}

// promos: create_promo
for (const [label, payload] of [
  ['nama kosong', { action: 'create_promo', name: '' }],
  ['tipe asing', { action: 'create_promo', name: 'Promo', type: 'gratis' }],
  ['persen 500', { action: 'create_promo', name: 'Promo', type: 'percent', value: 500 }],
  ['min_spend negatif', { action: 'create_promo', name: 'Promo', min_spend: -1 }]
]) {
  const r = await call('promos', 'POST', '/api/promos', payload, STAFF);
  check(`promos create: ${label} -> 400`, r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);
}

// vouchers: claim / bulk_claim
{
  const r = await call('vouchers', 'POST', '/api/vouchers', { action: 'claim', promo_id: 0 }, STAFF);
  check('vouchers claim: promo_id 0 -> 400', r.status === 400, `status=${r.status}`);
  const r2 = await call('vouchers', 'POST', '/api/vouchers',
    { action: 'bulk_claim', promo_id: 1, user_ids: [1, 'abc', 3] }, STAFF);
  check('vouchers bulk_claim: id non-angka -> 400', r2.status === 400, `status=${r2.status}`);
  const r3 = await call('vouchers', 'POST', '/api/vouchers',
    { action: 'bulk_claim', promo_id: 1, user_ids: Array.from({ length: 501 }, (_, i) => i + 1) }, STAFF);
  check('vouchers bulk_claim: 501 user -> 400', r3.status === 400, `status=${r3.status}`);
}

// register
for (const [label, payload] of [
  ['email tanpa domain', { full_name: 'Budi Santoso', email: 'budi@', password: 'rahasia123', confirm: 'rahasia123' }],
  ['sandi 5 char', { full_name: 'Budi Santoso', email: 'budi@gmail.com', password: '12345', confirm: '12345' }],
  ['nama 1 char', { full_name: 'B', email: 'budi@gmail.com', password: 'rahasia123', confirm: 'rahasia123' }],
  ['konfirmasi beda', { full_name: 'Budi Santoso', email: 'budi@gmail.com', password: 'rahasia123', confirm: 'lain12345' }],
  ['sandi 5000 char', { full_name: 'Budi Santoso', email: 'budi@gmail.com', password: BAD.long, confirm: BAD.long }]
]) {
  const r = await callAuth(register, payload);
  check(`register: ${label} -> 400`, r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);
}

// login: identitas raksasa ditolak SEBELUM menyentuh DB
{
  __calls.length = 0;
  const r = await callAuth(login, { identity: BAD.long, password: 'x' });
  check('login: identitas 5000 char -> 400', r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);
  check('login: identitas raksasa TIDAK sampai ke DB',
    __calls.length === 0, `panggilan SQL=${__calls.length}`);
}

// --- 3. Input yang DITERIMA sudah dibersihkan -----------------------------

{
  __calls.length = 0;
  const r = await call('customers', 'POST', '/api/customers', {
    action: 'create_customer',
    full_name: '  Budi\u0000  Santoso  ',
    phone: '0812\u0007',
    address: 'Jl.  Melati   No. 1'
  }, STAFF);
  check('customers create: input bersih -> bukan 400', r.status !== 400, `status=${r.status}`);

  const insert = __calls.find(c => c.sql.includes('INSERT INTO customers'));
  check('customers create: karakter kontrol dibuang dari SQL',
    insert && !/[\u0000\u0007]/.test(JSON.stringify(insert.params)),
    insert ? JSON.stringify(insert.params) : 'tidak ada INSERT');
  check('customers create: spasi dirapikan',
    insert && insert.params[1] === 'Budi Santoso',
    insert ? JSON.stringify(insert.params[1]) : '-');
  check('customers create: alamat dirapikan',
    insert && insert.params[3] === 'Jl. Melati No. 1',
    insert ? JSON.stringify(insert.params[3]) : '-');
}

{
  __calls.length = 0;
  await call('orders', 'GET', '/api/orders?q=' + encodeURIComponent('<script>x</script>'), undefined, STAFF);
  const sel = __calls.find(c => c.sql.includes('FROM orders'));
  check('orders GET: query dibatasi 100 char maksimal',
    sel && sel.params.every(p => typeof p !== 'string' || p.length <= 102),
    sel ? JSON.stringify(sel.params.map(p => typeof p === 'string' ? p.length : p)) : 'tidak ada SELECT');
}

// --- 4. Tanpa otorisasi, handler tetap menolak lebih dulu -----------------

{
  const r = await call('services', 'POST', '/api/services', { action: 'create_service', name: '' });
  check('services create tanpa sesi -> 401 (bukan 500)', r.status === 401, `status=${r.status}`);
}

// --- ringkasan -------------------------------------------------------------

console.log('');
const total = results.length;
const passed = results.filter(r => r.ok).length;
console.log(`HASIL: ${failures === 0 ? 'HIJAU' : 'MERAH'} (${passed}/${total})`);
process.exit(failures === 0 ? 0 : 1);
