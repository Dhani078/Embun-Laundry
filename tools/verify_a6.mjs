// Harness verifikasi A6 — Secret dihapus dari wrangler.toml, dipindahkan ke
// secret store / .dev.vars, dan rotasi JWT_SECRET membatalkan sesi lama.
//
// ===========================================================================
// Kenapa ini wajib diverifikasi
// ===========================================================================
// 1. `wrangler.toml` sebelumnya memuat `TIDB_DATABASE_URL` (termasuk user & password
//    root TiDB) dan `JWT_SECRET` dalam bentuk plaintext di repositori publik.
// 2. Hal ini memungkinkan siapa pun membuat token admin dan mengakses TiDB langsung.
// 3. Perbaikan mengharuskan:
//    - `wrangler.toml` TIDAK LAGI memuat variabel rahasia ini di `[vars]`.
//    - `.gitignore` menyaring `.dev.vars*`, `.env*`, dan file dump DB sensitif.
//    - `.dev.vars.example` tersedia sebagai template tanpa secret riil.
//    - Token yang ditandatangani dengan secret lama yang bocor HARUS DITOLAK
//      setelah rotasi (seluruh sesi lama di-revoke).
//
// Jalankan: node tools/verify_a6_run.mjs

import fs from 'node:fs';
import path from 'node:path';
import { getUserFromSession, createSessionToken } from '../functions/_db.js';
import { onRequestGet as meHandler } from '../functions/api/me.js';

const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';
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

// Helper untuk token signing mandiri
const enc = new TextEncoder();
const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function forgeToken(payloadObj, secret) {
  const payload = b64url(enc.encode(JSON.stringify(payloadObj)));
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

// ---------------------------------------------------------------------------
// Bagian 1 — Audit wrangler.toml
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit wrangler.toml');
const wranglerPath = path.join(ROOT, 'wrangler.toml');
const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');

check(
  'wrangler.toml TIDAK memuat TIDB_DATABASE_URL',
  !/TIDB_DATABASE_URL\s*=/i.test(wranglerContent),
  'TIDB_DATABASE_URL masih ditemukan di wrangler.toml'
);

check(
  'wrangler.toml TIDAK memuat JWT_SECRET',
  !/JWT_SECRET\s*=/i.test(wranglerContent),
  'JWT_SECRET masih ditemukan di wrangler.toml'
);

check(
  'wrangler.toml TIDAK memuat kredensial gateway TiDB / connection string MySQL',
  !/mysql:\/\/.*@gateway.*tidbcloud/i.test(wranglerContent),
  'URL koneksi TiDB bocor di wrangler.toml'
);

check(
  'wrangler.toml tetap mempertahankan konfigurasi non-secret yang sah (TIDB_DATABASE)',
  /TIDB_DATABASE\s*=\s*"embun_laundry"/i.test(wranglerContent),
  'TIDB_DATABASE hilang dari wrangler.toml'
);

// ---------------------------------------------------------------------------
// Bagian 2 — Audit .gitignore dan .dev.vars.example
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Audit .gitignore dan .dev.vars.example');
const gitignorePath = path.join(ROOT, '.gitignore');
const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');

check(
  '.gitignore memuat .dev.vars',
  /\.dev\.vars/i.test(gitignoreContent),
  '.dev.vars belum terdaftar di .gitignore'
);

check(
  '.gitignore memuat .env',
  /\.env/i.test(gitignoreContent),
  '.env belum terdaftar di .gitignore'
);

check(
  '.gitignore memuat dump sql sensitif (embun_laundry.sql)',
  /embun_laundry\.sql/i.test(gitignoreContent),
  'embun_laundry.sql belum disaring di .gitignore'
);

const devVarsExamplePath = path.join(ROOT, '.dev.vars.example');
check(
  '.dev.vars.example ada di repository',
  fs.existsSync(devVarsExamplePath),
  '.dev.vars.example tidak ditemukan'
);

if (fs.existsSync(devVarsExamplePath)) {
  const exampleContent = fs.readFileSync(devVarsExamplePath, 'utf8');
  check(
    '.dev.vars.example TIDAK memuat password riil atau secret riil',
    !/ugNFt1lVM749mRHd/i.test(exampleContent) && !/dhani-laundry-secure-jwt-secret-key-2026/i.test(exampleContent),
    'Secret riil bocor di .dev.vars.example'
  );
  check(
    '.dev.vars.example memuat template TIDB_DATABASE_URL dan JWT_SECRET',
    /TIDB_DATABASE_URL\s*=/i.test(exampleContent) && /JWT_SECRET\s*=/i.test(exampleContent),
    'Template variabel wajib tidak lengkap di .dev.vars.example'
  );
}

// ---------------------------------------------------------------------------
// Bagian 3 — Runtime: Pembatalan Token Lama & Fail-Closed
// ---------------------------------------------------------------------------
console.log('\n# Bagian 3 — Runtime: Pembatalan Token Lama & Fail-Closed');

const LEAKED_SECRET = 'dhani-laundry-secure-jwt-secret-key-2026';
const NEW_ROTATED_SECRET = 'c9a83f120e7d4a25b188c03e479aef1051b8c2d9e6f3148a07c4b69d12345678';

// Buat token palsu menggunakan kunci lama yang bocor
const oldAdminToken = await forgeToken(
  { id: 1, user_id: 1, user_name: 'Admin Bocor', user_role: 'Admin', exp: Math.floor(Date.now() / 1000) + 3600 },
  LEAKED_SECRET
);

// Skenario 1: env tidak memiliki JWT_SECRET (misal lupa diset di secret store) -> FAIL-CLOSED
const envEmpty = { TIDB_DATABASE: 'embun_laundry' };
const sessionEmpty = await getUserFromSession(
  new Request(`${BASE}/api/me`, { headers: { Cookie: `session_token=${oldAdminToken}` } }),
  envEmpty
);
check('tanpa JWT_SECRET: getUserFromSession mengembalikan null (fail-closed)', sessionEmpty === null);

let tokenCreationThrew = false;
try {
  await createSessionToken({ id: 1, name: 'Test' }, envEmpty);
} catch (e) {
  tokenCreationThrew = true;
}
check('tanpa JWT_SECRET: createSessionToken melempar error (fail-closed)', tokenCreationThrew);

// Skenario 2: env menggunakan secret baru setelah rotasi
const envRotated = { JWT_SECRET: NEW_ROTATED_SECRET, TIDB_DATABASE: 'embun_laundry' };

const sessionOldToken = await getUserFromSession(
  new Request(`${BASE}/api/me`, { headers: { Cookie: `session_token=${oldAdminToken}` } }),
  envRotated
);
check(
  'rotasi secret: token yang dibuat dengan secret lama DITOLAK oleh server',
  sessionOldToken === null
);

// Skenario 3: token sah yang dibuat dengan secret baru DITERIMA
const validNewToken = await createSessionToken(
  { id: 99, name: 'New User', role: 'Staff', email: 'staff@embun.id' },
  envRotated
);

const sessionNewToken = await getUserFromSession(
  new Request(`${BASE}/api/me`, { headers: { Cookie: `session_token=${validNewToken}` } }),
  envRotated
);
check(
  'rotasi secret: token sah dengan secret baru DITERIMA kembali',
  sessionNewToken !== null && sessionNewToken.id === 99 && sessionNewToken.user_role === 'Staff'
);

// ---------------------------------------------------------------------------
// Bagian 4 — End-to-End via Handler /api/me
// ---------------------------------------------------------------------------
console.log('\n# Bagian 4 — End-to-End via Handler /api/me');

const resOld = await meHandler({
  request: new Request(`${BASE}/api/me`, { headers: { Cookie: `session_token=${oldAdminToken}` } }),
  env: envRotated
});
check(
  '/api/me menolak token dari secret lama dengan HTTP 401',
  resOld.status === 401
);

const resNew = await meHandler({
  request: new Request(`${BASE}/api/me`, { headers: { Cookie: `session_token=${validNewToken}` } }),
  env: envRotated
});
check(
  '/api/me menerima token sah dengan HTTP 200',
  resNew.status === 200
);

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL A6: HIJAU ${pass}, MERAH ${fail} (${pass}/${pass + fail})`);
if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
