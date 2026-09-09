// Harness B8 — lihat tools/verify_b8_run.mjs (pembungkus loader).
//
// Driver DB diganti mock pencatat SQL (sama seperti B2/B7) supaya kita bisa
// membuktikan bahwa lazy upgrade BENAR-BENAR mengirim UPDATE ke DB, bukan
// cuma "seharusnya".

import { hashPassword, verifyPassword, isPbkdf2Hash } from '../functions/_password.js';
import { onRequestPost as login } from '../functions/api/auth/login.js';
import { onRequest as profile } from '../functions/api/profile.js';
import { createSessionToken } from '../functions/_db.js';
import { __calls } from './mock_tidb.mjs';
import { webcrypto } from 'node:crypto';
import bcrypt from 'bcryptjs';

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret' };
const BASE = 'https://example.test';

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'HIJAU' : 'MERAH'}  ${name}${detail ? '  — ' + detail : ''}`);
}

// --- 1. Format & salt acak -------------------------------------------------

const h1 = await hashPassword('admin123');
const h2 = await hashPassword('admin123');

check('format baru: pbkdf2-sha256$iter$salt$hash', /^pbkdf2-sha256\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(h1), h1.slice(0, 40) + '…');
check('panjang hash <= 255 (kolom produksi VARCHAR(255))', h1.length <= 255, `${h1.length} char`);
check('salt ACAK: 2 hash untuk sandi sama TIDAK identik', h1 !== h2);
check('iterasi tersemat & terbaca', parseInt(h1.split('$')[1], 10) === 10000, h1.split('$')[1]);
check('isPbkdf2Hash() mengenali format baru', isPbkdf2Hash(h1));
check('isPbkdf2Hash() menolak hash lawas', !isPbkdf2Hash('0a1233d67b1b6a30485dea3e44f6da596a9aaef51f31a4ad08b5591c72fcef31'));

check('verifikasi sandi benar → true', await verifyPassword('admin123', h1));
check('verifikasi sandi salah → false', !(await verifyPassword('admin1234', h1)));
check('verifikasi sandi kosong vs hash → false', !(await verifyPassword('', h1)));

// --- 2. Format lawas yang HIDUP di produksi --------------------------------

// Nilai ini diambil LANGSUNG dari TiDB produksi (tools/probe_schema.mjs):
// stored admin@gmail.com == sha256('admin123' + 'dhani-salt').
const REAL_LEGACY = '0a1233d67b1b6a30485dea3e44f6da596a9aaef51f31a4ad08b5591c72fcef31';
check('hash lawas SHA-256+salt global masih bisa login', await verifyPassword('admin123', REAL_LEGACY));
check('hash lawas + sandi salah → false', !(await verifyPassword('wrong', REAL_LEGACY)));

async function sha256hex(s) {
  const b = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const legacyNoSalt = await sha256hex('secretpw');
check('hash lawas SHA-256 TANPA salt masih bisa login', await verifyPassword('secretpw', legacyNoSalt));
check('baris debug plaintext masih bisa login', await verifyPassword('testhash', 'testhash'));

const bcryptHash = await bcrypt.hash('admin123', 4);
check('hash bcrypt ($2a$) masih bisa login', await verifyPassword('admin123', bcryptHash));
check('hash bcrypt + sandi salah → false', !(await verifyPassword('nope', bcryptHash)));

check('hash kosong → false (tidak crash)', !(await verifyPassword('x', '')));
check('hash rusak → false (tidak crash)', !(await verifyPassword('x', 'pbkdf2-sha256$abc$!!!$???')));
check('iterasi di luar batas ditolak', !(await verifyPassword('x', 'pbkdf2-sha256$1$AAAA$BBBB')));

// --- 3. Lazy upgrade: login lawas HARUS menulis hash baru ------------------

async function doLogin(password, storedHash) {
  globalThis.__MOCK_ROWS = [{
    id: 30001, full_name: 'admin', email: 'admin@gmail.com',
    phone: '08324324', password_hash: storedHash, role: 'Admin'
  }];
  __calls.length = 0;
  const waited = [];
  const res = await login({
    request: new Request(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.9.0.' + Math.floor(Math.random() * 250) },
      body: JSON.stringify({ identity: 'admin@gmail.com', password })
    }),
    env: ENV,
    ctx: { waitUntil: p => waited.push(p) }
  });
  await Promise.allSettled(waited);
  globalThis.__MOCK_ROWS = null;
  let json = null;
  try { json = await res.json(); } catch { /* bukan JSON */ }
  return { status: res.status, json, sql: [...__calls] };
}

{
  const r = await doLogin('admin123', REAL_LEGACY);
  check('login dengan hash LAWAS → 200 ok:true', r.status === 200 && r.json?.ok === true, JSON.stringify(r.json?.msg || ''));
  const upd = r.sql.find(c => /UPDATE\s+users\s+SET\s+password_hash/i.test(c.sql));
  check('lazy upgrade mengirim UPDATE password_hash', !!upd, upd ? upd.sql.trim() : 'TIDAK ADA UPDATE');
  check('nilai yang ditulis berformat PBKDF2', !!upd && isPbkdf2Hash(String(upd.params?.[0])));
  check('UPDATE menyasar id pengguna yang login', !!upd && String(upd.params?.[1]) === '30001');
  check('UPDATE ter-parameterisasi (B7 tidak regressi)', !!upd && /password_hash = \?/i.test(upd.sql) && /id = \?/i.test(upd.sql));
  const newHash = isPbkdf2Hash(String(upd?.params?.[0])) ? String(upd.params[0]) : null;
  check('hash hasil upgrade bisa diverifikasi', newHash ? await verifyPassword('admin123', newHash) : false);
}

{
  // Hash SUDAH PBKDF2 → tidak boleh ada UPDATE (hindari menulis ulang
  // terus-menerus pada setiap login).
  const r = await doLogin('admin123', h1);
  check('login dengan hash PBKDF2 → 200 ok:true', r.status === 200 && r.json?.ok === true);
  const upd = r.sql.find(c => /UPDATE\s+users\s+SET\s+password_hash/i.test(c.sql));
  check('hash sudah PBKDF2 → TIDAK ada UPDATE ulang', !upd);
}

{
  const r = await doLogin('salah-banget', REAL_LEGACY);
  check('sandi salah → 401 (bukan 200)', r.status === 401);
  const upd = r.sql.find(c => /UPDATE\s+users\s+SET\s+password_hash/i.test(c.sql));
  check('sandi salah → TIDAK ada UPDATE', !upd);
}

// --- 4. change_password ikut PBKDF2 ---------------------------------------

async function changePass(storedHash, oldPass, newPass, repeat) {
  const token = await createSessionToken({ id: 30001, full_name: 'admin', email: 'admin@gmail.com', role: 'Admin' }, ENV);
  globalThis.__MOCK_ROWS = [{ password_hash: storedHash }];
  __calls.length = 0;
  const res = await profile({
    request: new Request(BASE + '/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `session_token=${token}` },
      body: JSON.stringify({ action: 'change_password', old_password: oldPass, new_password: newPass, repeat_password: repeat ?? newPass })
    }),
    env: ENV
  });
  globalThis.__MOCK_ROWS = null;
  let json = null;
  try { json = await res.json(); } catch { /* bukan JSON */ }
  return { status: res.status, json, sql: [...__calls] };
}

{
  const r = await changePass(REAL_LEGACY, 'admin123', 'NewPass2026!');
  check('ganti sandi dari hash lawas → 200', r.status === 200 && r.json?.ok === true, JSON.stringify(r.json?.msg || ''));
  const upd = r.sql.find(c => /UPDATE\s+users\s+SET\s+password_hash/i.test(c.sql));
  check('ganti sandi menulis hash PBKDF2', !!upd && isPbkdf2Hash(String(upd.params?.[0])));
}

{
  const r = await changePass(REAL_LEGACY, 'salah', 'NewPass2026!');
  check('ganti sandi, sandi lama salah → 400', r.status === 400, JSON.stringify(r.json?.msg || ''));
}

{
  const r = await changePass(REAL_LEGACY, 'admin123', 'x');
  check('ganti sandi, sandi baru 1 char → 400 (defek lama)', r.status === 400, JSON.stringify(r.json?.msg || ''));
}

{
  const r = await changePass(REAL_LEGACY, 'admin123', 'NewPass2026!', 'beda');
  check('ganti sandi, konfirmasi beda → 400', r.status === 400);
}

// --- 5. Biaya CPU ----------------------------------------------------------

{
  const t0 = performance.now();
  await hashPassword('SomePass123');
  const one = performance.now() - t0;
  // change_password memanggil hash 2× (sandi lama + baru).
  check('1 hash < 10 ms (batas CPU Workers gratis)', one < 10, `${one.toFixed(2)} ms`);
  check('2 hash (ganti sandi) < 10 ms', one * 2 < 10, `${(one * 2).toFixed(2)} ms`);
}

console.log(`\nHASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} — ${pass} lulus, ${fail} gagal`);
process.exit(fail === 0 ? 0 : 1);
