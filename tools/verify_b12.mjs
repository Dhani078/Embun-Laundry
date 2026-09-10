// Harness verifikasi B12 — `daily_checkins` (fungsi check-in harian) dan
// `user_vouchers` (POST /api/vouchers).
//
// Task ini lahir dari satu pertanyaan yang dicatat sendiri oleh tick 15:
// "endpoint mana yang belum punya harness?" Jawabannya saat itu:
// `checkin.js` dan `vouchers.js`. Keduanya belum pernah diukur, jadi tidak
// ada satu pun angka yang bisa dipercaya tentang keduanya.
//
// Kenapa `checkin.js` layak dicurigai SEBELUM diukur:
//   `new Date().toISOString().split('T')[0]` menghasilkan tanggal **UTC**.
//   Cloudflare Workers berjalan di UTC; operasional laundry berada di
//   Asia/Jakarta (UTC+7). Jadi antara pukul 00:00 dan 07:00 WIB, "hari ini"
//   menurut kode adalah **kemarin**. Konsekuensinya nyata dan dua arah:
//     - Pelanggan yang check-in jam 6 pagi akan tercatat di baris kemarin,
//       sehingga hari ini ia bisa check-in LAGI (baris baru untuk hari
//       kemarin sudah ada? tidak — baris kemarin belum ada, jadi jalur
//       "sudah check-in" tidak pernah aktif untuk hari kemarin) → satu hari
//       bisa menghasilkan DUA check-in.
//     - Sebaliknya, check-in jam 6 sore WIB (11:00 UTC) tercatat di tanggal
//       yang benar, jadi tidak ada masalah di siang hari. Itu sebabnya
//       defek ini tidak pernah terlihat oleh penguji manual.
//
// Cara ukur: panggil handler SUNGGUHAN dengan driver tiruan
// (tools/mock_tidb.mjs) yang mencatat setiap SQL berikut params-nya, lalu
// periksa status, isi JSON, dan SQL yang benar-benar terkirim — persis pola
// B10/B11. Kode lama di-checkout dari git bila perlu untuk membuktikan
// bahwa harness ini MERAH sebelum diperbaiki.
//
// Jalankan:  node tools/verify_b12_run.mjs

import { onRequest as checkin } from '../functions/api/checkin.js';
import { onRequest as vouchers } from '../functions/api/vouchers.js';
import { createSessionToken } from '../functions/_db.js';
import { __calls } from './mock_tidb.mjs';

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';
const TZ = 'Asia/Jakarta';

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

/** Tanggal hari ini di zona Asia/Jakarta — kebenaran yang diharapkan. */
function todayWIB(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
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
 * Panggil handler dengan DB tiruan.
 * @param {Function} fn          handler sungguhan
 * @param {string}   method
 * @param {string}   path
 * @param {object}   [body]
 * @param {string}   [cookie]
 * @param {Function} [rowsFor]   (sql, params) => baris; kalau tidak diisi,
 *                               fungsi bawaan mengembalikan baris menurut
 *                               jenis query (lihat di bawah).
 */
async function call(fn, method, path, body, cookie, rowsFor) {
  __calls.length = 0;
  globalThis.__MOCK_ROWS = rowsFor || defaultRows;
  let status = 0;
  let json = null;
  try {
    const res = await fn({ request: req(method, path, body, cookie), env: ENV, ctx: {} });
    status = res.status;
    try { json = await res.json(); } catch { /* bukan JSON */ }
  } catch (e) {
    return { status: 0, json: null, err: e.message, calls: __calls.slice() };
  }
  return { status, json, calls: __calls.slice() };
}

/**
 * Baris bawaan: cukup pintar untuk membedakan tiga query check-in
 * (cek hari ini / hitung total / sisipkan) dan satu query promo.
 */
function defaultRows(sql) {
  const s = String(sql);
  if (/^\s*SELECT\s+id\s+FROM\s+daily_checkins/i.test(s)) return [];   // belum ada
  if (/COUNT\(\*\)/i.test(s)) return [{ c: 1 }];
  if (/^\s*SELECT\s+\*\s+FROM\s+daily_checkins/i.test(s)) return [];
  if (/FROM\s+promos/i.test(s)) {
    return [{
      id: 7, code: 'HEMAT10', name: 'Hemat 10%', type: 'percent',
      value: 10, min_spend: 0, max_discount: 5000, expires_at: null, is_active: 1
    }];
  }
  if (/FROM\s+user_vouchers/i.test(s)) return [];
  return [];
}

// --- token untuk tiap peran ------------------------------------------------

const custToken = await createSessionToken(
  { id: 9, full_name: 'Budi Santoso', role: 'Customer', email: 'budi@gmail.com' }, ENV);
const staffToken = await createSessionToken(
  { id: 1, full_name: 'Admin Uji', role: 'Admin', email: 'admin@gmail.com' }, ENV);

// ==========================================================================
// 1. TANPA SESI: 401 dan nol query (polisi yang sama dengan B10)
// ==========================================================================

console.log('\n[1] check-in tanpa sesi');

for (const [label, method, path] of [
  ['GET /api/checkin', 'GET', '/api/checkin'],
  ['POST /api/checkin', 'POST', '/api/checkin']
]) {
  const r = await call(checkin, method, path, method === 'POST' ? {} : undefined, null);
  check(`${label} tanpa sesi -> 401`, r.status === 401, `status=${r.status}`);
  check(`${label} tanpa sesi -> ok:false`, r.json && r.json.ok === false, JSON.stringify(r.json));
  const touched = (r.calls || []).filter(c => /daily_checkins/.test(c.sql));
  check(`${label} tanpa sesi -> nol query ke daily_checkins`,
    touched.length === 0, `terkirim=${touched.length}`);
}

// ==========================================================================
// 2. SESI SAH: hari yang dipakai HARUS hari Asia/Jakarta, bukan UTC
// ==========================================================================
//
// Ini inti task. Diukur pada jam-jam di mana tanggal UTC dan tanggal WIB
// berbeda (00:00–06:59 WIB = 17:00–23:59 UTC hari sebelumnya), karena pada
// jam itulah `toISOString()` menghasilkan tanggal yang SALAH untuk
// operasional Indonesia.

console.log('\n[2] hari check-in = hari Asia/Jakarta (bukan UTC)');

const SAMPLES = [
  ['06:00 WIB (23:00 UTC hari sebelumnya)', '2026-09-10T23:00:00Z', '2026-09-11'],
  ['00:30 WIB (17:30 UTC hari sebelumnya)', '2026-09-09T17:30:00Z', '2026-09-10'],
  ['06:59 WIB (23:59 UTC hari sebelumnya)', '2026-09-10T23:59:00Z', '2026-09-11'],
  ['13:00 WIB (06:00 UTC, tanggal sama)', '2026-09-10T06:00:00Z', '2026-09-10']
];

const RealDate = Date;
for (const [label, iso, expectedDay] of SAMPLES) {
  // Kunci waktu: handler membaca `new Date()` di dalam tubuhnya, jadi
  // Date mesti diganti sementara. Ini bukan trik — ini satu-satunya cara
  // mengukur keputusan berbasis jam tanpa menunggu jam 6 pagi sungguhan.
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) return new RealDate(iso);
      return new RealDate(...args);
    }
    static now() { return RealDate.parse(iso); }
  };

  let r;
  try {
    r = await call(checkin, 'GET', '/api/checkin', undefined, custToken);
  } finally {
    globalThis.Date = RealDate;
  }

  const days = (r.calls || [])
    .flatMap(c => (c.params || []).filter(p => typeof p === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p)));
  const uniq = [...new Set(days)];
  check(`${label} -> 200`, r.status === 200, `status=${r.status}`);
  check(`${label} -> hari = ${expectedDay}`,
    uniq.length === 1 && uniq[0] === expectedDay,
    `hari terkirim=${JSON.stringify(uniq)} (harus ${expectedDay})`);
}

// Jalur POST: baris yang disisipkan juga harus memakai hari WIB.
{
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) return new RealDate('2026-09-10T23:00:00Z');
      return new RealDate(...args);
    }
    static now() { return RealDate.parse('2026-09-10T23:00:00Z'); }
  };
  let r;
  try {
    r = await call(checkin, 'POST', '/api/checkin', {}, custToken);
  } finally {
    globalThis.Date = RealDate;
  }
  const ins = (r.calls || []).find(c => /INSERT INTO daily_checkins/i.test(c.sql));
  check('POST 06:00 WIB -> INSERT dikirim', !!ins, JSON.stringify((r.calls || []).map(c => c.sql.slice(0, 40))));
  check('POST 06:00 WIB -> hari tersisip = 2026-09-11',
    !!ins && (ins.params || []).includes('2026-09-11'),
    ins ? JSON.stringify(ins.params) : '-');
  check('POST -> ok:true', r.json && r.json.ok === true, JSON.stringify(r.json));
}

// ==========================================================================
// 3. CHECK-IN GANDA: hari yang sama tidak boleh menghasilkan dua baris
// ==========================================================================

console.log('\n[3] check-in ganda pada hari yang sama');

{
  const r = await call(checkin, 'POST', '/api/checkin', {}, custToken, (sql) => {
    if (/^\s*SELECT\s+id\s+FROM\s+daily_checkins/i.test(sql)) return [{ id: 1 }]; // sudah ada
    return defaultRows(sql);
  });
  check('POST saat sudah check-in -> 400', r.status === 400, `status=${r.status}`);
  check('POST saat sudah check-in -> ok:false', r.json && r.json.ok === false, JSON.stringify(r.json));
  const ins = (r.calls || []).filter(c => /INSERT INTO daily_checkins/i.test(c.sql));
  check('POST saat sudah check-in -> TIDAK ada INSERT', ins.length === 0, `INSERT=${ins.length}`);
}

// ==========================================================================
// 4. /api/vouchers POST: hak akses & validasi (endpoint kedua tanpa harness)
// ==========================================================================

console.log('\n[4] POST /api/vouchers — hak akses & validasi');

{
  const r = await call(vouchers, 'POST', '/api/vouchers', { action: 'claim', promo_id: 7 }, null);
  check('vouchers POST tanpa sesi -> 401', r.status === 401, `status=${r.status}`);
  const touched = (r.calls || []).filter(c => /user_vouchers|promos/.test(c.sql));
  check('vouchers POST tanpa sesi -> nol query', touched.length === 0, `terkirim=${touched.length}`);
}

for (const [label, body] of [
  ['promo_id bukan angka', { action: 'claim', promo_id: 'abc' }],
  ['promo_id nol', { action: 'claim', promo_id: 0 }],
  ['promo_id negatif', { action: 'claim', promo_id: -1 }],
  ['promo_id hilang', { action: 'claim' }],
  ['aksi tak dikenal', { action: 'hapus_semua' }]
]) {
  const r = await call(vouchers, 'POST', '/api/vouchers', body, staffToken);
  check(`vouchers POST ${label} -> 400`, r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);
}

{
  const r = await call(vouchers, 'POST', '/api/vouchers', { action: 'claim', promo_id: 7 }, custToken);
  check('vouchers POST claim sebagai Customer -> 401', r.status === 401, `status=${r.status}`);
}

{
  const r = await call(vouchers, 'POST', '/api/vouchers', { action: 'bulk_claim', promo_id: 7, user_ids: [] }, staffToken);
  check('vouchers POST bulk_claim tanpa id -> 400', r.status === 400, `status=${r.status}`);
}

{
  const ids = Array.from({ length: 501 }, (_, i) => i + 1);
  const r = await call(vouchers, 'POST', '/api/vouchers', { action: 'bulk_claim', promo_id: 7, user_ids: ids }, staffToken);
  check('vouchers POST bulk_claim 501 id -> 400', r.status === 400, `status=${r.status}`);
}

{
  const r = await call(vouchers, 'POST', '/api/vouchers', { action: 'bulk_claim', promo_id: 7, user_ids: [1, 'x'] }, staffToken);
  check('vouchers POST bulk_claim id bukan angka -> 400', r.status === 400, `status=${r.status}`);
}

// Jalur SUKSES staf: klaim harus menyisipkan baris dan mengembalikan voucher.
{
  const r = await call(vouchers, 'POST', '/api/vouchers', { action: 'claim', promo_id: 7 }, staffToken);
  check('vouchers POST claim sebagai Admin -> 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json)}`);
  const ins = (r.calls || []).filter(c => /INSERT INTO user_vouchers/i.test(c.sql));
  check('vouchers POST claim sebagai Admin -> 1 INSERT', ins.length === 1, `INSERT=${ins.length}`);
}

// --- ringkasan -------------------------------------------------------------

console.log('');
console.log(`HASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
