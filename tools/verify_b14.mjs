// Harness verifikasi B14 — pesan error generik di 9 modul yang tersisa.
//
// Latar belakang (dicatat sendiri oleh tick 17 di AGENT_BACKLOG.md entri 12):
// pola `msg: e.message` masih ada di 18 titik. B13 baru membersihkan
// `profile.js`. Entri itu mengingatkan: "Setiap modul punya kontraknya
// sendiri — kerjakan per modul beserta harness-nya. Jangan sapu semua
// sekaligus tanpa uji."
//
// Kenapa ini layak dikerjakan SEBELUM diukur:
//   `e.message` pada 500 berasal dari driver @tidbcloud/serverless. Pesan
//   seperti "connect ECONNREFUSED" atau "Unknown column 'x'" dapat memuat
//   host, nama database, nama tabel, dan nomor baris. Kontrak A4 menuntut
//   `{ ok: false, msg }` yang aman untuk ditampilkan ke pengguna.
//
// Kenapa TIDAK disapu sekaligus tanpa uji:
//   Dua dari sembilan modul punya jalur di mana pesan error memang
//   dibutuhkan klien — dan satu lainnya tidak pernah mencapai catch.
//   Harness ini mengukur semuanya supaya yang diubah hanya yang terbukti.
//
// Cara ukur: paksa driver tiruan melempar (mock `__MOCK_ROWS` yang throw),
// lalu periksa bahwa pesan RAHASIA tidak pernah ikut ke badan respons.
// Pola ini sama dengan uji "tidak bocor" di verify_b13.
//
// Jalankan:  node tools/verify_b14_run.mjs

import { onRequest as checkin } from '../functions/api/checkin.js';
import { onRequest as customers } from '../functions/api/customers.js';
import { onRequestGet as dashboard } from '../functions/api/dashboard.js';
import { onRequest as delivery } from '../functions/api/delivery.js';
import { onRequest as orders } from '../functions/api/orders.js';
import { onRequest as pay } from '../functions/api/pay.js';
import { onRequest as promos } from '../functions/api/promos.js';
import { onRequestGet as reports } from '../functions/api/reports.js';
import { onRequest as services } from '../functions/api/services.js';
import { onRequest as vouchers } from '../functions/api/vouchers.js';
import { onRequestPost as login } from '../functions/api/auth/login.js';
import { onRequestPost as register } from '../functions/api/auth/register.js';
import { createSessionToken, hashPassword } from '../functions/_db.js';
import { resetAll } from '../functions/_ratelimit.js';
import { __calls } from './mock_tidb.mjs';

// Hash PBKDF2 sah untuk sandi "admin123", dihasilkan oleh `hashPassword()`
// yang sama dengan produksi (B8). Dihitung sekali saat harness berjalan —
// bukan diketik — supaya tidak pernah menyimpang dari algoritma aktual.
const PASS_HASH = await hashPassword('admin123');

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

// Penanda yang WAJIB tidak pernah muncul di badan respons mana pun.
const SECRET = 'RAHASIA';
const SECRET_MSG = `${SECRET}: connection string mysql://user:pw@gateway.tidbcloud.com/db?line=42`;

let pass = 0;
let fail = 0;

function check(name, cond, detail = '') {
  const short = String(detail).length > 180 ? String(detail).slice(0, 180) + '…' : detail;
  if (cond) {
    pass++;
    console.log(`HIJAU  ${name}`);
  } else {
    fail++;
    console.log(`MERAH  ${name}${short ? '  — ' + short : ''}`);
  }
}

function req(method, path, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = `session_token=${cookie}`;
  return new Request(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

/**
 * Panggil handler dengan driver tiruan yang melempar.
 * `rowsFor` = null berarti SEMUA query melempar (kegagalan DB total).
 */
async function call(fn, method, path, body, cookie, rowsFor = null) {
  __calls.length = 0;
  globalThis.__MOCK_ROWS = rowsFor === null
    ? () => { throw new Error(SECRET_MSG); }
    : rowsFor;
  let status = 0;
  let json = null;
  let text = '';
  try {
    const res = await fn({ request: req(method, path, body, cookie), env: ENV, ctx: {} });
    status = res.status;
    text = await res.text();
    try { json = JSON.parse(text); } catch { /* bukan JSON */ }
  } catch (e) {
    return { status: 0, json: null, text: '', err: e.message, calls: __calls.slice() };
  }
  return { status, json, text, calls: __calls.slice() };
}

/** Tidak ada satu pun penanda rahasia di badan respons. */
function clean(j, text) {
  const blob = String(text ?? '') + ' ' + JSON.stringify(j ?? {});
  return !blob.includes(SECRET) && !blob.includes('mysql://') && !blob.includes('tidbcloud');
}

// --- token untuk tiap peran ------------------------------------------------

const custToken = await createSessionToken(
  { id: 9, full_name: 'Budi Santoso', role: 'Customer', email: 'budi@gmail.com' }, ENV);
const staffToken = await createSessionToken(
  { id: 1, full_name: 'Admin Uji', role: 'Admin', email: 'admin@gmail.com' }, ENV);

// ==========================================================================
// [1] checkin.js — GET & POST
// ==========================================================================

console.log('[1] /api/checkin — dua catch');

{
  const r = await call(checkin, 'GET', '/api/checkin', undefined, custToken);
  check('checkin GET gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('checkin GET -> ok:false', r.json?.ok === false, JSON.stringify(r.json));
  check('checkin GET -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

{
  const r = await call(checkin, 'POST', '/api/checkin', undefined, custToken);
  check('checkin POST gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('checkin POST -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

// ==========================================================================
// [2] customers.js — GET & POST
// ==========================================================================

console.log('\n[2] /api/customers — dua catch');

{
  const r = await call(customers, 'GET', '/api/customers', undefined, staffToken);
  check('customers GET gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('customers GET -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

{
  const r = await call(customers, 'POST', '/api/customers',
    { action: 'create_customer', full_name: 'Uji', phone: '0812' }, staffToken);
  check('customers POST gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('customers POST -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

// ==========================================================================
// [3] dashboard.js — satu catch
// ==========================================================================

console.log('\n[3] /api/dashboard — satu catch');

{
  const r = await call(dashboard, 'GET', '/api/dashboard', undefined, staffToken);
  check('dashboard gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('dashboard -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

// ==========================================================================
// [4] delivery.js — GET & POST
// ==========================================================================

console.log('\n[4] /api/delivery — dua catch');

{
  const r = await call(delivery, 'GET', '/api/delivery', undefined, staffToken);
  check('delivery GET gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('delivery GET -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

{
  // `create_task` butuh `type` + `customer_name` + `address`; ketiganya
  // diisi supaya uji masuk ke INSERT (yang melempar), bukan berhenti di 400.
  const r = await call(delivery, 'POST', '/api/delivery',
    { action: 'create_task', type: 'pickup', customer_name: 'Uji', address: 'Jl. Uji' },
    staffToken);
  check('delivery POST gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('delivery POST -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

// ==========================================================================
// [5] orders.js — GET & POST
// ==========================================================================

console.log('\n[5] /api/orders — dua catch');

{
  const r = await call(orders, 'GET', '/api/orders', undefined, staffToken);
  check('orders GET gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('orders GET -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

{
  // `create_order` butuh `service_id` (wajib) agar lolos validasi B2 dan
  // benar-benar menjalankan INSERT, bukan berhenti di 400.
  const r = await call(orders, 'POST', '/api/orders',
    { action: 'create_order', customer_name: 'Uji', service_id: 1 }, staffToken);
  check('orders POST gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('orders POST -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

// ==========================================================================
// [6] pay.js — GET & POST
// ==========================================================================

console.log('\n[6] /api/pay — dua catch + defek validasi jumlah');

{
  const r = await call(pay, 'GET', '/api/pay?order_code=ORD-1', undefined, staffToken);
  check('pay GET gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('pay GET -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

{
  const r = await call(pay, 'POST', '/api/pay', { order_code: 'ORD-1', amount: 1000 }, staffToken);
  check('pay POST gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('pay POST -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

// --- Defek B2 di /api/pay: `amount` tidak divalidasi -----------------------
// `parseInt(body.amount) || 0` menerima string, objek, array, NaN, Infinity,
// dan angka negatif tanpa batas. Jumlah bayar adalah NILAI UANG — ia harus
// ditolak di klien dengan 400, bukan diteruskan ke kolom `payments.amount`.
// Baris tiruan di bawah mengembalikan order sah supaya uji menyentuh
// validasi, bukan jalur "pesanan tidak ditemukan".

const ORDER_ROW = {
  id: 5, order_code: 'ORD-1', customer_name: 'Budi Santoso',
  customer_phone: '0812', customer_address: 'Jl. Uji',
  service_id: 1, total_amount: 50000, status: 'baru'
};

function payRows(sql) {
  if (/FROM\s+orders/i.test(sql)) return [ORDER_ROW];
  return [];
}

console.log('\n[6b] /api/pay POST — validasi jumlah (B2)');

for (const [label, amount] of [
  ['negatif', -1000],
  ['nol', 0],
  ['NaN (string)', 'abc'],
  ['Infinity', 'Infinity'],
  ['objek', { n: 1 }],
  ['array', [1, 2]],
  ['lebih dari batas wajar', 2000000000]
]) {
  const r = await call(pay, 'POST', '/api/pay', { order_code: 'ORD-1', amount }, staffToken, payRows);
  check(`pay amount ${label} -> 400`, r.status === 400, `status=${r.status} body=${r.text}`);
  check(`pay amount ${label} -> ok:false`, r.json?.ok === false, JSON.stringify(r.json));
  // Jumlah yang ditolak TIDAK BOLEH menghasilkan INSERT ke payments.
  const inserted = r.calls.some(c => /INSERT\s+INTO\s+payments/i.test(c.sql));
  check(`pay amount ${label} -> tidak ada INSERT`, !inserted,
    r.calls.map(c => c.sql).join(' | '));
}

{
  // Jalur SUKSES tidak boleh mati: amount wajar tetap 200 dan tersimpan.
  const r = await call(pay, 'POST', '/api/pay', { order_code: 'ORD-1', amount: 50000 }, staffToken, payRows);
  check('pay amount wajar -> 200', r.status === 200, `status=${r.status} body=${r.text}`);
  check('pay amount wajar -> ok:true', r.json?.ok === true, JSON.stringify(r.json));
  const ins = r.calls.find(c => /INSERT\s+INTO\s+payments/i.test(c.sql));
  check('pay amount wajar -> INSERT payments', !!ins, r.calls.map(c => c.sql).join(' | '));
  check('pay amount wajar -> amount ikut ter-parameterisasi',
    ins && Array.isArray(ins.params) && ins.params.includes(50000),
    JSON.stringify(ins?.params));
}

{
  // `method` dikirim mentah ke kolom ENUM. Nilai asing -> 400, bukan 500 dari DB.
  const r = await call(pay, 'POST', '/api/pay',
    { order_code: 'ORD-1', amount: 50000, method: "QRIS'; DROP TABLE payments--" },
    staffToken, payRows);
  check('pay method asing -> 400', r.status === 400, `status=${r.status} body=${r.text}`);
  check('pay method asing -> tidak ada INSERT',
    !r.calls.some(c => /INSERT\s+INTO\s+payments/i.test(c.sql)),
    r.calls.map(c => c.sql).join(' | '));
}

{
  // Metode yang SAH tetap diterima (fitur tidak mati).
  const r = await call(pay, 'POST', '/api/pay',
    { order_code: 'ORD-1', amount: 50000, method: 'DANA' }, staffToken, payRows);
  check('pay method DANA -> 200', r.status === 200, `status=${r.status} body=${r.text}`);
}

{
  // `order_code` raksasa: kolomnya VARCHAR, jadi panjangnya wajar dibatasi.
  const r = await call(pay, 'POST', '/api/pay',
    { order_code: 'X'.repeat(5000), amount: 50000 }, staffToken, payRows);
  check('pay order_code raksasa -> 400', r.status === 400, `status=${r.status}`);
}

// ==========================================================================
// [7] promos.js — GET & POST
// ==========================================================================

console.log('\n[7] /api/promos — dua catch');

{
  const r = await call(promos, 'GET', '/api/promos', undefined, staffToken);
  check('promos GET gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('promos GET -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

{
  const r = await call(promos, 'POST', '/api/promos',
    { action: 'create_promo', name: 'Uji' }, staffToken);
  check('promos POST gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('promos POST -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

// ==========================================================================
// [8] reports.js — satu catch (jalur staf)
// ==========================================================================

console.log('\n[8] /api/reports — satu catch');

{
  const r = await call(reports, 'GET', '/api/reports', undefined, staffToken);
  check('reports gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('reports -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

// ==========================================================================
// [9] services.js — GET & POST
// ==========================================================================

console.log('\n[9] /api/services — dua catch');

{
  const r = await call(services, 'GET', '/api/services', undefined, null);
  check('services GET gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('services GET -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

{
  const r = await call(services, 'POST', '/api/services',
    { action: 'create_service', name: 'Uji' }, staffToken);
  check('services POST gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('services POST -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

// ==========================================================================
// [10] vouchers.js — GET & POST
// ==========================================================================

console.log('\n[10] /api/vouchers — dua catch');

{
  const r = await call(vouchers, 'GET', '/api/vouchers', undefined, custToken);
  check('vouchers GET gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('vouchers GET -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

{
  // Aksi `claim` butuh staf — pakai staffToken supaya uji menyentuh catch,
  // bukan berhenti di 401 (vouchers.js menolak POST non-staf lebih dulu).
  const r = await call(vouchers, 'POST', '/api/vouchers',
    { action: 'claim', promo_id: 7 }, staffToken);
  check('vouchers POST gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('vouchers POST -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

// ==========================================================================
// [11] auth/login.js — catch 500
// ==========================================================================

console.log('\n[11] /api/auth/login — catch 500');

{
  // Kegagalan DB TOTAL (query `users` sendiri melempar) -> catch -> 500.
  resetAll();
  const r = await call(login, 'POST', '/api/auth/login',
    { identity: 'admin@gmail.com', password: 'admin123' }, null);
  check('login gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('login -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

{
  // Kontrak B1: header rate limit tetap terpasang pada jalur error 500.
  resetAll();
  __calls.length = 0;
  globalThis.__MOCK_ROWS = () => { throw new Error(SECRET_MSG); };
  const res = await login({
    request: req('POST', '/api/auth/login',
      { identity: 'admin@gmail.com', password: 'admin123' }, null),
    env: ENV, ctx: {}
  });
  const limit = res.headers.get('X-RateLimit-Limit');
  const remaining = res.headers.get('X-RateLimit-Remaining');
  check('login 500 -> X-RateLimit-Limit = 10', limit === '10', String(limit));
  check('login 500 -> X-RateLimit-Remaining terpasang', remaining !== null, String(remaining));
}

{
  // Jalur SUKSES tidak boleh mati gara-gara pesan digenerik: sandi PBKDF2
  // yang sah (B8) tetap menghasilkan 200 + cookie sesi.
  resetAll();
  __calls.length = 0;
  globalThis.__MOCK_ROWS = (sql) => {
    if (/FROM\s+users/i.test(sql)) {
      return [{
        id: 1, full_name: 'Admin Uji', email: 'admin@gmail.com',
        password_hash: PASS_HASH, role: 'Admin'
      }];
    }
    return [];
  };
  const res = await login({
    request: req('POST', '/api/auth/login',
      { identity: 'admin@gmail.com', password: 'admin123' }, null),
    env: ENV, ctx: {}
  });
  const j = await res.json().catch(() => null);
  check('login sukses -> 200', res.status === 200, `status=${res.status}`);
  check('login sukses -> ok:true', j?.ok === true, JSON.stringify(j));
  check('login sukses -> Set-Cookie HttpOnly; Secure; SameSite=Lax',
    /HttpOnly/.test(res.headers.get('Set-Cookie') || '') &&
    /Secure/.test(res.headers.get('Set-Cookie') || '') &&
    /SameSite=Lax/.test(res.headers.get('Set-Cookie') || ''),
    String(res.headers.get('Set-Cookie')));
}

// ==========================================================================
// [12] auth/register.js — catch 500 (jalur email sudah terdaftar)
// ==========================================================================

console.log('\n[12] /api/auth/register — catch 500');

{
  const r = await call(register, 'POST', '/api/auth/register', {
    full_name: 'Uji Nama', email: 'uji@example.com',
    phone: '081234567890', password: 'rahasia123', confirm: 'rahasia123'
  }, null, () => { throw new Error(SECRET_MSG); });
  check('register gagal DB -> 500', r.status === 500, `status=${r.status}`);
  check('register -> pesan generik', clean(r.json, r.text), String(r.json?.msg));
}

// ==========================================================================
// [13] Tidak ada satu pun modul yang masih menyisipkan e.message mentah
// ==========================================================================

console.log('\n[13] Audit statik — tidak ada `msg: e.message` tersisa');

{
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../functions/api/', import.meta.url).pathname
    .replace(/^\/([A-Za-z]:)/, '$1');
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(d + e.name + '/');
      else if (e.name.endsWith('.js')) files.push(d + e.name);
    }
  };
  walk(dir);
  const offenders = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    // Buang komentar DULU. `profile.js` menyimpan catatan B13 yang menulis
    // "dulu `msg: e.message`" di dalam komentar — tanpa pembersihan ini
    // audit akan MERAH PALSU pada file yang justru sudah benar.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')     // blok komentar
      .replace(/(^|[^:])\/\/.*$/gm, '$1');  // komentar baris
    // Pola lama: `msg: e.message`, `msg: 'Server error: ' + e.message`, dst.
    if (/msg:\s*[^,\n}]*e\.message/.test(code)) offenders.push(f);
  }
  check('nol `msg: ... e.message` di functions/api/', offenders.length === 0,
    offenders.join(', '));
}

console.log('');
console.log(`HASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
