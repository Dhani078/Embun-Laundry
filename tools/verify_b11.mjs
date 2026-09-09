// Harness verifikasi B11 — hak akses laporan + validasi rentang tanggal.
//
// PERTANYAAN YANG DIJAWAB:
//   1. "Kalau aku login sebagai Customer, apakah /api/reports mau menjawab?"
//      Jawaban yang benar: TIDAK (403), dan tidak ada query agregat yang
//      sia-sia dijalankan.
//   2. "Kalau aku kirim rentang tanggal ngawur, apa yang terjadi?"
//      Jawaban yang benar: 400, dan SATU pun SELECT tidak boleh terkirim.
//   3. "Apakah staf masih bisa memakai laporan seperti biasa?"
//      Jawaban yang benar: YA, 200 + tiga query agregat + parameter tanggal
//      berformat `YYYY-MM-DD HH:MM:SS`.
//
// Cara ukur: panggil handler SUNGGUHAN dengan driver DB tiruan
// (tools/mock_tidb.mjs) yang MENCATAT setiap SQL beserta params-nya, lalu
// periksa status, isi JSON, dan SQL yang benar-benar terkirim.
// Ini penting: kalau hanya membaca kode sumber, perbaikan yang salah
// (mis. 403 tetapi query tetap dijalankan) akan terlihat sama-sama "aman".
//
// Jalankan:  node tools/verify_b11_run.mjs

import { onRequestGet as reports } from '../functions/api/reports.js';
import { dateRange } from '../functions/_reportfilter.js';
import { createSessionToken } from '../functions/_db.js';
import { __calls } from './mock_tidb.mjs';

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

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

async function call(path, cookie) {
  __calls.length = 0;
  globalThis.__MOCK_ROWS = [{ rev: 1234000, ord: 12, avg_wt: 4.5 }];
  const headers = {};
  if (cookie) headers['Cookie'] = `session_token=${cookie}`;
  const res = await reports({
    request: new Request(BASE + path, { method: 'GET', headers }),
    env: ENV,
    ctx: {}
  });
  let json = null;
  try { json = await res.json(); } catch { /* bukan JSON */ }
  return { status: res.status, json, calls: __calls.slice() };
}

const ROLES = [
  ['Admin', 'Admin'],
  ['Owner', 'Owner'],
  ['Staff', 'Staff'],
  ['Customer', 'Customer']
];

const tokens = {};
for (const [name, role] of ROLES) {
  tokens[role] = await createSessionToken(
    { id: role === 'Customer' ? 9 : 1, full_name: `Uji ${name}`, role, email: `${role}@t.test` },
    ENV
  );
}

// --- 1. HAK AKSES: staf boleh, pelanggan tidak -----------------------------

for (const role of ['Admin', 'Owner', 'Staff']) {
  const r = await call('/api/reports', tokens[role]);
  check(`reports sebagai ${role} -> 200`, r.status === 200, `status=${r.status}`);
  check(`reports sebagai ${role} -> ok:true`, r.json && r.json.ok === true,
    JSON.stringify(r.json)?.slice(0, 90));
  // Tiga query agregat: KPI + chart + daily.
  const agregat = r.calls.filter(c => /SUM\(|COUNT\(\)/.test(c.sql));
  check(`reports sebagai ${role} -> 3 query agregat dijalankan`, agregat.length === 3,
    `terkirim=${agregat.length}`);
}

{
  const r = await call('/api/reports', tokens.Customer);
  check('reports sebagai Customer -> 403 (hardening hak paling rendah)',
    r.status === 403, `status=${r.status}`);
  check('reports sebagai Customer -> ok:false', r.json && r.json.ok === false,
    JSON.stringify(r.json)?.slice(0, 90));
  check('reports sebagai Customer -> TIDAK ada angka omzet di jawaban',
    r.json && r.json.kpi === undefined && r.json.chart === undefined && r.json.daily === undefined,
    JSON.stringify(r.json)?.slice(0, 90));
  const agregat = r.calls.filter(c => /SUM\(|COUNT\(\)/.test(c.sql));
  check('reports sebagai Customer -> NOL query agregat (tidak ada kerja sia-sia)',
    agregat.length === 0, `terkirim=${agregat.length}`);
}

{
  const r = await call('/api/reports', null);
  check('reports tanpa sesi -> 401', r.status === 401, `status=${r.status}`);
}

// --- 2. RENTANG TANGGAL: nilai ngawur tidak boleh sampai ke SQL ------------

const BAD = [
  ['start tidak valid', '/api/reports?start=bukan-tanggal&end=2026-09-09'],
  ['end tidak valid', '/api/reports?start=2026-09-01&end=99-99-9999'],
  ['tanggal yang tidak pernah ada', '/api/reports?start=2026-02-31&end=2026-03-01'],
  ['rentang terbalik', '/api/reports?start=2026-09-30&end=2026-09-01'],
  ['rentang raksasa (>3660 hari)', '/api/reports?start=1990-01-01&end=2026-09-09'],
  ['hanya start (dulu = tanpa batas)', '/api/reports?start=2026-09-01'],
  ['hanya end (dulu = tanpa batas)', '/api/reports?end=2026-09-09']
];

for (const [label, path] of BAD) {
  const r = await call(path, tokens.Admin);
  check(`${label} -> 400`, r.status === 400, `status=${r.status}`);
  check(`${label} -> NOL SELECT terkirim`, r.calls.length === 0,
    `terkirim=${r.calls.length}`);
}

// --- 3. RENTANG SAH: laporan tetap jalan & param berformat datetime --------

{
  const r = await call('/api/reports?start=2026-09-01&end=2026-09-09', tokens.Admin);
  check('rentang sah -> 200', r.status === 200, `status=${r.status}`);
  const withBetween = r.calls.filter(c => c.sql.includes('BETWEEN ? AND ?'));
  check('rentang sah -> klausa BETWEEN terpasang di 3 query',
    withBetween.length === 3, `terpasang=${withBetween.length}`);
  const allParams = r.calls.flatMap(c => c.params || []);
  check('rentang sah -> param persis "2026-09-01 00:00:00"',
    allParams.includes('2026-09-01 00:00:00'), JSON.stringify(allParams));
  check('rentang sah -> param persis "2026-09-09 23:59:59"',
    allParams.includes('2026-09-09 23:59:59'), JSON.stringify(allParams));
  // Tidak boleh ada lagi sisa tanggal mentah yang disambung di SQL.
  check('rentang sah -> tidak ada sisa literal tanggal di SQL',
    !r.calls.some(c => /\d{4}-\d{2}-\d{2}/.test(c.sql.replace(/\?/g, ''))),
    r.calls.map(c => c.sql).join(' | ').slice(0, 160));
}

{
  const r = await call('/api/reports', tokens.Admin);
  check('tanpa rentang -> 200 (seluruh waktu, perilaku lama yang sah)',
    r.status === 200, `status=${r.status}`);
  check('tanpa rentang -> TIDAK ada klausa BETWEEN',
    !r.calls.some(c => c.sql.includes('BETWEEN')), 'BETWEEN masih ada');
}

// --- 4. UNIT: penjaga rentang diuji langsung -------------------------------

{
  const ok = dateRange(new URLSearchParams('start=2026-01-01&end=2026-12-31'));
  check('unit: rentang 364 hari diterima', ok.ok === true, JSON.stringify(ok));
  const batas = dateRange(new URLSearchParams('start=2020-01-01&end=2030-01-01'));
  check('unit: rentang 3653 hari (di bawah batas 3660) diterima',
    batas.ok === true, JSON.stringify(batas));
  const terlaluPanjang = dateRange(new URLSearchParams('start=2000-01-01&end=2030-01-01'));
  check('unit: rentang 10958 hari ditolak', terlaluPanjang.ok === false,
    JSON.stringify(terlaluPanjang));
  const kosong = dateRange(new URLSearchParams(''));
  check('unit: tanpa parameter -> cond kosong, tanpa param',
    kosong.ok === true && kosong.cond === '' && kosong.params.length === 0,
    JSON.stringify(kosong));

  // Karakter kontrol DIHAPUS oleh cleanStr (B2), bukan dijadikan alasan
  // menolak. Yang diuji di sini adalah bahwa karakternya TIDAK ikut ke SQL —
  // nilainya sudah "2026-01-01 ..." yang sah.
  const NUL = String.fromCharCode(1);
  const kontrol = dateRange(new URLSearchParams(`start=2026-01-01${NUL}&end=2026-01-02`));
  check('unit: karakter kontrol dibuang, tanggal tetap sah',
    kontrol.ok === true, JSON.stringify(kontrol));
  check('unit: karakter kontrol TIDAK ikut ke parameter SQL',
    kontrol.ok && !kontrol.params.some(p => /[\u0000-\u001F\u007F]/.test(p)),
    JSON.stringify(kontrol.params));
}

// --- ringkasan -------------------------------------------------------------

console.log('');
console.log(`HASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
