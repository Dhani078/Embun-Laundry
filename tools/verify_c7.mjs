// tools/verify_c7.mjs
// Harness verifikasi Task C7 — Manajemen Voucher & Promo (Admin)
//
// Menguji:
// 1. Audit statik promos.js, vouchers.js, src/index.js, dan skema database.
// 2. Otorisasi peran (RBAC): Staf vs Pelanggan vs Tanpa Sesi.
// 3. Validasi input & aturan bisnis promo (percent <= 100, batas kolom, datetime).
// 4. Siklus hidup CRUD Promo & Distribusi Voucher (Runtime & Parameterized SQL).
// 5. Audit keamanan: SQL injection canary & generic server error.
// 6. Audit integrasi antarmuka frontend (public/app.js & public/dashboard.html).
//
// Jalankan: node tools/verify_c7_run.mjs

import fs from 'node:fs';
import path from 'node:path';
import worker from '../src/index.js';
import { onRequest as promosHandler, onRequestOptions as promosOptions } from '../functions/api/promos.js';
import { onRequest as vouchersHandler, onRequestOptions as vouchersOptions } from '../functions/api/vouchers.js';
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
  JWT_SECRET: 'c7-voucher-promo-secret'
};

async function createStaffToken() {
  return createSessionToken({
    id: 1,
    user_id: 1,
    full_name: 'Admin Toko',
    role: 'Admin',
    email: 'admin@embunlaundry.com'
  }, ENV);
}

async function createCustToken() {
  return createSessionToken({
    id: 10,
    user_id: 10,
    full_name: 'Pelanggan Setia',
    role: 'Customer',
    email: 'budi@gmail.com'
  }, ENV);
}

// ---------------------------------------------------------------------------
// Bagian 1 — Audit Statik Backend & Router
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit Statik Backend & Router');

const promosCode = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'promos.js'), 'utf8');
const vouchersCode = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'vouchers.js'), 'utf8');
const indexCode = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
const schemaCode = fs.readFileSync(path.join(ROOT, 'DATABASE_SCHEMA.md'), 'utf8');

check('promos.js mengekspor onRequest dan onRequestOptions',
  typeof promosHandler === 'function' && typeof promosOptions === 'function');
check('vouchers.js mengekspor onRequest dan onRequestOptions',
  typeof vouchersHandler === 'function' && typeof vouchersOptions === 'function');
check('src/index.js mendaftarkan /api/promos dan /api/vouchers di optMap',
  indexCode.includes("'/api/promos'") && indexCode.includes("'/api/vouchers'"));
check('DATABASE_SCHEMA.md memuat tabel promos dan user_vouchers',
  schemaCode.includes('CREATE TABLE IF NOT EXISTS `promos`') &&
  schemaCode.includes('CREATE TABLE IF NOT EXISTS `user_vouchers`'));
check('promos.js dan vouchers.js tidak membocorkan raw e.message',
  !promosCode.includes('msg: e.message') && !vouchersCode.includes('msg: e.message'));

// ---------------------------------------------------------------------------
// Bagian 2 — Hak Akses & Otorisasi Peran (RBAC)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Hak Akses & Otorisasi Peran (RBAC)');

const staffToken = await createStaffToken();
const custToken = await createCustToken();

// POST promos tanpa sesi -> 401
const resP1 = await promosHandler({
  request: new Request('http://localhost/api/promos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create_promo', name: 'Diskon Baru' })
  }),
  env: ENV
});
check('POST /api/promos tanpa sesi ditolak 401', resP1.status === 401);

// POST promos dengan token Customer -> 401
const resP2 = await promosHandler({
  request: new Request('http://localhost/api/promos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${custToken}`
    },
    body: JSON.stringify({ action: 'create_promo', name: 'Diskon Customer' })
  }),
  env: ENV
});
check('POST /api/promos oleh Customer ditolak 401', resP2.status === 401);

// POST vouchers tanpa sesi -> 401
const resV1 = await vouchersHandler({
  request: new Request('http://localhost/api/vouchers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create_voucher', promo_id: 1, user_id: 10 })
  }),
  env: ENV
});
check('POST /api/vouchers tanpa sesi ditolak 401', resV1.status === 401);

// POST vouchers dengan Customer -> 401
const resV2 = await vouchersHandler({
  request: new Request('http://localhost/api/vouchers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${custToken}`
    },
    body: JSON.stringify({ action: 'create_voucher', promo_id: 1, user_id: 10 })
  }),
  env: ENV
});
check('POST /api/vouchers oleh Customer ditolak 401', resV2.status === 401);

// GET vouchers tanpa sesi -> 401
const resVGetNoAuth = await vouchersHandler({
  request: new Request('http://localhost/api/vouchers', { method: 'GET' }),
  env: ENV
});
check('GET /api/vouchers tanpa sesi ditolak 401', resVGetNoAuth.status === 401);

// ---------------------------------------------------------------------------
// Bagian 3 — Validasi Input & Aturan Bisnis Promo
// ---------------------------------------------------------------------------
console.log('\n# Bagian 3 — Validasi Input & Aturan Bisnis Promo');

// Persen > 100 ditolak 400
const resBadPercent = await promosHandler({
  request: new Request('http://localhost/api/promos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${staffToken}`
    },
    body: JSON.stringify({
      action: 'create_promo',
      name: 'Diskon Fantastis',
      type: 'percent',
      value: 120
    })
  }),
  env: ENV
});
check('create_promo persen > 100 ditolak 400', resBadPercent.status === 400);

// Nama kosong ditolak 400
const resBadName = await promosHandler({
  request: new Request('http://localhost/api/promos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${staffToken}`
    },
    body: JSON.stringify({
      action: 'create_promo',
      name: '',
      type: 'nominal',
      value: 5000
    })
  }),
  env: ENV
});
check('create_promo nama kosong ditolak 400', resBadName.status === 400);

// Kode terlalu panjang (>32 char) ditolak 400
const resLongCode = await promosHandler({
  request: new Request('http://localhost/api/promos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${staffToken}`
    },
    body: JSON.stringify({
      action: 'create_promo',
      code: 'KODE_PROMO_YANG_TERLALU_PANJANG_SEKALI_UNTUK_KOLOM_DATABASE',
      name: 'Promo Panjang',
      type: 'nominal',
      value: 5000
    })
  }),
  env: ENV
});
check('create_promo kode > 32 karakter ditolak 400', resLongCode.status === 400);

// Format expires_at tidak valid ditolak 400
const resBadDate = await promosHandler({
  request: new Request('http://localhost/api/promos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${staffToken}`
    },
    body: JSON.stringify({
      action: 'create_promo',
      name: 'Promo Besok',
      expires_at: 'bukan-format-tanggal'
    })
  }),
  env: ENV
});
check('create_promo expires_at bukan format datetime ditolak 400', resBadDate.status === 400);

// bulk_claim daftar kosong ditolak 400
const resBadBulkEmpty = await vouchersHandler({
  request: new Request('http://localhost/api/vouchers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${staffToken}`
    },
    body: JSON.stringify({
      action: 'bulk_claim',
      promo_id: 1,
      user_ids: []
    })
  }),
  env: ENV
});
check('bulk_claim user_ids kosong ditolak 400', resBadBulkEmpty.status === 400);

// bulk_claim ID bukan angka bulat ditolak 400
const resBadBulkInvalid = await vouchersHandler({
  request: new Request('http://localhost/api/vouchers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${staffToken}`
    },
    body: JSON.stringify({
      action: 'bulk_claim',
      promo_id: 1,
      user_ids: [1, 'hacker']
    })
  }),
  env: ENV
});
check('bulk_claim user_ids bukan integer ditolak 400', resBadBulkInvalid.status === 400);

// ---------------------------------------------------------------------------
// Bagian 4 — Alur CRUD Promo & Distribusi Voucher (Runtime)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 4 — Alur CRUD Promo & Distribusi Voucher (Runtime)');

resetMockCalls();

// Staf membuat promo baru
const resCreatePromo = await promosHandler({
  request: new Request('http://localhost/api/promos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${staffToken}`
    },
    body: JSON.stringify({
      action: 'create_promo',
      code: 'DISKON15',
      name: 'Diskon 15 Persen',
      type: 'percent',
      value: 15,
      min_spend: 50000,
      max_discount: 20000,
      is_active: 1
    })
  }),
  env: ENV
});
check('create_promo berhasil mengembalikan status 200', resCreatePromo.status === 200);
const createCall = __calls.find(c => /INSERT\s+INTO\s+promos/i.test(c.sql));
check('create_promo melakukan INSERT secara parameterized',
  Boolean(createCall) && createCall.params.includes('DISKON15'));

// Staf update promo
resetMockCalls();
const resUpdatePromo = await promosHandler({
  request: new Request('http://localhost/api/promos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${staffToken}`
    },
    body: JSON.stringify({
      action: 'update_promo',
      id: 5,
      code: 'DISKON20',
      name: 'Diskon 20 Persen Diperbarui',
      type: 'percent',
      value: 20,
      min_spend: 60000,
      max_discount: 25000,
      is_active: 1
    })
  }),
  env: ENV
});
check('update_promo berhasil mengembalikan status 200', resUpdatePromo.status === 200);
const updateCall = __calls.find(c => /UPDATE\s+promos\s+SET/i.test(c.sql));
check('update_promo melakukan UPDATE secara parameterized',
  Boolean(updateCall) && updateCall.params.includes(5) && updateCall.params.includes('DISKON20'));

// Staf toggle status aktif
resetMockCalls();
const resToggle = await promosHandler({
  request: new Request('http://localhost/api/promos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${staffToken}`
    },
    body: JSON.stringify({ action: 'toggle_active', id: 5, is_active: 0 })
  }),
  env: ENV
});
check('toggle_active berhasil mengembalikan status 200', resToggle.status === 200);
const toggleCall = __calls.find(c => /UPDATE\s+promos\s+SET\s+is_active/i.test(c.sql));
check('toggle_active mengeksekusi UPDATE is_active', Boolean(toggleCall) && toggleCall.params[0] === 0);

// Staf delete promo
resetMockCalls();
const resDeletePromo = await promosHandler({
  request: new Request('http://localhost/api/promos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${staffToken}`
    },
    body: JSON.stringify({ action: 'delete_promo', id: 5 })
  }),
  env: ENV
});
check('delete_promo berhasil mengembalikan status 200', resDeletePromo.status === 200);
const delCall = __calls.find(c => /DELETE\s+FROM\s+promos/i.test(c.sql));
check('delete_promo mengeksekusi DELETE parameterized', Boolean(delCall) && delCall.params[0] === 5);

// GET /api/promos dengan filter id
resetMockCalls();
const resGetId = await promosHandler({
  request: new Request('http://localhost/api/promos?id=12', { method: 'GET' }),
  env: ENV
});
check('GET /api/promos?id=12 mengembalikan 200', resGetId.status === 200);
const getIdCall = __calls.find(c => /WHERE\s+1=1\s+AND\s+id\s*=\s*\?/i.test(c.sql));
check('GET /api/promos?id=12 menggunakan binding parameterized id = ?',
  Boolean(getIdCall) && getIdCall.params.includes(12));

// Staf delete voucher
resetMockCalls();
const resDelVoucher = await vouchersHandler({
  request: new Request('http://localhost/api/vouchers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_token=${staffToken}`
    },
    body: JSON.stringify({ action: 'delete_voucher', id: 99 })
  }),
  env: ENV
});
check('delete_voucher berhasil mengembalikan status 200', resDelVoucher.status === 200);
const delVCall = __calls.find(c => /DELETE\s+FROM\s+user_vouchers/i.test(c.sql));
check('delete_voucher mengeksekusi DELETE parameterized', Boolean(delVCall) && delVCall.params[0] === 99);

// ---------------------------------------------------------------------------
// Bagian 5 — SQL Injection Canary & Routing Worker
// ---------------------------------------------------------------------------
console.log('\n# Bagian 5 — SQL Injection Canary & Routing Worker');

resetMockCalls();
const CANARY = "'; DROP TABLE promos; --";
await promosHandler({
  request: new Request(`http://localhost/api/promos?q=${encodeURIComponent(CANARY)}&active=true`, { method: 'GET' }),
  env: ENV
});
const dirtyPromos = __calls.some(c => c.sql.includes('DROP TABLE'));
check('GET /api/promos kebal SQL injection canary (parameterized ?)', !dirtyPromos);

resetMockCalls();
await vouchersHandler({
  request: new Request(`http://localhost/api/vouchers?q=${encodeURIComponent(CANARY)}`, {
    method: 'GET',
    headers: { Cookie: `session_token=${staffToken}` }
  }),
  env: ENV
});
const dirtyVouchers = __calls.some(c => c.sql.includes('DROP TABLE'));
check('GET /api/vouchers kebal SQL injection canary (parameterized ?)', !dirtyVouchers);

// Worker preflight OPTIONS
const optRes1 = await worker.fetch(new Request('http://localhost/api/promos', { method: 'OPTIONS' }), ENV);
check('OPTIONS /api/promos via Worker mengembalikan status 200/204', optRes1.status === 200 || optRes1.status === 204);

const optRes2 = await worker.fetch(new Request('http://localhost/api/vouchers', { method: 'OPTIONS' }), ENV);
check('OPTIONS /api/vouchers via Worker mengembalikan status 200/204', optRes2.status === 200 || optRes2.status === 204);

// ---------------------------------------------------------------------------
// Bagian 6 — Audit Antarmuka Frontend (public/app.js & dashboard.html)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 6 — Audit Antarmuka Frontend (public/app.js & dashboard.html)');

const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const dashHtml = fs.readFileSync(path.join(ROOT, 'public', 'dashboard.html'), 'utf8');

check('dashboard.html memuat tautan menu Promo & Voucher',
  dashHtml.includes('data-page="promo"') && dashHtml.includes('Promo & Voucher'));
check('app.js memuat renderPromo dengan percabangan isStaff',
  appJs.includes('renderPromo') && appJs.includes('isStaff'));
check('app.js memuat antarmuka form/modal kelola promo (promoForm / pfCode / savePromo)',
  (appJs.includes('promoFormWrap') || appJs.includes('promoModal')) &&
  (appJs.includes('savePromo') || appJs.includes('promoForm')));
check('app.js memuat antarmuka terbitkan voucher (grantVoucherWrap / grantVoucher)',
  appJs.includes('grantVoucherWrap') || appJs.includes('grantVoucher'));
check('app.js memuat aksi toggle status promo (toggle_active / toggle_promo / togglePromo)',
  appJs.includes('toggle_active') || appJs.includes('togglePromo'));
check('app.js memuat aksi hapus promo dan cabut voucher (deletePromo & deleteVoucher)',
  appJs.includes('delete_promo') && appJs.includes('delete_voucher'));
check('app.js memuat fitur salin kode promo untuk kemudahan checkout pelanggan',
  appJs.includes('clipboard') || appJs.includes('Salin Kode'));

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL C7: HIJAU ${pass}, MERAH ${fail} (${pass}/${pass + fail})`);
process.exit(fail > 0 ? 1 : 0);
