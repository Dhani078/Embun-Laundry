// Harness verifikasi B15 — validasi input `POST /api/delivery` +
// jadwal bawaan di zona Asia/Jakarta.
//
// Latar belakang: `delivery.js` adalah satu-satunya modul yang TIDAK ikut
// dipasangi `validateOr400()` pada B2 (tick 11). Tujuh handler lain
// (customers, services, orders, promos, vouchers, register, login) sudah
// divalidasi; delivery tertinggal. Ini dicatat sendiri di AGENT_STATE.md:
//   "Peringatan untuk tick berikutnya: pola `toISOString().split('T')[0]`
//    masih ada di `functions/api/delivery.js` untuk `schedule_date`."
// Jadi dua hal yang diukur di sini: input yang tidak divalidasi, dan
// tanggal yang salah zona.
//
// Kenapa layak dicurigai SEBELUM diukur (bukan sekadar "tambah validasi"):
//   `pickup_delivery` memuat ALAMAT dan TELEPON pelanggan (kolom TEXT dan
//   VARCHAR(30)). Nilai yang tidak divalidasi tidak hanya merusak baris itu
//   sendiri — ia juga menghasilkan **500 dari TiDB** (kolom kepanjangan),
//   bukan 400 dari kita. Klien tidak pernah tahu apa yang salah.
//
// Kontrak yang diuji, semuanya diukur dari SQL/params yang BENAR-BENAR
// terkirim ke driver tiruan (bukan dari teks sumber):
//   1. Setiap input ngawur -> 400, dan SATU pun baris tidak tersentuh.
//   2. Jalur SUKSES tidak mati: tugas tetap tersimpan dengan nilai wajar.
//   3. Jadwal bawaan = hari Asia/Jakarta, bukan UTC.
//   4. Customer tidak bisa menyisipkan nama orang lain.
//
// Jalankan:  node tools/verify_b15_run.mjs

import { onRequest as delivery } from '../functions/api/delivery.js';
import { createSessionToken } from '../functions/_db.js';
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

/**
 * Baris tiruan: SELECT pada `pickup_delivery` mengembalikan satu tugas
 * terjadwal milik Budi Santoso, supaya jalur `delete_task` non-staf bisa
 * diukur (cabang "boleh hapus" dan cabang "tidak diizinkan").
 */
function rowsFor(sql) {
  const s = String(sql);
  if (/FROM\s+pickup_delivery/i.test(s) && /^\s*SELECT/i.test(s)) {
    return [{ id: 3, task_code: 'PU-TEST', status: 'scheduled', customer_name: 'Budi Santoso' }];
  }
  return [];
}

async function call(method, path, body, cookie) {
  __calls.length = 0;
  globalThis.__MOCK_ROWS = rowsFor;
  let status = 0;
  let json = null;
  let text = '';
  try {
    const res = await delivery({ request: req(method, path, body, cookie), env: ENV, ctx: {} });
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

// --- token untuk tiap peran ------------------------------------------------

const custToken = await createSessionToken(
  { id: 9, full_name: 'Budi Santoso', role: 'Customer', email: 'budi@gmail.com' }, ENV);
const staffToken = await createSessionToken(
  { id: 1, full_name: 'Admin Uji', role: 'Admin', email: 'admin@gmail.com' }, ENV);

// ==========================================================================
// [1] create_task — setiap field ngawur harus 400, bukan 200
// ==========================================================================

console.log('\n[1] create_task — input ngawur -> 400 dan nol baris tersentuh');

const BASE_TASK = { action: 'create_task', type: 'pickup', customer_name: 'Budi', address: 'Jl. Uji' };

for (const [label, patch] of [
  ['nama 5.000 karakter', { customer_name: 'X'.repeat(5000) }],
  ['telepon objek', { phone: { n: 1 } }],
  ['alamat array', { address: ['a', 'b'] }],
  ['kode pesanan 9.000 karakter', { order_code: 'Z'.repeat(9000) }],
  ['catatan 20.000 karakter', { notes: 'N'.repeat(20000) }],
  ['tanggal jadwal "besok-saja"', { schedule_date: 'besok-saja' }],
  ['tanggal jadwal 2026-02-31', { schedule_date: '2026-02-31' }],
  ['jam mulai "pagi sekali"', { start_time: 'pagi sekali' }],
  ['jam selesai 99:99', { end_time: '99:99' }],
  ['tipe asing', { type: 'kirim-aja' }],
  ['tipe hilang', { type: undefined }]
]) {
  const body = { ...BASE_TASK, ...patch };
  // Hanya hapus `type` bila patch SENGAJA meniadakannya. Penjaga `=== undefined`
  // yang longgar membuat SETIAP kasus kehilangan `type`, sehingga semuanya
  // 400 karena "Tipe wajib diisi" — bukan karena field yang sedang diuji.
  // Ini hijau palsu: terbukti saat uji mutasi (batas nama dibuka jadi
  // 100.000) tetap HIJAU padahal kode sudah rusak.
  if ('type' in patch && patch.type === undefined) delete body.type;
  const r = await call('POST', '/api/delivery', body, staffToken);
  check(`create_task ${label} -> 400`, r.status === 400,
    `status=${r.status} body=${r.text.slice(0, 90)}`);
  check(`create_task ${label} -> ok:false`, r.json?.ok === false, JSON.stringify(r.json));
  check(`create_task ${label} -> nol baris tersentuh`, untouched(r.calls),
    r.calls.map(c => String(c.sql).replace(/\s+/g, ' ').slice(0, 70)).join(' | '));
}

// ==========================================================================
// [2] create_task — jalur SUKSES tidak mati
// ==========================================================================

console.log('\n[2] create_task — jalur sukses tetap 200');

{
  const r = await call('POST', '/api/delivery', {
    action: 'create_task', type: 'delivery', customer_name: 'Siti', phone: '0812',
    address: 'Jl. Melati 5', order_code: 'ORD-1', schedule_date: '2026-12-24',
    start_time: '09:30', end_time: '15:45', notes: 'Pagar hijau'
  }, staffToken);
  check('create_task wajar -> 200', r.status === 200, `status=${r.status} body=${r.text.slice(0, 90)}`);
  check('create_task wajar -> ok:true', r.json?.ok === true, JSON.stringify(r.json));

  const ins = r.calls.find(c => /INSERT INTO pickup_delivery/i.test(c.sql));
  check('create_task wajar -> 1 INSERT', !!ins, r.calls.map(c => String(c.sql).slice(0, 50)).join(' | '));
  const p = ins?.params || [];
  check('create_task wajar -> tipe ikut tersimpan', p[1] === 'delivery', JSON.stringify(p[1]));
  check('create_task wajar -> nama ikut tersimpan', p[3] === 'Siti', JSON.stringify(p[3]));
  check('create_task wajar -> telepon ikut tersimpan', p[4] === '0812', JSON.stringify(p[4]));
  check('create_task wajar -> alamat ikut tersimpan', p[5] === 'Jl. Melati 5', JSON.stringify(p[5]));
  check('create_task wajar -> jadwal eksplisit dipakai', p[8] === '2026-12-24', JSON.stringify(p[8]));
  check('create_task wajar -> jam mulai ikut tersimpan', p[9] === '09:30', JSON.stringify(p[9]));
  check('create_task wajar -> jam selesai ikut tersimpan', p[10] === '15:45', JSON.stringify(p[10]));
  check('create_task wajar -> tanpa kurir = scheduled', p[6] === 'scheduled', JSON.stringify(p[6]));
  check('create_task wajar -> nilai ter-parameterisasi (14 placeholder)',
    (ins?.sql.match(/\?/g) || []).length === 14, String(ins?.sql).replace(/\s+/g, ' ').slice(0, 120));
}

{
  // Kurir sah -> status otomatis 'assigned', bukan 'scheduled'.
  const r = await call('POST', '/api/delivery', {
    action: 'create_task', type: 'pickup', customer_name: 'Siti', address: 'Jl. Melati 5', courier_id: 4
  }, staffToken);
  const p = r.calls.find(c => /INSERT INTO pickup_delivery/i.test(c.sql))?.params || [];
  check('create_task dengan kurir -> status assigned', p[6] === 'assigned', JSON.stringify(p[6]));
  check('create_task dengan kurir -> courier_id tersimpan', p[7] === 4, JSON.stringify(p[7]));
}

// ==========================================================================
// [3] schedule_date bawaan = hari Asia/Jakarta, BUKAN UTC
// ==========================================================================
//
// Ini inti perbaikan kedua. `schedule_date` adalah DATE NOT NULL. Bila klien
// tidak mengirim tanggal, tugas dijadwalkan hari ini — dan "hari ini" harus
// menurut jam operasional (WIB), bukan UTC. Antara 00:00 dan 06:59 WIB
// keduanya berbeda satu hari.

console.log('\n[3] schedule_date bawaan — zona Asia/Jakarta');

{
  const r = await call('POST', '/api/delivery', {
    action: 'create_task', type: 'pickup', address: 'Jl. Uji'
  }, staffToken);
  const p = r.calls.find(c => /INSERT INTO pickup_delivery/i.test(c.sql))?.params || [];
  const expected = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const utc = new Date().toISOString().split('T')[0];
  check('create_task tanpa tanggal -> jadwal = hari Asia/Jakarta',
    p[8] === expected, `terkirim=${p[8]} WIB=${expected} UTC=${utc}`);

  // Bukti bahwa uji ini punya gigi: bila kedua zona sedang sama, uji di atas
  // akan hijau sekalipun kodenya masih UTC. Karena itu nilai BAWAAN juga
  // dibandingkan dengan ekspresi mentah UTC — harus IDENTIK hanya bila
  // memang sedang hari yang sama di kedua zona.
  check('jadwal bawaan TIDAK berasal dari toISOString() bila zona berbeda',
    expected === utc ? true : p[8] !== utc,
    `terkirim=${p[8]} WIB=${expected} UTC=${utc}`);
}

// --- 3b. Uji yang sama dengan JAM DIKUNCI ke 06:00 WIB ----------------------
//
// Uji [3] di atas punya kelemahan yang harus diakui: bila saat harness
// berjalan WIB dan UTC sedang hari yang sama, uji itu HIJAU sekalipun kode
// masih memakai `toISOString()` — terbukti saat uji mutasi ("jadwal bawaan
// kembali ke UTC") tetap HIJAU 91/91.
//
// Karena itu jamnya dikunci ke 06:00 WIB = 23:00 UTC hari SEBELUMNYA. Pada
// jam itu kedua zona pasti berbeda hari, jadi uji ini tidak bisa hijau
// palsu. `Date` diganti sementara di scope global — satu-satunya cara
// mengukur `todayIn()` yang dipanggil tanpa argumen dari dalam handler.

{
  const RealDate = Date;
  // 2026-09-11 06:00 WIB  ==  2026-09-10 23:00 UTC
  const FIXED = new RealDate('2026-09-10T23:00:00Z').getTime();
  class FrozenDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(FIXED);
      else super(...args);
    }
    static now() { return FIXED; }
  }
  globalThis.Date = FrozenDate;
  try {
    const r = await call('POST', '/api/delivery',
      { action: 'create_task', type: 'pickup', address: 'Jl. Uji' }, staffToken);
    const p = r.calls.find(c => /INSERT INTO pickup_delivery/i.test(c.sql))?.params || [];
    // 06:00 WIB -> "hari ini" yang benar adalah 11, sedangkan UTC memberi 10.
    check('06:00 WIB -> jadwal bawaan 2026-09-11 (bukan 2026-09-10 UTC)',
      p[8] === '2026-09-11', `terkirim=${p[8]} (UTC akan memberi 2026-09-10)`);
  } finally {
    globalThis.Date = RealDate;
  }
}

{
  // Pemulihan jam: setelah scope di atas selesai, `new Date()` harus kembali
  // nyata. Tanpa uji ini, kebocoran `FrozenDate` akan membuat semua uji
  // berikutnya mengukur waktu yang salah tanpa ada yang menyadari.
  const drift = Math.abs(Date.now() - new RealDateProbe().getTime());
  check('jam global pulih setelah uji beku (tidak bocor)', drift < 60000, `selisih=${drift} ms`);
}
function RealDateProbe() { return new (globalThis.Date)(); }

// ==========================================================================
// [4] update_status / assign_courier / delete_task — id tidak lagi ngawur
// ==========================================================================

console.log('\n[4] id & status pada aksi perubahan');

for (const [label, body] of [
  ['update_status id array', { action: 'update_status', id: [5, 9], status: 'completed' }],
  ['update_status id negatif', { action: 'update_status', id: -3, status: 'completed' }],
  ['update_status id nol', { action: 'update_status', id: 0, status: 'completed' }],
  ['update_status id string kosong', { action: 'update_status', id: '', status: 'completed' }],
  ['update_status status asing', { action: 'update_status', id: 3, status: 'DIJALANKAN' }],
  ['update_status status objek', { action: 'update_status', id: 3, status: { s: 1 } }],
  ['assign_courier id array', { action: 'assign_courier', id: [3], courier_id: 2 }],
  ['assign_courier id negatif', { action: 'assign_courier', id: -1, courier_id: 2 }],
  ['assign_courier kurir negatif', { action: 'assign_courier', id: 3, courier_id: -7 }],
  ['delete_task id array', { action: 'delete_task', id: [3] }],
  ['delete_task id negatif', { action: 'delete_task', id: -3 }],
  ['delete_task id string', { action: 'delete_task', id: 'abc' }]
]) {
  const r = await call('POST', '/api/delivery', body, staffToken);
  check(`${label} -> 400`, r.status === 400, `status=${r.status} body=${r.text.slice(0, 90)}`);
  check(`${label} -> nol baris tersentuh`, untouched(r.calls),
    r.calls.map(c => String(c.sql).replace(/\s+/g, ' ').slice(0, 70)).join(' | '));
}

{
  // Jalur SUKSES: status sah tetap mengubah baris, dan id ter-parameterisasi.
  const r = await call('POST', '/api/delivery',
    { action: 'update_status', id: 3, status: 'onroute' }, staffToken);
  check('update_status sah -> 200', r.status === 200, `status=${r.status} body=${r.text.slice(0, 90)}`);
  const up = r.calls.find(c => /UPDATE pickup_delivery/i.test(c.sql));
  check('update_status sah -> 1 UPDATE', !!up, r.calls.map(c => String(c.sql).slice(0, 50)).join(' | '));
  check('update_status sah -> status & id ter-parameterisasi',
    Array.isArray(up?.params) && up.params[0] === 'onroute' && up.params[1] === 3,
    JSON.stringify(up?.params));
}

{
  // Kurir dilepas -> courier_id NULL dan status kembali 'scheduled'.
  const r = await call('POST', '/api/delivery',
    { action: 'assign_courier', id: 3 }, staffToken);
  const up = r.calls.find(c => /UPDATE pickup_delivery/i.test(c.sql));
  check('assign_courier tanpa kurir -> courier_id NULL',
    up?.params?.[0] === null, JSON.stringify(up?.params));
  check('assign_courier tanpa kurir -> status scheduled',
    up?.params?.[1] === 'scheduled', JSON.stringify(up?.params));
}

// ==========================================================================
// [5] isolasi data — Customer tidak bisa menumpang nama orang lain
// ==========================================================================

console.log('\n[5] isolasi data (B10) harus tetap utuh setelah perubahan');

{
  const r = await call('POST', '/api/delivery',
    { action: 'create_task', type: 'pickup', customer_name: 'Orang Lain', address: 'Jl. Uji' },
    custToken);
  const p = r.calls.find(c => /INSERT INTO pickup_delivery/i.test(c.sql))?.params || [];
  check('Customer create_task -> nama dipaksa ke namanya sendiri',
    p[3] === 'Budi Santoso', `terkirim=${JSON.stringify(p[3])}`);
}

{
  // Kurir hanya boleh ditunjuk staf: `isStaff && d.courier_id`.
  const r = await call('POST', '/api/delivery',
    { action: 'create_task', type: 'pickup', address: 'Jl. Uji', courier_id: 4 },
    custToken);
  const p = r.calls.find(c => /INSERT INTO pickup_delivery/i.test(c.sql))?.params || [];
  check('Customer create_task -> courier_id diabaikan (tetap null)',
    p[7] === null, `terkirim=${JSON.stringify(p[7])}`);
  check('Customer create_task -> status tetap scheduled',
    p[6] === 'scheduled', `terkirim=${JSON.stringify(p[6])}`);
}

for (const act of ['update_status', 'assign_courier']) {
  const r = await call('POST', '/api/delivery', { action: act, id: 3, status: 'completed' }, custToken);
  check(`${act} sebagai Customer -> 401`, r.status === 401, `status=${r.status}`);
  check(`${act} sebagai Customer -> nol baris tersentuh`, untouched(r.calls),
    r.calls.map(c => String(c.sql).replace(/\s+/g, ' ').slice(0, 70)).join(' | '));
}

{
  // Tanpa sesi sama sekali.
  const r = await call('POST', '/api/delivery', BASE_TASK, null);
  check('create_task tanpa sesi -> 401', r.status === 401, `status=${r.status}`);
}

// ==========================================================================
// [6] GET — filter ngawur tidak lagi disalahartikan sebagai "tidak ada tugas"
// ==========================================================================

console.log('\n[6] GET — parameter filter divalidasi');

{
  const r = await call('GET', '/api/delivery?status=DIJALANKAN', undefined, staffToken);
  check('GET status asing -> 400', r.status === 400, `status=${r.status} body=${r.text.slice(0, 90)}`);
}

{
  const r = await call('GET', '/api/delivery?date=besok-saja', undefined, staffToken);
  check('GET date ngawur -> 400', r.status === 400, `status=${r.status} body=${r.text.slice(0, 90)}`);
}

{
  const r = await call('GET', '/api/delivery?status=completed&date=2026-12-24&q=xxx',
    undefined, staffToken);
  check('GET filter sah -> 200', r.status === 200, `status=${r.status} body=${r.text.slice(0, 90)}`);
  const sel = r.calls.find(c => /FROM pickup_delivery/i.test(c.sql));
  check('GET filter sah -> status ter-parameterisasi',
    Array.isArray(sel?.params) && sel.params.includes('completed'), JSON.stringify(sel?.params));
}

{
  // Customer harus tetap ter-skop (B10) — perubahan ini tidak boleh membukanya.
  const r = await call('GET', '/api/delivery', undefined, custToken);
  const sel = r.calls.find(c => /FROM pickup_delivery/i.test(c.sql));
  check('GET sebagai Customer -> ADA filter customer_name',
    sel && /customer_name\s*=\s*\?/.test(sel.sql),
    sel ? sel.sql.replace(/\s+/g, ' ').slice(0, 110) : 'tidak ada SELECT');
}

// --- ringkasan -------------------------------------------------------------

console.log('');
console.log(`HASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
