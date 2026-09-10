// Harness verifikasi B16 — batas validasi diselaraskan dengan lebar kolom
// TiDB, dan `promos.expires_at` divvalidasi formatnya (bukan hanya panjang).
//
// ===========================================================================
// Kenapa layak dicurigai SEBELUM diukur
// ===========================================================================
// Sejak B2 (tick 11) setiap handler menulis batas panjang SEBARIS:
// `max: 120`, `max: 30`, `max: 500`. Angka itu tidak pernah dibandingkan
// dengan kolom yang dituju. Dua akibat yang mungkin, keduanya buruk:
//
//   - TERLALU LONGGAR -> nilai lewat validasi kita, lalu ditolak TiDB.
//     Klien menerima **500 "Terjadi kesalahan pada server"** — bukan 400
//     yang menyebut field mana yang salah.
//   - TERLALU KETAT   -> data sah ditolak mentah-mentah.
//
// Keduanya diukur di produksi pada tick ini dengan nilai batas (N -> 200,
// N+1 -> 500), bukan ditebak. Hasilnya:
//
//   500 (batas terlalu longgar):
//     services.name        120 -> 80     orders.customer_name  120 -> 100
//     services.code         40 -> 20     orders.customer_addr  500 -> 255
//     services.category     60 -> 20     customers.address     500 -> 255
//     services.badge        40 -> 30     promos.code            40 -> 32
//     users.full_name      120 -> 100    (profile & register)
//     promos.expires_at  'besok-saja' -> 500 (format, bukan panjang)
//   400 (batas terlalu ketat — arah sebaliknya):
//     customers.phone 30 -> 32 (kolom VARCHAR(32))
//     orders.customer_phone 30 -> 32
//
// ===========================================================================
// Kontrak yang diuji (diukur dari SQL/params yang BENAR-BENAR terkirim)
// ===========================================================================
//   1. Nilai sepanjang lebar kolom  -> DITERIMA, INSERT/UPDATE terkirim.
//   2. Nilai satu karakter lebih    -> 400, pesan menyebut field itu,
//                                      dan SATU pun baris tidak tersentuh.
//   3. `expires_at` format ngawur   -> 400 (dulu 500).
//   4. Jalur SUKSES tidak mati (kontrol pendek tetap 200).
//
// Jebakan yang sengaja dihindari (pelajaran tick 23):
//   - Setiap uji 400 HARUS memeriksa bahwa pesannya menyebut field yang
//     diuji. Tanpa itu, "400 karena alasan lain" akan tampil HIJAU.
//   - Setiap uji batas butuh pasangan N (boleh) dan N+1 (tolak) pada
//     jalur yang SAMA, supaya mutasi salah satu saja ketahuan.
//
// Jalankan:  node tools/verify_b16_run.mjs

import { onRequest as services } from '../functions/api/services.js';
import { onRequest as promos } from '../functions/api/promos.js';
import { onRequest as customers } from '../functions/api/customers.js';
import { onRequest as orders } from '../functions/api/orders.js';
import { onRequest as profile } from '../functions/api/profile.js';
import { onRequestPost as register } from '../functions/api/auth/register.js';
import { createSessionToken } from '../functions/_db.js';
import { isDateTime } from '../functions/_validate.js';
import { COL, colWidth, col } from '../functions/_schema.js';
import { __calls } from './mock_tidb.mjs';

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

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

function req(method, path, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = `session_token=${cookie}`;
  return new Request(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

const staffToken = await createSessionToken(
  { id: 1, full_name: 'Admin Uji', role: 'Admin', email: 'admin@gmail.com' }, ENV);

async function call(fn, method, path, body, cookie, rowsFor) {
  __calls.length = 0;
  globalThis.__MOCK_ROWS = rowsFor || (() => []);
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

/** Tidak ada pernyataan yang MENGUBAH baris (INSERT/UPDATE/DELETE). */
function untouched(calls) {
  return !calls.some(c => /^\s*(INSERT|UPDATE|DELETE)/i.test(String(c.sql).replace(/\s+/g, ' ')));
}

const len = n => 'X'.repeat(n);

/**
 * Uji satu batas: panjang `ok` harus diterima, panjang `bad` harus 400
 * dengan pesan yang menyebut `label`, dan tidak menyentuh baris.
 */
async function bound(tc) {
  const { handler, path, act, field, label, ok, bad, extra = {}, cookie = staffToken } = tc;

  // --- sisi DITERIMA -----------------------------------------------------
  const good = await call(handler, 'POST', path,
    { action: act, ...extra, [field]: len(ok) }, cookie);
  check(`${act}: ${field} ${ok} char -> diterima (200)`,
    good.status === 200, `status=${good.status} ${good.text.slice(0, 90)}`);
  check(`${act}: ${field} ${ok} char -> pernyataan tulis terkirim`,
    good.calls.some(c => /^\s*(INSERT|UPDATE)/i.test(String(c.sql).replace(/\s+/g, ' '))),
    good.calls.map(c => String(c.sql).slice(0, 40)).join(' | '));

  // --- sisi DITOLAK ------------------------------------------------------
  const bad_ = await call(handler, 'POST', path,
    { action: act, ...extra, [field]: len(bad) }, cookie);
  check(`${act}: ${field} ${bad} char -> 400`,
    bad_.status === 400, `status=${bad_.status} ${bad_.text.slice(0, 90)}`);
  check(`${act}: ${field} ${bad} char -> pesan menyebut "${label}"`,
    (bad_.json?.msg || '').includes(label), `msg=${bad_.json?.msg}`);
  check(`${act}: ${field} ${bad} char -> nol baris tersentuh`,
    untouched(bad_.calls),
    bad_.calls.map(c => String(c.sql).replace(/\s+/g, ' ').slice(0, 60)).join(' | '));
}

// ==========================================================================
// [1] _schema.js — satu sumber kebenaran
// ==========================================================================

console.log('\n[1] _schema.js — konstanta lebar kolom');

const MEASURED = {
  'users.full_name': 100, 'users.email': 120, 'users.phone': 30,
  'services.code': 20, 'services.name': 80, 'services.category': 20, 'services.badge': 30,
  'customers.full_name': 120, 'customers.phone': 32, 'customers.address': 255,
  'orders.customer_name': 100, 'orders.customer_phone': 32, 'orders.customer_address': 255,
  'promos.code': 32, 'promos.name': 120
};

for (const [key, want] of Object.entries(MEASURED)) {
  check(`COL ${key} = ${want} (hasil ukur produksi)`,
    colWidth(key) === want, `tertulis=${colWidth(key)}`);
}

check('COL tidak boleh punya entri di luar hasil ukur',
  Object.keys(COL).every(k => k in MEASURED),
  Object.keys(COL).filter(k => !(k in MEASURED)).join(', '));

check('col() melempar untuk kunci yang tidak terdaftar',
  (() => { try { col('orders.tidak_ada', 'X'); return false; } catch { return true; } })(),
  'kunci asing seharusnya gagal saat modul dipakai, bukan diam-diam');

check('col() tidak pernah melebihi lebar kolom walau diminta lebih',
  col('services.name', 'Nama', { max: 999 }).max === 80,
  `max=${col('services.name', 'Nama', { max: 999 }).max}`);

// ==========================================================================
// [2] isDateTime — tipe baru untuk kolom DATETIME
// ==========================================================================

console.log('\n[2] isDateTime() — format, bukan panjang');

for (const [label, value, want] of [
  ['tanggal saja', '2026-12-31', true],
  ['tanggal + jam', '2026-12-31 23:00', true],
  ['lengkap dengan detik', '2026-12-31 23:59:59', true],
  ['pemisah T (ISO)', '2026-12-31T23:59:59', true],
  ['kata-kata ("besok-saja")', 'besok-saja', false],
  ['tanggal tidak ada (2026-02-31)', '2026-02-31', false],
  ['jam 25', '2026-12-31 25:00:00', false],
  ['menit 60', '2026-12-31 23:60:00', false],
  ['format US (31-12-2026)', '31-12-2026', false],
  ['string kosong', '', false],
  ['teks acak panjang', 'x'.repeat(200), false]
]) {
  check(`isDateTime("${String(value).slice(0, 24)}") = ${want} [${label}]`,
    isDateTime(value) === want, `hasil=${isDateTime(value)}`);
}

// ==========================================================================
// [3] services — name/code/category/badge
// ==========================================================================

console.log('\n[3] /api/services — batas mengikuti VARCHAR(80/20/20/30)');

await bound({ handler: services, path: '/api/services', act: 'create_service',
  field: 'name', label: 'Nama', ok: 80, bad: 81, extra: { price: 1000 } });
await bound({ handler: services, path: '/api/services', act: 'create_service',
  field: 'code', label: 'Kode', ok: 20, bad: 21, extra: { name: 'Layanan Uji', price: 1000 } });
await bound({ handler: services, path: '/api/services', act: 'create_service',
  field: 'category', label: 'Kategori', ok: 20, bad: 21, extra: { name: 'Layanan Uji', price: 1000 } });
await bound({ handler: services, path: '/api/services', act: 'create_service',
  field: 'badge', label: 'Badge', ok: 30, bad: 31, extra: { name: 'Layanan Uji', price: 1000 } });

await bound({ handler: services, path: '/api/services', act: 'update_service',
  field: 'name', label: 'Nama', ok: 80, bad: 81, extra: { id: 1, code: 'K1', price: 1000 } });
await bound({ handler: services, path: '/api/services', act: 'update_service',
  field: 'code', label: 'Kode', ok: 20, bad: 21, extra: { id: 1, name: 'Layanan Uji' } });

{
  // description adalah TEXT — sengaja TIDAK dipotong mengikuti lebar kolom.
  const r = await call(services, 'POST', '/api/services',
    { action: 'create_service', name: 'Layanan Uji', price: 1000, description: len(900) }, staffToken);
  check('create_service: description 900 char tetap diterima (kolom TEXT)',
    r.status === 200, `status=${r.status} ${r.text.slice(0, 90)}`);
}

// ==========================================================================
// [4] promos — code, name, dan expires_at (format!)
// ==========================================================================

console.log('\n[4] /api/promos — batas + format DATETIME');

await bound({ handler: promos, path: '/api/promos', act: 'create_promo',
  field: 'code', label: 'Kode', ok: 32, bad: 33, extra: { name: 'Promo Uji' } });
await bound({ handler: promos, path: '/api/promos', act: 'create_promo',
  field: 'name', label: 'Nama', ok: 120, bad: 121 });
await bound({ handler: promos, path: '/api/promos', act: 'update_promo',
  field: 'code', label: 'Kode', ok: 32, bad: 33, extra: { id: 1, name: 'Promo Uji' } });

for (const [label, value, want] of [
  ['"besok-saja" (dulu 500)', 'besok-saja', 400],
  ['"31 Desember 2026"', '31 Desember 2026', 400],
  ['tanggal tidak ada 2026-02-31', '2026-02-31', 400],
  ['jam 25:00', '2026-12-31 25:00:00', 400],
  ['tanggal saja (VALID)', '2026-12-31', 200],
  ['tanggal + jam (VALID)', '2026-12-31 23:59:59', 200]
]) {
  const r = await call(promos, 'POST', '/api/promos',
    { action: 'create_promo', name: 'Promo Uji', expires_at: value }, staffToken);
  check(`create_promo: expires_at ${label} -> ${want}`,
    r.status === want, `status=${r.status} ${r.text.slice(0, 110)}`);
  if (want === 400) {
    check(`create_promo: expires_at ${label} -> pesan menyebut format`,
      (r.json?.msg || '').includes('Tanggal kedaluwarsa'), `msg=${r.json?.msg}`);
    check(`create_promo: expires_at ${label} -> nol baris tersentuh`,
      untouched(r.calls), r.calls.map(c => String(c.sql).slice(0, 50)).join(' | '));
  } else {
    const ins = r.calls.find(c => /INSERT INTO promos/i.test(c.sql));
    check(`create_promo: expires_at ${label} -> nilai masuk ke INSERT`,
      Array.isArray(ins?.params) && ins.params.includes(value),
      JSON.stringify(ins?.params?.slice(-3)));
  }
}

// ==========================================================================
// [5] customers — address 255 (dulu 500 -> 500), phone 32 (dulu 30 -> 400)
// ==========================================================================

console.log('\n[5] /api/customers — address dipersempit, phone DILONGGARKAN');

await bound({ handler: customers, path: '/api/customers', act: 'create_customer',
  field: 'address', label: 'Alamat', ok: 255, bad: 256, extra: { full_name: 'Pelanggan Uji' } });
await bound({ handler: customers, path: '/api/customers', act: 'update_customer',
  field: 'address', label: 'Alamat', ok: 255, bad: 256, extra: { id: 1, full_name: 'Pelanggan Uji' } });

for (const [label, n, want] of [['30 (batas lama)', 30, 200], ['32 (lebar kolom)', 32, 200], ['33', 33, 400]]) {
  const r = await call(customers, 'POST', '/api/customers',
    { action: 'create_customer', full_name: 'Pelanggan Uji', phone: len(n) }, staffToken);
  check(`create_customer: phone ${n} char -> ${want} [${label}]`,
    r.status === want, `status=${r.status} ${r.text.slice(0, 110)}`);
}

await bound({ handler: customers, path: '/api/customers', act: 'create_customer',
  field: 'full_name', label: 'Nama', ok: 120, bad: 121 });

// ==========================================================================
// [6] orders — customer_name 100, address 255, phone 32
// ==========================================================================

console.log('\n[6] /api/orders — tiga kolom diselaraskan');

await bound({ handler: orders, path: '/api/orders', act: 'create_order',
  field: 'customer_name', label: 'Nama pelanggan', ok: 100, bad: 101,
  extra: { service_id: 1, weight_kg: 1 } });
await bound({ handler: orders, path: '/api/orders', act: 'create_order',
  field: 'customer_address', label: 'Alamat pelanggan', ok: 255, bad: 256,
  extra: { service_id: 1, weight_kg: 1 } });
await bound({ handler: orders, path: '/api/orders', act: 'update_order',
  field: 'customer_name', label: 'Nama pelanggan', ok: 100, bad: 101,
  extra: { id: 1, service_id: 1, weight_kg: 1 } });

for (const [label, n, want] of [['30 (batas lama)', 30, 200], ['32 (lebar kolom)', 32, 200], ['33', 33, 400]]) {
  const r = await call(orders, 'POST', '/api/orders',
    { action: 'create_order', service_id: 1, weight_kg: 1, customer_phone: len(n) }, staffToken);
  check(`create_order: customer_phone ${n} char -> ${want} [${label}]`,
    r.status === want, `status=${r.status} ${r.text.slice(0, 110)}`);
}

// ==========================================================================
// [7] profile & register — users.full_name 100 (dulu 120 -> 500)
// ==========================================================================

console.log('\n[7] /api/profile & /api/auth/register — users.full_name 100');

for (const [label, n, want] of [['100 (lebar kolom)', 100, 200], ['101 (dulu 500)', 101, 400], ['120 (batas lama)', 120, 400]]) {
  const r = await call(profile, 'POST', '/api/profile',
    { action: 'update_profile', full_name: len(n) }, staffToken);
  check(`update_profile: full_name ${n} char -> ${want} [${label}]`,
    r.status === want, `status=${r.status} ${r.text.slice(0, 110)}`);
  if (want === 400) {
    check(`update_profile: full_name ${n} char -> pesan menyebut "Nama"`,
      (r.json?.msg || '').includes('Nama'), `msg=${r.json?.msg}`);
    check(`update_profile: full_name ${n} char -> nol baris tersentuh`,
      untouched(r.calls), r.calls.map(c => String(c.sql).slice(0, 50)).join(' | '));
  }
}

/**
 * Baris tiruan untuk register: SELECT PERTAMA dari `users` (cek "email sudah
 * terdaftar?") dikosongkan, SELECT BERIKUTNYA (ambil pengguna baru) diberi
 * satu baris.
 *
 * Kenapa harus begini: kalau semua SELECT dikosongkan, handler berujung 404
 * "Registrasi gagal dibuat" dan yang terukur adalah kekosongan mock, BUKAN
 * batas panjang `full_name` — hijau/merah palsu (pelajaran tick 18 & 23).
 */
function registerRows() {
  let seen = 0;
  return sql => {
    if (/FROM users/i.test(sql) && /^\s*SELECT/i.test(sql)) {
      seen += 1;
      return seen === 1 ? [] : [{ id: 77, full_name: 'Uji', email: 'uji16@example.com', role: 'Customer' }];
    }
    return [];
  };
}

{
  // SANITY: dengan SELECT pertama DIISI, handler harus menjawab 409.
  // Kalau ini MERAH, berarti baris tiruan tidak terbaca dan uji di bawah
  // tidak membuktikan apa pun.
  const dup = await call(register, 'POST', '/api/auth/register', {
    full_name: 'Uji', email: 'uji16@example.com', password: 'sandi123', confirm: 'sandi123'
  }, null, sql => (/FROM users/i.test(sql) ? [{ id: 1 }] : []));
  check('register: email sudah terdaftar -> 409 (baris tiruan terbaca)',
    dup.status === 409, `status=${dup.status} ${dup.text.slice(0, 90)}`);
}

for (const [label, n, want] of [['100 (lebar kolom)', 100, 200], ['101 (dulu 500)', 101, 400]]) {
  const r = await call(register, 'POST', '/api/auth/register', {
    full_name: len(n), email: `uji16-${n}@example.com`, password: 'sandi123', confirm: 'sandi123'
  }, null, registerRows());
  check(`register: full_name ${n} char -> ${want} [${label}]`,
    r.status === want, `status=${r.status} ${r.text.slice(0, 110)}`);
  if (want === 200) {
    check(`register: full_name ${n} char -> SELECT pengguna baru dijalankan`,
      r.calls.filter(c => /FROM users/i.test(c.sql) && /^\s*SELECT/i.test(c.sql)).length >= 2,
      r.calls.map(c => String(c.sql).slice(0, 40)).join(' | '));
  } else {
    check(`register: full_name ${n} char -> pesan menyebut "Nama lengkap"`,
      (r.json?.msg || '').includes('Nama lengkap'), `msg=${r.json?.msg}`);
    check(`register: full_name ${n} char -> nol baris tersentuh`,
      untouched(r.calls), r.calls.map(c => String(c.sql).slice(0, 50)).join(' | '));
  }
}

// ==========================================================================
// [7b] field WAJIB tidak boleh hilang hanya karena batasnya kini dari _schema
// ==========================================================================
//
// Mutasi 12 pada tick ini membuktikan kelemahan ini: mengubah
// `COL_SPEC.userName` menjadi tanpa `required: true` membuat harness tetap
// HIJAU 147/147, padahal nama kosong lalu diterima. Regresi itu akhirnya
// ketahuan oleh verify_b2/verify_b13, BUKAN oleh B16 — jadi B16 harus punya
// uji ini sendiri.

console.log('\n[7b] field wajib tetap wajib setelah batas dipusatkan');

for (const [label, tc] of [
  ['services.create_service nama kosong', [services, '/api/services', 'create_service', { price: 1000 }]],
  ['promos.create_promo nama kosong', [promos, '/api/promos', 'create_promo', {}]],
  ['customers.create_customer nama kosong', [customers, '/api/customers', 'create_customer', {}]],
  ['profile.update_profile nama kosong', [profile, '/api/profile', 'update_profile', {}]]
]) {
  const [handler, path, act, body] = tc;
  const r = await call(handler, 'POST', path, { action: act, ...body }, staffToken);
  check(`${label} -> 400`, r.status === 400, `status=${r.status} ${r.text.slice(0, 90)}`);
  check(`${label} -> nol baris tersentuh`, untouched(r.calls),
    r.calls.map(c => String(c.sql).slice(0, 50)).join(' | '));
}

{
  // register: nama kosong -> 400 (bukan 200/500).
  const r = await call(register, 'POST', '/api/auth/register',
    { full_name: '', email: 'uji16-kosong@example.com', password: 'sandi123', confirm: 'sandi123' },
    null, registerRows());
  check('register: nama kosong -> 400', r.status === 400, `status=${r.status} ${r.text.slice(0, 90)}`);
}

// ==========================================================================
// [8] jalur SUKSES tidak mati — kontrol nilai wajar
// ==========================================================================

console.log('\n[8] jalur sukses (kontrol) harus tetap hidup');

{
  const r = await call(services, 'POST', '/api/services',
    { action: 'create_service', name: 'Cuci Kering', code: 'CK1', price: 12000, category: 'Express', badge: 'Populer' },
    staffToken);
  check('create_service wajar -> 200', r.status === 200, `status=${r.status} ${r.text.slice(0, 90)}`);
  const ins = r.calls.find(c => /INSERT INTO services/i.test(c.sql));
  check('create_service wajar -> INSERT dengan nilai apa adanya',
    Array.isArray(ins?.params) && ins.params.includes('Cuci Kering') && ins.params.includes('CK1'),
    JSON.stringify(ins?.params?.slice(0, 4)));
}

{
  const r = await call(promos, 'POST', '/api/promos',
    { action: 'create_promo', name: 'Promo Akhir Tahun', code: 'AKHIR26', type: 'percent', value: 10, expires_at: '2026-12-31 23:59:59' },
    staffToken);
  check('create_promo wajar -> 200', r.status === 200, `status=${r.status} ${r.text.slice(0, 90)}`);
  const ins = r.calls.find(c => /INSERT INTO promos/i.test(c.sql));
  check('create_promo wajar -> expires_at tersimpan utuh',
    Array.isArray(ins?.params) && ins.params.includes('2026-12-31 23:59:59'),
    JSON.stringify(ins?.params));
}

{
  const r = await call(customers, 'POST', '/api/customers',
    { action: 'create_customer', full_name: 'Budi Santoso', phone: '081234567890', address: 'Jl. Melati 1' },
    staffToken);
  check('create_customer wajar -> 200', r.status === 200, `status=${r.status} ${r.text.slice(0, 90)}`);
}

{
  const r = await call(orders, 'POST', '/api/orders',
    { action: 'create_order', service_id: 1, weight_kg: 3, customer_name: 'Budi Santoso' },
    staffToken);
  check('create_order wajar -> 200', r.status === 200, `status=${r.status} ${r.text.slice(0, 90)}`);
}

{
  // Tanpa sesi -> 401, bukan 400 validasi dan bukan 500.
  const r = await call(services, 'POST', '/api/services',
    { action: 'create_service', name: len(200) }, null);
  check('create_service tanpa sesi -> 401 (izin diperiksa sebelum validasi)',
    r.status === 401, `status=${r.status} ${r.text.slice(0, 90)}`);
}

// --- ringkasan -------------------------------------------------------------

console.log('');
console.log(`HASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
