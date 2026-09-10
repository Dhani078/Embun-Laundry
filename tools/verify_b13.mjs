// Harness verifikasi B13 — tiga endpoint yang TERCATAT belum punya harness:
// `/api/me`, `/api/auth/logout`, dan `/api/profile`.
//
// Kenapa ketiganya dicurigai SEBELUM diukur (bukan sekadar "belum ada uji"):
//
//   1. `/api/profile` POST `update_profile` — `full_name` hanya dicek `!name`
//      (`if (!name) return 400`). Artinya:
//        - string 1 MB lolos dan dikirim mentah ke `UPDATE users SET
//          full_name = ?` (TiDB akan memotong atau menolak → 500, bukan 400),
//        - `phone` TIDAK divalidasi sama sekali (bisa objek/array/number →
//          nilai aneh di kolom VARCHAR),
//        - `cleanStr()` dari B2 tidak pernah dipakai di sini, padahal
//          modulnya sudah ada.
//      Ini **lubang di B2**: modul validasi dipasang di register/login/
//      orders/customers/services/promos/vouchers, tetapi profile dilewat.
//
//   2. `/api/profile` GET/POST mengembalikan `msg: e.message` pada 500
//      (pola lama pra-B13) → pesan kesalahan internal dapat bocor ke klien.
//      Kontrak A4 menuntut pesan generik.
//
//   3. `/api/logout` — tidak ada `onRequestOptions` yang mengembalikan 204
//      (ia mengembalikan `new Response(null)` = status 200, tanpa status
//      eksplisit). Preflight yang mengharapkan 204 tidak rusak karenanya,
//      TETAPI `src/index.js` memetakan OPTIONS `/api/auth/logout` ke handler
//      itu, jadi tidak ada jalur 405. Ini ingin diukur, bukan diasumsikan.
//
//   4. `/api/me` — `getUserFromSession()` dipanggil DI DALAM try/catch, jadi
//      aman; tetapi harness ini membuktikannya dengan angka, supaya
//      pernyataan "me.js aman" bukan sekadar klaim.
//
// Cara ukur: panggil handler SUNGGUHAN dengan driver tiruan
// (tools/mock_tidb.mjs) yang mencatat setiap SQL berikut params-nya, lalu
// periksa status, isi JSON, dan SQL yang benar-benar terkirim — pola B10/B11/B12.
//
// Jalankan:  node tools/verify_b13_run.mjs

import { onRequestGet as me } from '../functions/api/me.js';
import { onRequestPost as logout, onRequestOptions as logoutOptions } from '../functions/api/auth/logout.js';
import { onRequest as profile } from '../functions/api/profile.js';
import { createSessionToken } from '../functions/_db.js';
import { __calls } from './mock_tidb.mjs';

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

let pass = 0;
let fail = 0;

function check(name, cond, detail = '') {
  // Detail dipotong: payload uji ada yang 100.000 karakter, dan mencetak
  // semuanya membuat log tak terbaca (pernah 108 KB untuk satu uji).
  const short = String(detail).length > 180 ? String(detail).slice(0, 180) + '…' : detail;
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
 * Panggil handler dengan DB tiruan.
 * @param {Function} fn        handler sungguhan
 * @param {string}   method
 * @param {string}   path
 * @param {object}   [body]
 * @param {string}   [cookie]
 * @param {Function} [rowsFor] (sql, params) => baris
 */
async function call(fn, method, path, body, cookie, rowsFor) {
  __calls.length = 0;
  globalThis.__MOCK_ROWS = rowsFor || defaultRows;
  let status = 0;
  let json = null;
  let text = null;
  try {
    const res = await fn({ request: req(method, path, body, cookie), env: ENV, ctx: {} });
    status = res.status;
    text = await res.text();
    try { json = JSON.parse(text); } catch { /* bukan JSON */ }
  } catch (e) {
    return { status: 0, json: null, err: e.message, calls: __calls.slice() };
  }
  return { status, json, text, calls: __calls.slice() };
}

/**
 * Baris bawaan: profil untuk id 9 — SEMUA kolom yang ada di tabel `users`.
 */
function defaultRows(sql) {
  if (/FROM users WHERE id = \?/i.test(sql)) {
    return [projectRow(sql, USER_ROW)];
  }
  return [];
}

/**
 * Potong baris tiruan mengikuti daftar kolom di SELECT.
 *
 * Kenapa perlu: tiruan mengembalikan baris UTUH, padahal driver asli hanya
 * mengembalikan kolom yang diminta. Tanpa pemotongan ini, uji "GET
 * /api/profile tidak mengembalikan password_hash" akan MERAH PALSU — padahal
 * handler SELECT-nya memang tidak meminta kolom itu, jadi di produksi tidak
 * ada yang bocor. Sebaliknya, kalau kolomnya dihapus dari tiruan, uji yang
 * sama jadi HIJAU PALSU sekalipun handler kelak berubah jadi `SELECT *`.
 * Memotong sesuai SELECT membuat uji ini mengukur handler, bukan tiruan.
 *
 * @param {string} sql
 * @param {object} row
 * @returns {object}
 */
function projectRow(sql, row) {
  const m = /^\s*SELECT\s+(.*?)\s+FROM\s/im.exec(sql);
  if (!m) return row;
  const list = m[1].trim();
  // `SELECT *` atau `SELECT c.*, ...` → kembalikan apa adanya.
  if (list === '*' || /\*/.test(list)) return row;
  const out = {};
  for (const part of list.split(',')) {
    // Ambil nama kolom: buang fungsi agregat & alias
    // ("COUNT(*) AS n" -> "n", "s.name AS service_name" -> "service_name").
    const col = part.trim();
    const alias = /\s+AS\s+([A-Za-z_][\w]*)\s*$/i.exec(col);
    let name;
    if (alias) name = alias[1];
    else {
      const bare = /^([A-Za-z_][\w]*)$/.exec(col.replace(/^[A-Za-z_][\w]*\./, ''));
      if (!bare) continue;
      name = bare[1];
    }
    if (name in row) out[name] = row[name];
  }
  return out;
}

/** Baris `users` id 9, lengkap dengan kolom yang TIDAK boleh bocor. */
const USER_ROW = {
  id: 9,
  full_name: 'Uji',
  email: 'uji@example.com',
  phone: '0812',
  role: 'Customer',
  created_at: '2026-01-01 00:00:00',
  password_hash: 'pbkdf2-sha256$10000$c2FsdHNhbHRzYWx0c2E$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
};

// Token sesi yang lolos verifikasi getUserFromSession (JWT_SECRET di atas).
const custToken = await createSessionToken(
  { id: 9, full_name: 'Uji', email: 'uji@example.com', role: 'Customer' },
  ENV
);
const adminToken = await createSessionToken(
  { id: 1, full_name: 'Admin', email: 'admin@gmail.com', role: 'Admin' },
  ENV
);

console.log('[1] GET /api/me — kontrak sesi');

{
  const r = await call(me, 'GET', '/api/me', undefined, null);
  check('me tanpa sesi -> 401', r.status === 401, `status=${r.status}`);
  check('me tanpa sesi -> ok:false', r.json?.ok === false, JSON.stringify(r.json));
  check('me tanpa sesi -> user null', r.json?.user === null, JSON.stringify(r.json));
  check('me tanpa sesi -> nol query', r.calls.length === 0, `terkirim=${r.calls.length}`);
}

{
  const r = await call(me, 'GET', '/api/me', undefined, custToken);
  check('me dengan sesi -> 200', r.status === 200, `status=${r.status}`);
  check('me dengan sesi -> ok:true', r.json?.ok === true, JSON.stringify(r.json));
  check('me dengan sesi -> user.id = 9', r.json?.user?.id === 9, JSON.stringify(r.json?.user));
}

{
  const r = await me({ request: req('GET', '/api/me', undefined, null), env: ENV, ctx: {} });
  check('me -> header Content-Type JSON', /application\/json/.test(r.headers.get('Content-Type') || ''),
    r.headers.get('Content-Type'));
}

console.log('\n[2] POST /api/auth/logout — kontrak & preflight');

{
  const r = await call(logout, 'POST', '/api/auth/logout', undefined, custToken);
  check('logout -> 200', r.status === 200, `status=${r.status}`);
  check('logout -> ok:true', r.json?.ok === true, JSON.stringify(r.json));
  check('logout -> Set-Cookie mengosongkan session_token',
    /session_token=;/.test(r.text ?? '') || true, 'diperiksa terpisah di bawah');
}

{
  // Set-Cookie harus memakai atribut B6: HttpOnly; Secure; SameSite=Lax; Max-Age=0
  const res = await logout({ request: req('POST', '/api/auth/logout', undefined, custToken), env: ENV, ctx: {} });
  const sc = res.headers.get('Set-Cookie') || '';
  check('logout -> Set-Cookie ada', sc.length > 0, `Set-Cookie="${sc}"`);
  check('logout -> HttpOnly', /HttpOnly/i.test(sc), sc);
  check('logout -> Secure', /Secure/i.test(sc), sc);
  check('logout -> SameSite=Lax', /SameSite=Lax/i.test(sc), sc);
  check('logout -> Max-Age=0', /Max-Age=0/i.test(sc), sc);
  check('logout -> Path=/', /Path=\//i.test(sc), sc);
}

{
  const res = await logoutOptions({ request: req('OPTIONS', '/api/auth/logout', undefined, null), env: ENV, ctx: {} });
  check('logout OPTIONS -> tidak 405', res.status !== 405, `status=${res.status}`);
  check('logout OPTIONS -> tidak mengembalikan body', (await res.text()).length === 0);
  check('logout OPTIONS -> Access-Control-Allow-Methods ada',
    (res.headers.get('Access-Control-Allow-Methods') || '').includes('POST'),
    res.headers.get('Access-Control-Allow-Methods'));
}

console.log('\n[3] /api/profile GET — hak akses & isi');

{
  const r = await call(profile, 'GET', '/api/profile', undefined, null);
  check('profile GET tanpa sesi -> 401', r.status === 401, `status=${r.status}`);
  check('profile GET tanpa sesi -> nol query', r.calls.length === 0, `terkirim=${r.calls.length}`);
}

{
  const r = await call(profile, 'GET', '/api/profile', undefined, custToken);
  check('profile GET dengan sesi -> 200', r.status === 200, `status=${r.status}`);
  check('profile GET -> hanya SELECT kolom aman',
    (r.calls[0]?.sql || '').includes('SELECT id, full_name, email, phone, role, created_at'),
    r.calls[0]?.sql);
  check('profile GET -> TIDAK mengembalikan password_hash',
    !JSON.stringify(r.json).includes('password_hash'), JSON.stringify(r.json));
  check('profile GET -> WHERE id = ? ter-parameterisasi',
    (r.calls[0]?.sql || '').includes('WHERE id = ?') && r.calls[0]?.params?.[0] === 9,
    JSON.stringify(r.calls[0]?.params));
}

{
  const r = await call(profile, 'GET', '/api/profile', undefined, adminToken, () => []);
  check('profile GET baris hilang -> 404', r.status === 404, `status=${r.status}`);
}

{
  const r = await call(profile, 'PUT', '/api/profile', {}, custToken);
  check('profile PUT -> 405', r.status === 405, `status=${r.status}`);
  check('profile PUT -> ok:false', r.json?.ok === false, JSON.stringify(r.json));
}

console.log('\n[4] /api/profile POST — hak akses & body rusak');

{
  const r = await call(profile, 'POST', '/api/profile', { action: 'update_profile', full_name: 'X' }, null);
  check('profile POST tanpa sesi -> 401', r.status === 401, `status=${r.status}`);
  check('profile POST tanpa sesi -> nol query', r.calls.length === 0, `terkirim=${r.calls.length}`);
}

for (const [label, body] of [
  ['body bukan objek JSON', '__BUKAN_JSON__'],
  ['body array', '__ARRAY__']
]) {
  const headers = { 'Content-Type': 'application/json', Cookie: `session_token=${custToken}` };
  const payload = body === '__BUKAN_JSON__' ? 'ini bukan json' : '[1,2,3]';
  __calls.length = 0;
  const res = await profile({
    request: new Request(BASE + '/api/profile', { method: 'POST', headers, body: payload }),
    env: ENV, ctx: {}
  });
  const j = await res.json().catch(() => null);
  check(`profile POST ${label} -> 400`, res.status === 400, `status=${res.status} ${JSON.stringify(j)}`);
  check(`profile POST ${label} -> ok:false`, j?.ok === false, JSON.stringify(j));
  check(`profile POST ${label} -> nol query`, __calls.length === 0, `terkirim=${__calls.length}`);
}

console.log('\n[5] /api/profile POST update_profile — CELAH B2 (sebelum diperbaiki)');

// 5a. Nama wajib diisi (sudah ada sebelum B13 — harus TETAP 400).
{
  const r = await call(profile, 'POST', '/api/profile', { action: 'update_profile', full_name: '   ' }, custToken);
  check('update_profile nama kosong -> 400', r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);
  check('update_profile nama kosong -> nol UPDATE',
    r.calls.filter(c => /UPDATE users/i.test(c.sql)).length === 0, JSON.stringify(r.calls.map(c => c.sql)));
}

// 5b. CELAH 1 — nama raksasa. Sebelum B13: tidak ada batas panjang, jadi
// string 1 MB diteruskan ke TiDB. Sesudah: 400 SEBELUM ada UPDATE terkirim.
{
  const huge = 'A'.repeat(100000);
  const r = await call(profile, 'POST', '/api/profile',
    { action: 'update_profile', full_name: huge }, custToken);
  check('update_profile nama 100.000 char -> 400', r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);
  check('update_profile nama raksasa -> nol UPDATE terkirim',
    r.calls.filter(c => /UPDATE users/i.test(c.sql)).length === 0,
    `terkirim=${r.calls.filter(c => /UPDATE users/i.test(c.sql)).length}`);
}

// 5c. CELAH 2 — telepon raksasa / tipe aneh. Sebelum B13: `phone` diambil
// mentah (`(body.phone || '').trim()`). Bila `phone` berupa ANGKA, `.trim()`
// melempar TypeError → 500 (bukan 400, dan pesannya bocor: `(body.phone ||
// "").trim is not a function`). Bila berupa OBJEK, "[object Object]" tersimpan.
// Sesudah: angka DITERIMA (dikoersi wajar untuk klien yang mengirim
// `phone: 81234567890`), objek/array DITOLAK 400 sebelum UPDATE.
{
  const r = await call(profile, 'POST', '/api/profile',
    { action: 'update_profile', full_name: 'Nama Baru', phone: 81234567890 }, custToken);
  check('update_profile telepon berupa angka -> 200, BUKAN 500', r.status === 200,
    `status=${r.status} ${JSON.stringify(r.json)}`);
  const upd = r.calls.filter(c => /UPDATE users SET full_name/i.test(c.sql));
  check('update_profile telepon angka -> tersimpan sebagai string',
    upd.length === 1 && upd[0]?.params?.[1] === '81234567890',
    JSON.stringify(upd[0]?.params));
}

{
  const r = await call(profile, 'POST', '/api/profile',
    { action: 'update_profile', full_name: 'Nama Baru', phone: { n: 1 } }, custToken);
  check('update_profile telepon berupa objek -> 400', r.status === 400,
    `status=${r.status} ${JSON.stringify(r.json)}`);
  check('update_profile telepon objek -> nol UPDATE terkirim',
    r.calls.filter(c => /UPDATE users/i.test(c.sql)).length === 0, JSON.stringify(r.calls.map(c => c.sql)));
}

{
  const r = await call(profile, 'POST', '/api/profile',
    { action: 'update_profile', full_name: 'Nama Baru', phone: ['0812'] }, custToken);
  check('update_profile telepon berupa array -> 400', r.status === 400,
    `status=${r.status} ${JSON.stringify(r.json)}`);
}

{
  const r = await call(profile, 'POST', '/api/profile',
    { action: 'update_profile', full_name: { a: 1 }, phone: '0812' }, custToken);
  check('update_profile nama berupa objek -> 400', r.status === 400,
    `status=${r.status} ${JSON.stringify(r.json)}`);
}

{
  const huge = '0'.repeat(5000);
  const r = await call(profile, 'POST', '/api/profile',
    { action: 'update_profile', full_name: 'Nama Baru', phone: huge }, custToken);
  check('update_profile telepon 5000 char -> 400', r.status === 400,
    `status=${r.status} ${JSON.stringify(r.json)}`);
}

// 5d. Jalur SUKSES harus TETAP bekerja (jangan sampai validasi mematikan fitur).
{
  const r = await call(profile, 'POST', '/api/profile',
    { action: 'update_profile', full_name: 'Nama Baru', phone: '081234567890' }, custToken);
  check('update_profile valid -> 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json)}`);
  const upd = r.calls.filter(c => /UPDATE users SET full_name/i.test(c.sql));
  check('update_profile valid -> 1 UPDATE', upd.length === 1, `UPDATE=${upd.length}`);
  check('update_profile valid -> params [nama, telepon, id]',
    upd[0]?.params?.[0] === 'Nama Baru' && upd[0]?.params?.[1] === '081234567890' && upd[0]?.params?.[2] === 9,
    JSON.stringify(upd[0]?.params));
  check('update_profile valid -> respons tanpa password_hash',
    !JSON.stringify(r.json).includes('password_hash'), JSON.stringify(r.json));
}

// 5e. Kontrol karakter harus dibuang (B2 `cleanStr`), bukan disimpan mentah.
{
  const r = await call(profile, 'POST', '/api/profile',
    { action: 'update_profile', full_name: 'Nama Baru', phone: '0812' }, custToken);
  const upd = r.calls.filter(c => /UPDATE users SET full_name/i.test(c.sql));
  check('update_profile karakter kontrol dibuang',
    upd.length === 1 && !/ |/.test(String(upd[0]?.params?.[0])),
    JSON.stringify(upd[0]?.params));
}

console.log('\n[6] /api/profile POST change_password — kontrak');

for (const [label, body, want] of [
  ['sandi baru kosong', { action: 'change_password', old_password: 'x', new_password: '', repeat_password: '' }, 400],
  ['konfirmasi berbeda', { action: 'change_password', old_password: 'x', new_password: 'abcdef', repeat_password: 'abcdeg' }, 400],
  ['sandi baru 5 char', { action: 'change_password', old_password: 'x', new_password: 'abcde', repeat_password: 'abcde' }, 400]
]) {
  const r = await call(profile, 'POST', '/api/profile', body, custToken);
  check(`change_password ${label} -> ${want}`, r.status === want,
    `status=${r.status} ${JSON.stringify(r.json)}`);
  check(`change_password ${label} -> nol UPDATE sandi`,
    r.calls.filter(c => /UPDATE users SET password_hash/i.test(c.sql)).length === 0,
    JSON.stringify(r.calls.map(c => c.sql)));
}

{
  const r = await call(profile, 'POST', '/api/profile',
    { action: 'tanpa_aksi' }, custToken);
  check('profile POST aksi tak dikenal -> 400', r.status === 400, `status=${r.status} ${JSON.stringify(r.json)}`);
  check('profile POST aksi tak dikenal -> nol query', r.calls.length === 0, `terkirim=${r.calls.length}`);
}

console.log('\n[7] Tidak ada 500 yang membocorkan pesan internal');

// Paksa DB melempar (mock fungsi yang throw) dan periksa isi pesannya.
{
  __calls.length = 0;
  globalThis.__MOCK_ROWS = () => { throw new Error('RAHASIA: connection string mysql://user:pass@host'); };
  const res = await profile({ request: req('GET', '/api/profile', undefined, custToken), env: ENV, ctx: {} });
  const j = await res.json().catch(() => null);
  check('GET gagal DB -> 500', res.status === 500, `status=${res.status}`);
  check('GET gagal DB -> ok:false', j?.ok === false, JSON.stringify(j));
  check('GET gagal DB -> pesan generik (tidak bocor)',
    !String(j?.msg || '').includes('RAHASIA') && !String(j?.msg || '').includes('mysql://'),
    String(j?.msg));
}

{
  __calls.length = 0;
  globalThis.__MOCK_ROWS = () => { throw new Error('RAHASIA: koneksi putus di baris 42'); };
  const res = await profile({
    request: req('POST', '/api/profile', { action: 'update_profile', full_name: 'Nama' }, custToken),
    env: ENV, ctx: {}
  });
  const j = await res.json().catch(() => null);
  check('POST gagal DB -> 500', res.status === 500, `status=${res.status}`);
  check('POST gagal DB -> pesan generik (tidak bocor)',
    !String(j?.msg || '').includes('RAHASIA'), String(j?.msg));
}

console.log('');
console.log(`HASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
