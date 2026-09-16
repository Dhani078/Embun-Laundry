// tools/verify_fase0_9.mjs
// Harness verifikasi Fase 0.9 — Pencabutan Sesi & Refresh Token (K7)
//
// Memastikan:
// 1. Migrasi 0004 menambahkan kolom session_version INT NOT NULL DEFAULT 1 ke tabel users.
// 2. createSessionToken menyematkan session_version dan membatasi masa berlaku token menjadi 7 hari (bukan 30 hari).
// 3. getUserFromSession memvalidasi token terhadap DB dan menolak token bila session_version tidak cocok (fail-closed).
// 4. POST /api/auth/logout menaikkan session_version di DB dan membatalkan token yang telah diterbitkan sebelumnya.
// 5. POST /api/profile (change_password) menaikkan session_version di DB, membatalkan token lama di perangkat lain, dan menyetel token baru.
// 6. POST /api/auth/refresh memperbarui token untuk sesi sah dan menolak sesi yang telah dicabut.
//
// Jalankan: node tools/verify_fase0_9_run.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createSessionToken, getUserFromSession, hashPassword } from '../functions/_db.js';
import { onRequestPost as logoutHandler } from '../functions/api/auth/logout.js';
import { onRequest as profileHandler } from '../functions/api/profile.js';
import { onRequestPost as refreshHandler } from '../functions/api/auth/refresh.js';
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
  JWT_SECRET: 'k7-session-revocation-secret-2026'
};

// ---------------------------------------------------------------------------
// Bagian 1 — Audit Migrasi & Kode Statik
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit Migrasi & Kode Statik');

const migrationPath = path.join(ROOT, 'db', 'migrations', '0004_add_session_version_to_users.sql');
check('file migrasi 0004_add_session_version_to_users.sql ada', fs.existsSync(migrationPath));

const migSql = fs.readFileSync(migrationPath, 'utf8');
check('migrasi 0004 memuat ALTER TABLE users ADD COLUMN session_version',
  /ALTER\s+TABLE\s+users\s+ADD\s+COLUMN\s+session_version\s+INT\s+NOT\s+NULL\s+DEFAULT\s+1/i.test(migSql),
  migSql
);

const dbJs = fs.readFileSync(path.join(ROOT, 'functions', '_db.js'), 'utf8');
check('_db.js createSessionToken membatasi exp ke 7 hari (7 * 24 * 60 * 60)',
  /7\s*\*\s*24\s*\*\s*60\s*\*\s*60/.test(dbJs) && !/30\s*\*\s*24\s*\*\s*60\s*\*\s*60/.test(dbJs)
);

check('_db.js getUserFromSession memeriksa kesesuaian session_version terhadap DB',
  /SELECT\s+session_version\s+FROM\s+users/i.test(dbJs)
);

const logoutJs = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'auth', 'logout.js'), 'utf8');
check('logout.js menaikkan session_version pada DB',
  /UPDATE\s+users\s+SET\s+session_version\s*=\s*session_version\s*\+\s*1/i.test(logoutJs)
);

const profileJs = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'profile.js'), 'utf8');
check('profile.js change_password menaikkan session_version pada DB',
  /UPDATE\s+users\s+SET\s+password_hash\s*=\s*\?,\s*session_version\s*=\s*session_version\s*\+\s*1/i.test(profileJs)
);

const refreshPath = path.join(ROOT, 'functions', 'api', 'auth', 'refresh.js');
check('file refresh.js ada', fs.existsSync(refreshPath));

// ---------------------------------------------------------------------------
// Bagian 2 — Uji createSessionToken & Expiry 7 Hari
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Uji createSessionToken & Expiry 7 Hari');

const initialUser = {
  id: 101,
  full_name: 'Budi Santoso',
  role: 'Customer',
  email: 'budi@example.com',
  session_version: 1
};

const token1 = await createSessionToken(initialUser, ENV);
check('token berhasil dibuat', typeof token1 === 'string' && token1.includes('.'));

const [payloadB64] = token1.split('.');
const payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

check('token menyematkan session_version = 1', payload.session_version === 1, `session_version=${payload.session_version}`);

const nowSec = Math.floor(Date.now() / 1000);
const expectedExp = nowSec + (7 * 24 * 60 * 60);
const diffSec = Math.abs(payload.exp - expectedExp);
check('token berlaku selama 7 hari (~604800 detik)', diffSec < 10, `exp diff=${diffSec}s`);

// ---------------------------------------------------------------------------
// Bagian 3 — Simulasi Runtime Mock DB: Validasi Sesi & Pencabutan (Revocation)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 3 — Simulasi Runtime Mock DB: Validasi Sesi & Pencabutan');

let userState = {
  id: 101,
  full_name: 'Budi Santoso',
  role: 'Customer',
  email: 'budi@example.com',
  phone: '08123456789',
  password_hash: await hashPassword('SandiLama123!'),
  session_version: 1
};

globalThis.__MOCK_ROWS = (sql, params) => {
  const s = String(sql);
  if (/UPDATE\s+users\s+SET\s+session_version\s*=\s*session_version\s*\+\s*1/i.test(s)) {
    userState.session_version += 1;
    return { affectedRows: 1 };
  }
  if (/UPDATE\s+users\s+SET\s+password_hash\s*=\s*\?,\s*session_version\s*=\s*session_version\s*\+\s*1/i.test(s)) {
    userState.password_hash = params[0];
    userState.session_version += 1;
    return { affectedRows: 1 };
  }
  if (/SELECT\s+session_version\s+FROM\s+users\s+WHERE\s+id\s*=\s*\?/i.test(s)) {
    return [{ session_version: userState.session_version }];
  }
  if (/SELECT\s+password_hash\s+FROM\s+users\s+WHERE\s+id\s*=\s*\?/i.test(s)) {
    return [{ password_hash: userState.password_hash }];
  }
  if (/SELECT\s+id,\s*full_name,\s*email,\s*phone,\s*role,\s*session_version\s+FROM\s+users/i.test(s)) {
    return [userState];
  }
  if (/FROM\s+users/i.test(s)) {
    return [userState];
  }
  return [];
};

function reqWithCookie(cookie, method = 'GET', url = 'https://embun.test/api/me', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = `session_token=${cookie}`;
  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

// 1. Sesi cocok dengan DB -> Diterima
{
  const validated = await getUserFromSession(reqWithCookie(token1), ENV);
  check('sesi versi cocok (1 == 1) -> DITERIMA', validated !== null && validated.id === 101);
}

// 2. Token dicabut karena session_version DB berubah
{
  userState.session_version = 2; // Simulasi kenaikan versi di DB
  const validated = await getUserFromSession(reqWithCookie(token1), ENV);
  check('sesi versi tidak cocok (token=1, DB=2) -> DITOLAK (null)', validated === null);
  userState.session_version = 1; // Kembalikan
}

// ---------------------------------------------------------------------------
// Bagian 4 — Alur Logout: Membatalkan Sesi di DB & Klien
// ---------------------------------------------------------------------------
console.log('\n# Bagian 4 — Alur Logout: Membatalkan Sesi di DB & Klien');

{
  userState.session_version = 1;
  const activeToken = await createSessionToken({ ...userState }, ENV);

  // Verifikasi token aktif sebelum logout
  const preLogoutUser = await getUserFromSession(reqWithCookie(activeToken), ENV);
  check('sebelum logout: token aktif sah', preLogoutUser !== null);

  // Jalankan logout
  const logoutRes = await logoutHandler({
    request: reqWithCookie(activeToken, 'POST', 'https://embun.test/api/auth/logout'),
    env: ENV
  });

  check('logout HTTP status 200', logoutRes.status === 200);
  const setCookie = logoutRes.headers.get('Set-Cookie') || '';
  check('logout mengosongkan cookie klien (Max-Age=0)', /session_token=;.*Max-Age=0/i.test(setCookie));
  check('logout menaikkan session_version di DB menjadi 2', userState.session_version === 2, `DB version=${userState.session_version}`);

  // Buktikan token lama tidak berlaku lagi setelah logout
  const postLogoutUser = await getUserFromSession(reqWithCookie(activeToken), ENV);
  check('setelah logout: token lama DITOLAK oleh getUserFromSession (revoked)', postLogoutUser === null);
}

// ---------------------------------------------------------------------------
// Bagian 5 — Alur Ganti Sandi: Membatalkan Sesi Lama di Perangkat Lain
// ---------------------------------------------------------------------------
console.log('\n# Bagian 5 — Alur Ganti Sandi: Membatalkan Sesi Lama di Perangkat Lain');

{
  // Pengguna login di Perangkat A dan Perangkat B
  userState.session_version = 1;
  const tokenDeviceA = await createSessionToken({ ...userState }, ENV);
  const tokenDeviceB = await createSessionToken({ ...userState }, ENV);

  check('sebelum ganti sandi: token perangkat A sah', (await getUserFromSession(reqWithCookie(tokenDeviceA), ENV)) !== null);
  check('sebelum ganti sandi: token perangkat B sah', (await getUserFromSession(reqWithCookie(tokenDeviceB), ENV)) !== null);

  // Perangkat A mengganti kata sandi
  const changeRes = await profileHandler({
    request: reqWithCookie(tokenDeviceA, 'POST', 'https://embun.test/api/profile', {
      action: 'change_password',
      old_password: 'SandiLama123!',
      new_password: 'SandiBaru2026!Kuat',
      repeat_password: 'SandiBaru2026!Kuat'
    }),
    env: ENV
  });

  check('ganti sandi HTTP status 200', changeRes.status === 200);
  check('ganti sandi menaikkan session_version di DB menjadi 2', userState.session_version === 2, `DB version=${userState.session_version}`);

  // Token lama di perangkat B (dan token lama perangkat A) harus otomatis tercabut
  const devBAfter = await getUserFromSession(reqWithCookie(tokenDeviceB), ENV);
  check('setelah ganti sandi: token perangkat B otomatis TERCABUT (null)', devBAfter === null);

  const devAOldAfter = await getUserFromSession(reqWithCookie(tokenDeviceA), ENV);
  check('setelah ganti sandi: token lama perangkat A otomatis TERCABUT (null)', devAOldAfter === null);

  // Tangkap cookie baru dari respons ganti sandi untuk perangkat A
  const newCookieHeader = changeRes.headers.get('Set-Cookie') || '';
  check('ganti sandi menyetel cookie sesi baru untuk perangkat pemanggil', newCookieHeader.includes('session_token='));

  const match = newCookieHeader.match(/session_token=([^;]+)/);
  const newDeviceAToken = match ? match[1] : null;
  check('token baru perangkat A sah dan aktif', (await getUserFromSession(reqWithCookie(newDeviceAToken), ENV)) !== null);
}

// ---------------------------------------------------------------------------
// Bagian 6 — Endpoint Refresh Token: POST /api/auth/refresh
// ---------------------------------------------------------------------------
console.log('\n# Bagian 6 — Endpoint Refresh Token: POST /api/auth/refresh');

{
  userState.session_version = 1;
  const validToken = await createSessionToken({ ...userState }, ENV);

  // 1. Refresh dengan token sah -> 200
  const refRes = await refreshHandler({
    request: reqWithCookie(validToken, 'POST', 'https://embun.test/api/auth/refresh'),
    env: ENV
  });
  check('refresh dengan sesi sah -> status 200', refRes.status === 200);
  const refData = await refRes.json();
  check('refresh mengembalikan token baru', typeof refData.token === 'string' && refData.ok === true);
  check('token hasil refresh lolos getUserFromSession', (await getUserFromSession(reqWithCookie(refData.token), ENV)) !== null);

  // 2. Refresh tanpa sesi -> 401
  const noAuthRes = await refreshHandler({
    request: reqWithCookie(null, 'POST', 'https://embun.test/api/auth/refresh'),
    env: ENV
  });
  check('refresh tanpa sesi -> 401 Unauthorized', noAuthRes.status === 401);

  // 3. Refresh dengan token yang sudah dicabut -> 401
  userState.session_version = 99; // Cabut sesi
  const revokedRefRes = await refreshHandler({
    request: reqWithCookie(validToken, 'POST', 'https://embun.test/api/auth/refresh'),
    env: ENV
  });
  check('refresh dengan token tercabut -> 401 Unauthorized', revokedRefRes.status === 401);
}

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
