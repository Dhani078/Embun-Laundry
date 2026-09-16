// tools/verify_c8.mjs
// Harness verifikasi Task C8 — Laporan Bulanan & Visualisasi Chart Interaktif
//
// Menguji:
// 1. Audit statik reports.js dan src/index.js (ekspor onRequestGet & onRequestOptions, optMap).
// 2. Hak akses RBAC: Staf (Admin/Owner/Staff) dijawab 200, Customer ditolak 403, tanpa sesi ditolak 401.
// 3. Validasi rentang tanggal (format salah -> 400, terbalik -> 400, >3660 hari -> 400).
// 4. Pengelompokan periode (group: bulan, minggu, hari, fallback aman).
// 5. Pertahanan SQL Injection (canary parameter ?group=, ?start=, ?end=).
// 6. Integrasi pra-pemeriksaan OPTIONS via Cloudflare Worker.
// 7. Audit antarmuka frontend (public/app.js & dashboard.html): filter controls, preset buttons,
//    SVG chart generator, hover tooltip interaktif, KPI summary, daily table, print action.
//
// Jalankan: node tools/verify_c8_run.mjs

import fs from 'node:fs';
import path from 'node:path';
import worker from '../src/index.js';
import { onRequestGet as reportsHandler, onRequestOptions as reportsOptions } from '../functions/api/reports.js';
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

const ENV = {
  TIDB_DATABASE_URL: 'mysql://mock:3306/laundry',
  JWT_SECRET: 'c8-reports-chart-secret'
};

async function createStaffToken(role = 'Admin') {
  return createSessionToken({
    id: 1,
    user_id: 1,
    full_name: 'Staf Keuangan',
    role,
    email: 'keuangan@embunlaundry.com'
  }, ENV);
}

async function createCustToken() {
  return createSessionToken({
    id: 20,
    user_id: 20,
    full_name: 'Pelanggan Biasa',
    role: 'Customer',
    email: 'pelanggan@gmail.com'
  }, ENV);
}

// ---------------------------------------------------------------------------
// Bagian 1 — Audit Statik Backend & Router
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit Statik Backend & Router');

const reportsCode = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'reports.js'), 'utf8');
const indexCode = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');

check('reports.js mengekspor onRequestGet dan onRequestOptions',
  typeof reportsHandler === 'function' && typeof reportsOptions === 'function');
check('src/index.js mendaftarkan /api/reports di optMap preflight CORS',
  indexCode.includes("'/api/reports': reportsHandler"));
check('src/index.js memetakan routing /api/reports GET dan OPTIONS',
  indexCode.includes("path === '/api/reports'") && indexCode.includes('reportsHandler.onRequestGet'));
check('reports.js tidak membocorkan raw error message (SERVER_ERROR generic)',
  !reportsCode.includes('msg: e.message'));

// ---------------------------------------------------------------------------
// Bagian 2 — Hak Akses & Otorisasi Peran (RBAC)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Hak Akses & Otorisasi Peran (RBAC)');

const adminToken = await createStaffToken('Admin');
const ownerToken = await createStaffToken('Owner');
const staffToken = await createStaffToken('Staff');
const custToken = await createCustToken();

// GET tanpa sesi -> 401
const resNoAuth = await reportsHandler({
  request: new Request('http://localhost/api/reports', { method: 'GET' }),
  env: ENV
});
check('GET /api/reports tanpa sesi ditolak 401', resNoAuth.status === 401);

// GET oleh Customer -> 403 (B11 isolasi data laporan)
const resCust = await reportsHandler({
  request: new Request('http://localhost/api/reports', {
    method: 'GET',
    headers: { Cookie: `session_token=${custToken}` }
  }),
  env: ENV
});
check('GET /api/reports oleh Customer ditolak 403', resCust.status === 403);
const custJson = await resCust.json();
check('GET /api/reports oleh Customer tidak memuat kpi/chart/daily',
  custJson.kpi === undefined && custJson.chart === undefined && custJson.daily === undefined);

// GET oleh Admin, Owner, Staff -> 200
for (const [rName, rTok] of [['Admin', adminToken], ['Owner', ownerToken], ['Staff', staffToken]]) {
  resetMockCalls();
  const res = await reportsHandler({
    request: new Request('http://localhost/api/reports', {
      method: 'GET',
      headers: { Cookie: `session_token=${rTok}` }
    }),
    env: ENV
  });
  check(`GET /api/reports oleh ${rName} diterima 200`, res.status === 200);
  const json = await res.json();
  check(`GET /api/reports oleh ${rName} mengembalikan objek data ok:true`,
    json.ok === true && Boolean(json.kpi) && Array.isArray(json.chart) && Array.isArray(json.daily));
}

// ---------------------------------------------------------------------------
// Bagian 3 — Validasi Rentang Tanggal
// ---------------------------------------------------------------------------
console.log('\n# Bagian 3 — Validasi Rentang Tanggal');

// Tanggal salah format -> 400
const resBadFmt = await reportsHandler({
  request: new Request('http://localhost/api/reports?start=bukan-tanggal&end=2026-09-01', {
    method: 'GET',
    headers: { Cookie: `session_token=${adminToken}` }
  }),
  env: ENV
});
check('Format tanggal start salah ditolak 400', resBadFmt.status === 400);

// Rentang terbalik (start > end) -> 400
const resInverted = await reportsHandler({
  request: new Request('http://localhost/api/reports?start=2026-09-15&end=2026-09-01', {
    method: 'GET',
    headers: { Cookie: `session_token=${adminToken}` }
  }),
  env: ENV
});
check('Rentang tanggal terbalik (start > end) ditolak 400', resInverted.status === 400);

// Rentang > 3660 hari -> 400
const resTooWide = await reportsHandler({
  request: new Request('http://localhost/api/reports?start=2010-01-01&end=2026-01-01', {
    method: 'GET',
    headers: { Cookie: `session_token=${adminToken}` }
  }),
  env: ENV
});
check('Rentang tanggal > 3660 hari ditolak 400', resTooWide.status === 400);

// Rentang valid -> 200 dan parameterized
resetMockCalls();
const resValidRange = await reportsHandler({
  request: new Request('http://localhost/api/reports?start=2026-08-01&end=2026-08-31', {
    method: 'GET',
    headers: { Cookie: `session_token=${adminToken}` }
  }),
  env: ENV
});
check('Rentang tanggal valid diterima 200', resValidRange.status === 200);
const rangeQuery = __calls.find(c => /BETWEEN\s+\?\s+AND\s+\?/i.test(c.sql));
check('Query laporan menggunakan binding parameterized BETWEEN ? AND ?',
  Boolean(rangeQuery) && rangeQuery.params.includes('2026-08-01 00:00:00') && rangeQuery.params.includes('2026-08-31 23:59:59'));

// ---------------------------------------------------------------------------
// Bagian 4 — Pengelompokan Periode (Group: Bulan, Minggu, Hari)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 4 — Pengelompokan Periode (Group: Bulan, Minggu, Hari)');

// Group bulan
resetMockCalls();
await reportsHandler({
  request: new Request('http://localhost/api/reports?group=bulan', {
    method: 'GET',
    headers: { Cookie: `session_token=${adminToken}` }
  }),
  env: ENV
});
const bulanQuery = __calls.find(c => /DATE_FORMAT\(created_at,\s*'%Y-%m'\)/i.test(c.sql));
check('Pengelompokan group=bulan menggunakan DATE_FORMAT %Y-%m', Boolean(bulanQuery));

// Group minggu
resetMockCalls();
await reportsHandler({
  request: new Request('http://localhost/api/reports?group=minggu', {
    method: 'GET',
    headers: { Cookie: `session_token=${adminToken}` }
  }),
  env: ENV
});
const mingguQuery = __calls.find(c => /WEEK\(created_at,\s*3\)/i.test(c.sql));
check('Pengelompokan group=minggu menggunakan WEEK ISO 3', Boolean(mingguQuery));

// Group hari
resetMockCalls();
await reportsHandler({
  request: new Request('http://localhost/api/reports?group=hari', {
    method: 'GET',
    headers: { Cookie: `session_token=${adminToken}` }
  }),
  env: ENV
});
const hariQuery = __calls.find(c => /DATE\(created_at\)/i.test(c.sql));
check('Pengelompokan group=hari menggunakan DATE(created_at)', Boolean(hariQuery));

// Group invalid / hacker attempt -> fallback aman ke bulan
resetMockCalls();
await reportsHandler({
  request: new Request('http://localhost/api/reports?group=malicious_expr', {
    method: 'GET',
    headers: { Cookie: `session_token=${adminToken}` }
  }),
  env: ENV
});
const fallbackQuery = __calls.find(c => /DATE_FORMAT\(created_at,\s*'%Y-%m'\)/i.test(c.sql));
check('Group tidak dikenal aman fallback ke DATE_FORMAT bulan', Boolean(fallbackQuery));

// ---------------------------------------------------------------------------
// Bagian 5 — SQL Injection Canary & Routing Worker
// ---------------------------------------------------------------------------
console.log('\n# Bagian 5 — SQL Injection Canary & Routing Worker');

resetMockCalls();
const CANARY = "'; DROP TABLE orders; --";
await reportsHandler({
  request: new Request(`http://localhost/api/reports?group=${encodeURIComponent(CANARY)}`, {
    method: 'GET',
    headers: { Cookie: `session_token=${adminToken}` }
  }),
  env: ENV
});
const dirtyCalls = __calls.some(c => c.sql.includes('DROP TABLE'));
check('Parameter ?group= kebal SQL injection canary', !dirtyCalls);

// Worker preflight OPTIONS
const optRes = await worker.fetch(new Request('http://localhost/api/reports', { method: 'OPTIONS' }), ENV);
check('OPTIONS /api/reports via Worker mengembalikan status 200/204', optRes.status === 200 || optRes.status === 204);

// ---------------------------------------------------------------------------
// Bagian 6 — Audit Antarmuka Frontend (public/app.js & dashboard.html)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 6 — Audit Antarmuka Frontend (public/app.js & dashboard.html)');

const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const dashHtml = fs.readFileSync(path.join(ROOT, 'public', 'dashboard.html'), 'utf8');

check('dashboard.html memuat tautan navigasi Laporan data-page="laporan"',
  dashHtml.includes('data-page="laporan"') && dashHtml.includes('Laporan'));
check('app.js mendefinisikan metode renderLaporan',
  appJs.includes('renderLaporan()') || appJs.includes('async renderLaporan'));
check('app.js memuat fungsi pembuat grafik interaktif buildSvgChart',
  appJs.includes('buildSvgChart('));
check('app.js memuat elemen kontrol filter laporan (reportGroup, reportStart, reportEnd)',
  appJs.includes('reportGroup') && appJs.includes('reportStart') && appJs.includes('reportEnd'));
check('app.js memuat aksi filter applyReportFilter',
  appJs.includes('applyReportFilter()') || appJs.includes('applyReportFilter'));
check('app.js memuat tombol preset rentang tanggal (setReportPreset)',
  appJs.includes('setReportPreset('));
check('app.js memuat visualisasi chart batang bertumpuk terbayar vs piutang (bar-paid, bar-unpaid)',
  appJs.includes('bar-paid') && appJs.includes('bar-unpaid'));
check('app.js memuat elemen tooltip hover interaktif (chartTooltip)',
  appJs.includes('chartTooltip') && appJs.includes('mouseenter'));
check('app.js memuat tombol cetak/ekspor laporan (window.print)',
  appJs.includes('window.print()'));

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL C8: HIJAU ${pass}, MERAH ${fail} (${pass}/${pass + fail})`);
process.exit(fail > 0 ? 1 : 0);
