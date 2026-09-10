// Harness verifikasi C2 — pelacakan pesanan publik berdasarkan kode.
//
// Klaim yang diuji (bukan sekadar "endpoint menjawab 200"):
//   1. TANPA login pun endpoint menjawab — itu tujuan fitur.
//   2. Telepon dan alamat TIDAK pernah keluar, sekalipun baris tiruan
//      mengembalikan SELURUH kolom (uji ini mudah HIJAU PALSU bila baris
//      tiruan tidak punya kolom itu — lihat pelajaran tick 17).
//   3. Nama disamarkan, bukan dikirim utuh.
//   4. Pesan error generik (B14) — tidak ada connection string.
//   5. Rate limit aktif setelah ambang (B1).
//   6. Kode pesanan ter-parameterisasi, tidak pernah disambung ke SQL (B7).
//   7. Validasi: kode kosong/terlalu panjang/tipe objek → 400, bukan 500.
//
// Jalankan:  node tools/verify_c2_run.mjs

import { onRequest as track, maskName } from '../functions/api/track.js';
import { resetAll } from '../functions/_ratelimit.js';
import { __calls } from './mock_tidb.mjs';

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

const SECRET = 'RAHASIA';
const SECRET_MSG = `${SECRET}: connection string mysql://user:***@gateway.tidbcloud.com/db?line=42`;

// Baris pesanan LENGKAP, persis seperti `SELECT o.*` dari produksi —
// termasuk telepon, alamat, dan id internal yang TIDAK boleh bocor.
const FULL_ORDER = {
  id: 4242,
  order_code: 'ORD-ABC123',
  customer_name: 'Budi Santoso',
  customer_phone: '081234567890',
  customer_address: 'Jl. Melati No. 12, Jakarta Selatan',
  service_id: 3,
  service_name: 'Cuci Kering Reguler',
  status: 'proses',
  weight_kg: 5,
  price_per_kg: 7000,
  discount: 0,
  total_amount: 35000,
  paid_amount: 0,
  payment_status: 'unpaid',
  created_at: '2026-09-01 10:00:00',
  finished_at: null
};

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

function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' };
  return new Request(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

/**
 * Panggil handler dengan driver tiruan.
 * `rowsFor` = null → semua query melempar (kegagalan DB total).
 */
async function call(method, path, rowsFor) {
  __calls.length = 0;
  globalThis.__MOCK_ROWS = rowsFor === null
    ? () => { throw new Error(SECRET_MSG); }
    : rowsFor;
  let status = 0;
  let json = null;
  let text = '';
  let headers = null;
  try {
    const res = await track({ request: req(method, path), env: ENV, ctx: {} });
    status = res.status;
    headers = res.headers;
    text = await res.text();
    try { json = JSON.parse(text); } catch { /* bukan JSON */ }
  } catch (e) {
    return { status: 0, json: null, text: '', headers: null, err: e.message, calls: __calls.slice() };
  }
  return { status, json, text, headers, calls: __calls.slice() };
}

/** Baris penuh untuk kode yang sah, kosong untuk selainnya. */
const rowsOk = (sql, params) =>
  (Array.isArray(params) && params[0] === 'ORD-ABC123') ? [FULL_ORDER] : [];

// ---------------------------------------------------------------------------
// 1. Jalur sukses — tanpa sesi, tanpa cookie
// ---------------------------------------------------------------------------
resetAll();
{
  const r = await call('GET', '/api/track?code=ORD-ABC123', rowsOk);
  check('200 tanpa login (fitur publik)', r.status === 200, `status=${r.status} ${r.text}`);
  check('ok:true', r.json?.ok === true, r.text);
  check('order_code dikembalikan', r.json?.order?.order_code === 'ORD-ABC123', r.text);
  check('status pesanan dikembalikan', r.json?.order?.status === 'proses', r.text);
  check('nama layanan ikut (JOIN services)', r.json?.order?.service_name === 'Cuci Kering Reguler', r.text);
  check('total_amount dikembalikan', r.json?.order?.total_amount === 35000, r.text);
}

// ---------------------------------------------------------------------------
// 2. KEBOCORAN PII — inti keamanan fitur ini
// ---------------------------------------------------------------------------
{
  const r = await call('GET', '/api/track?code=ORD-ABC123', rowsOk);
  const blob = r.text ?? '';
  check('telepon TIDAK bocor', !blob.includes('081234567890'), blob);
  check('alamat TIDAK bocor', !blob.includes('Jl. Melati'), blob);
  check('id internal TIDAK bocor', !blob.includes('4242'), blob);
  check('service_id TIDAK bocor', !blob.includes('"service_id"'), blob);
  check('customer_name utuh TIDAK bocor', !blob.includes('Budi Santoso'), blob);
  check('field customer_phone absen (bukan null)',
    !('customer_phone' in (r.json?.order ?? {})), r.text);
  check('field customer_address absen (bukan null)',
    !('customer_address' in (r.json?.order ?? {})), r.text);
}

// ---------------------------------------------------------------------------
// 3. Nama disamarkan
// ---------------------------------------------------------------------------
{
  const r = await call('GET', '/api/track?code=ORD-ABC123', rowsOk);
  check('nama disamarkan "Budi S."', r.json?.order?.customer_name_masked === 'Budi S.', r.text);
  // Uji murni fungsi penyamar (tanpa DB) — nama tunggal & spasi ganda.
  check('maskName: satu kata', maskName('Budi') === 'Budi', maskName('Budi'));
  check('maskName: spasi ganda', maskName('Budi  Santoso') === 'Budi S.', maskName('Budi  Santoso'));
  check('maskName: tiga kata', maskName('Budi Santoso Wijaya') === 'Budi W.', maskName('Budi Santoso Wijaya'));
  check('maskName: string kosong', maskName('') === '', JSON.stringify(maskName('')));
  check('maskName: null aman', maskName(null) === '', JSON.stringify(maskName(null)));
}

// ---------------------------------------------------------------------------
// 4. Pesan error generik (B14)
// ---------------------------------------------------------------------------
{
  const r = await call('GET', '/api/track?code=ORD-ABC123', null); // DB melempar
  check('DB error → 500 generik (bukan 200)', r.status === 500, `status=${r.status}`);
  check('tidak ada penanda RAHASIA', !(r.text ?? '').includes(SECRET), r.text);
  check('tidak ada connection string', !(r.text ?? '').includes('mysql://'), r.text);
  check('tidak ada host tidb', !(r.text ?? '').includes('tidbcloud'), r.text);
  check('ok:false saat error', r.json?.ok === false, r.text);
}

// ---------------------------------------------------------------------------
// 5. Validasi input (B2) — 400, bukan 500
// ---------------------------------------------------------------------------
{
  const r1 = await call('GET', '/api/track?code=', rowsOk);
  check('kode kosong → 400', r1.status === 400, `status=${r1.status} ${r1.text}`);
  check('kode kosong: ok:false', r1.json?.ok === false, r1.text);

  // VARCHAR(20) di skema → kode 60 karakter wajib ditolak.
  const r2 = await call('GET', `/api/track?code=${'X'.repeat(60)}`, rowsOk);
  check('kode 60 char → 400', r2.status === 400, `status=${r2.status} ${r2.text}`);

  // Kode pendek (< min 3) juga ditolak.
  const r3 = await call('GET', '/api/track?code=A', rowsOk);
  check('kode 1 char → 400', r3.status === 400, `status=${r3.status} ${r3.text}`);

  // Tanpa parameter sama sekali.
  const r4 = await call('GET', '/api/track', rowsOk);
  check('tanpa parameter → 400', r4.status === 400, `status=${r4.status} ${r4.text}`);

  // Kode tidak ditemukan → 404 tanpa konfirmasi tambahan.
  const r5 = await call('GET', '/api/track?code=ORD-NOPE99', rowsOk);
  check('kode salah → 404', r5.status === 404, `status=${r5.status} ${r5.text}`);
  check('404 tidak membocorkan data', !(r5.text ?? '').includes('Budi'), r5.text);
}

// ---------------------------------------------------------------------------
// 6. SQL ter-parameterisasi (B7) — kode tidak pernah disambung ke teks SQL
// ---------------------------------------------------------------------------
{
  const evil = "ORD-1' OR 1=1 --";
  const r = await call('GET', `/api/track?code=${encodeURIComponent(evil)}`, rowsOk);
  const sqlSent = r.calls.map(c => String(c.sql)).join('\n');
  check('kode jahat tidak masuk teks SQL', !sqlSent.includes("OR 1=1"), sqlSent);
  check('kode jahat tidak 500 (ditolak validasi/404)',
    r.status === 400 || r.status === 404, `status=${r.status} ${r.text}`);
  check('kode tetap dikirim sebagai parameter',
    r.calls.every(c => !Array.isArray(c.params) || c.params.length > 0),
    JSON.stringify(r.calls.map(c => c.params)));
  check('SELECT memakai placeholder ?',
    r.calls.length === 0 || /=\s*\?/.test(sqlSent), sqlSent);
}

// Uji bahwa SQL TIDAK memakai `o.*` (proyeksi terkendali).
{
  const r = await call('GET', '/api/track?code=ORD-ABC123', rowsOk);
  const sqlSent = r.calls.map(c => String(c.sql)).join('\n');
  check('SQL tidak SELECT o.* (proyeksi izin)', !/SELECT\s+o\.\*/i.test(sqlSent), sqlSent);
  check('SQL tidak SELECT *', !/SELECT\s+\*/i.test(sqlSent), sqlSent);
}

// ---------------------------------------------------------------------------
// 7. Rate limit (B1) — ambang 20 per 5 menit
// ---------------------------------------------------------------------------
{
  resetAll();
  let last = null;
  let sawLimit = false;
  for (let i = 0; i < 24; i++) {
    last = await call('GET', '/api/track?code=ORD-ABC123', rowsOk);
    if (last.status === 429) { sawLimit = true; break; }
  }
  check('rate limit aktif (429 sebelum 24 percobaan)', sawLimit, `status terakhir=${last?.status}`);
  check('429 punya ok:false', last?.json?.ok === false, last?.text);
  check('429 tidak membocorkan data pesanan',
    !(last?.text ?? '').includes('Budi') && !(last?.text ?? '').includes('0812'), last?.text);
  const retry = last?.headers?.get('Retry-After');
  check('429 menyertakan Retry-After', retry != null && Number(retry) > 0, `Retry-After=${retry}`);
  check('429 menyertakan X-RateLimit-Limit', last?.headers?.get('X-RateLimit-Limit') === '20',
    `Limit=${last?.headers?.get('X-RateLimit-Limit')}`);
}

// ---------------------------------------------------------------------------
// 8. Preflight OPTIONS tidak menghabiskan jatah (harus 204, bukan 429)
// ---------------------------------------------------------------------------
{
  resetAll();
  const r = await call('OPTIONS', '/api/track', rowsOk);
  check('OPTIONS → 204', r.status === 204, `status=${r.status} ${r.text}`);
  check('OPTIONS tidak kena rate limit', r.status !== 429, `status=${r.status}`);
  check('OPTIONS mengumumkan method GET',
    (r.headers?.get('Access-Control-Allow-Methods') ?? '').includes('GET'),
    r.headers?.get('Access-Control-Allow-Methods'));
}

// ---------------------------------------------------------------------------
// 9. Metode selain GET/OPTIONS → 405
// ---------------------------------------------------------------------------
{
  const r = await call('POST', '/api/track', rowsOk);
  check('POST → 405', r.status === 405, `status=${r.status} ${r.text}`);
  check('405 punya ok:false', r.json?.ok === false, r.text);
}

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
