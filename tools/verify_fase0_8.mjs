// Harness verifikasi Fase 0.8 — Pencabutan Fallback Plaintext & SHA-256 Tanpa Salt (K6)
//
// Memastikan functions/_password.js menolak autentikasi berbasis plaintext dan
// SHA-256 tanpa salt (insecure fallback), serta hanya menerima format aman (PBKDF2).
//
// Jalankan: node tools/verify_fase0_8_run.mjs

import fs from 'node:fs';
import path from 'node:path';
import { verifyPassword, hashPassword } from '../functions/_password.js';
import { onRequestPost as loginHandler } from '../functions/api/auth/login.js';
import { webcrypto } from 'node:crypto';
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

// ---------------------------------------------------------------------------
// Bagian 1 — Audit Kode Statik functions/_password.js
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit Kode Statik functions/_password.js');

const pwdCode = fs.readFileSync(path.join(ROOT, 'functions', '_password.js'), 'utf8');

check(
  '_password.js TIDAK memuat fallback plaintext (password === stored)',
  !/if\s*\(\s*password\s*===\s*stored\s*\)\s*return\s+true/i.test(pwdCode),
  'Fallback plaintext masih ditemukan di _password.js'
);

check(
  '_password.js TIDAK memuat fallback sha256 tanpa salt',
  !/sha256Hex\s*\(\s*String\s*\(\s*password\s*\)\s*\)\s*===\s*stored/i.test(pwdCode),
  'Fallback sha256 tanpa salt masih ditemukan di _password.js'
);

check(
  '_password.js memverifikasi format pbkdf2-sha256',
  /isPbkdf2Hash\s*\(stored\)/.test(pwdCode)
);

// ---------------------------------------------------------------------------
// Bagian 2 — Uji Runtime verifyPassword()
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Uji Runtime verifyPassword()');

async function sha256hex(s) {
  const b = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

const plainPassword = 'PasswordKuat2026!';
const pbkdf2Hash = await hashPassword(plainPassword);
const unsaltedSha256 = await sha256hex(plainPassword);

// 1. Format PBKDF2 sah
check(
  'PBKDF2 dengan sandi benar -> DITERIMA (true)',
  (await verifyPassword(plainPassword, pbkdf2Hash)) === true
);

check(
  'PBKDF2 dengan sandi salah -> DITOLAK (false)',
  (await verifyPassword('PasswordSalah123', pbkdf2Hash)) === false
);

// 2. Format Plaintext (K6)
check(
  'Hash plaintext yang sama persis dengan sandi -> DITOLAK (false)',
  (await verifyPassword(plainPassword, plainPassword)) === false
);

check(
  'Hash plaintext "admin123" -> DITOLAK (false)',
  (await verifyPassword('admin123', 'admin123')) === false
);

check(
  'Hash debug plaintext "testhash" -> DITOLAK (false)',
  (await verifyPassword('testhash', 'testhash')) === false
);

// 3. Format SHA-256 Tanpa Salt (K6)
check(
  'Hash SHA-256 TANPA salt -> DITOLAK (false)',
  (await verifyPassword(plainPassword, unsaltedSha256)) === false
);

// 4. Robustness: Nilai rusak/kosong tidak menyebabkan uncaught exception
check('Sandi kosong vs hash -> false', (await verifyPassword('', pbkdf2Hash)) === false);
check('Hash null -> false', (await verifyPassword(plainPassword, null)) === false);
check('Hash undefined -> false', (await verifyPassword(plainPassword, undefined)) === false);
check('Hash rusak acak -> false', (await verifyPassword(plainPassword, 'bukan_hash')) === false);

// ---------------------------------------------------------------------------
// Bagian 3 — Uji Integrasi Endpoint Login (/api/auth/login)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 3 — Uji Integrasi Endpoint Login');

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret-k6' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

async function testLoginAttempt(storedHash, passwordInput) {
  resetMockCalls();
  globalThis.__MOCK_ROWS = [{
    id: 40001,
    full_name: 'Akun Uji',
    email: 'uji@example.com',
    password_hash: storedHash,
    role: 'Customer'
  }];

  const req = new Request(BASE + '/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '10.88.' + Math.floor(Math.random() * 200) + '.' + Math.floor(Math.random() * 200)
    },
    body: JSON.stringify({ identity: 'uji@example.com', password: passwordInput })
  });

  const res = await loginHandler({ request: req, env: ENV, ctx: {} });
  return res.status;
}

// Akun dengan hash plaintext di basis data ditolak login
const statusPlaintextLogin = await testLoginAttempt('admin123', 'admin123');
check('Login akun dengan hash plaintext di DB -> DITOLAK 401', statusPlaintextLogin === 401);

// Akun dengan hash sha256 tanpa salt di basis data ditolak login
const statusSha256Login = await testLoginAttempt(unsaltedSha256, plainPassword);
check('Login akun dengan hash SHA-256 tanpa salt di DB -> DITOLAK 401', statusSha256Login === 401);

// Akun dengan hash PBKDF2 sah berhasil login
const statusPbkdf2Login = await testLoginAttempt(pbkdf2Hash, plainPassword);
check('Login akun dengan hash PBKDF2 sah di DB -> DITERIMA 200', statusPbkdf2Login === 200);

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL FASE 0.8: HIJAU ${pass}, MERAH ${fail} (${pass}/${pass + fail})`);
if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
