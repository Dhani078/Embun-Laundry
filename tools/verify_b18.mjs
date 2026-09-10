// Harness verifikasi B18 — audit kata kerja TULIS pada SEMUA modul.
//
// PERTANYAAN YANG DIJAWAB: "adakah lagi jalur TULIS yang bisa dipanggil tanpa
// sesi, seperti B17?" B17 ditemukan secara kebetulan dan lolos bertahun-tahun
// karena `verify_b10` mengimpor `pay.js` tetapi hanya menguji GET. Harness ini
// menutup kelas defek itu, bukan satu kasusnya: SETIAP aksi tulis pada SETIAP
// modul dipanggil TANPA cookie, dan yang diukur adalah SQL TULIS yang benar-
// benar terkirim ke driver — bukan status.
//
// Mengapa INSERT/UPDATE/DELETE diukur, bukan status (pelajaran B17):
// 401 yang dikembalikan SETELAH `db.execute()` tetap meninggalkan baris.
// Status bisa 401 sementara penulisan sudah terjadi. Yang dipertaruhkan di
// sini adalah penulisan, jadi yang diukur harus penulisan.
//
// Modul yang GET-nya SENGAJA publik justru yang paling dicurigai:
//   services.js  — GET publik (katalog C1)
//   promos.js    — GET publik
//   pay.js       — GET publik (halaman pembayaran by kode)
//   track.js     — GET publik + 405 untuk kata kerja lain
// Keempatnya diuji pada jalur TULIS-nya masing-masing.
//
// Pengecualian yang SAH dan wajib tetap hijau (jangan "diperbaiki"):
//   - `auth/register.js` — mendaftar adalah SATU-SATUNYA penulisan yang
//     memang harus bisa dilakukan tanpa sesi. Kalau ini ditutup, tidak ada
//     lagi jalan membuat akun. Karena itu ia DIUJI, tetapi dengan asersi
//     TERBALIK: penulisan BOLEH terjadi.
//
// Jalankan:  node tools/verify_b18_run.mjs

import { __calls } from './mock_tidb.mjs';
import { createSessionToken } from '../functions/_db.js';

import { onRequest as orders } from '../functions/api/orders.js';
import { onRequest as customers } from '../functions/api/customers.js';
import { onRequest as services } from '../functions/api/services.js';
import { onRequest as promos } from '../functions/api/promos.js';
import { onRequest as vouchers } from '../functions/api/vouchers.js';
import { onRequest as delivery } from '../functions/api/delivery.js';
import { onRequest as pay } from '../functions/api/pay.js';
import { onRequest as profile } from '../functions/api/profile.js';
import { onRequest as checkin } from '../functions/api/checkin.js';
import { onRequest as track } from '../functions/api/track.js';
import { onRequestPost as register } from '../functions/api/auth/register.js';

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

function req(method, path, cookie, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = `session_token=${cookie}`;
  return new Request(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

// Baris tiruan yang cukup kaya agar jalur SUKSES tidak mati karena `undefined`.
// Tanpa ini, handler bisa gagal di `svc[0].price` dan uji mengukur TypeError,
// bukan kebijakan izin.
globalThis.__MOCK_ROWS = (sql) => {
  if (/FROM\s+orders/i.test(sql)) {
    return [{
      id: 1, order_code: 'ORD-TEST01', customer_name: 'Budi Santoso',
      customer_phone: '0812', customer_address: 'Jl. Melati 12',
      service_id: 1, weight_kg: 3, price_per_kg: 20000, discount: 0,
      total_amount: 60000, status: 'baru', created_at: '2026-09-01 10:00:00'
    }];
  }
  if (/FROM\s+services/i.test(sql)) {
    return [{ id: 1, code: 'SVC-1', name: 'Cuci Kering', price: 20000, unit: 'kg', is_active: 1 }];
  }
  if (/FROM\s+customers/i.test(sql)) {
    return [{ id: 1, code: 'CUST-0001', full_name: 'Budi Santoso', phone: '0812', address: 'Jl. Melati 12', tag: 'Baru' }];
  }
  if (/FROM\s+promos/i.test(sql)) {
    return [{ id: 1, code: 'PROMO1', name: 'Promo', type: 'percent', value: 10, min_spend: 0, max_discount: 0, expires_at: null, is_active: 1 }];
  }
  if (/FROM\s+user_vouchers/i.test(sql)) {
    return [{ id: 1, user_id: 1, promo_id: 1, code: 'VOU-TEST', name: 'Promo', type: 'percent', value: 10, min_spend: 0, max_discount: 0, expires_at: null, used_at: null }];
  }
  if (/FROM\s+pickup_delivery/i.test(sql)) {
    return [{ id: 1, task_code: 'PU-TEST', type: 'pickup', status: 'scheduled', customer_name: 'Budi Santoso' }];
  }
  if (/FROM\s+payments/i.test(sql)) return [];
  if (/FROM\s+users/i.test(sql)) {
    // Untuk uji registrasi, tabel `users` harus KOSONG: bila SELECT "email
    // sudah ada?" dijawab dengan baris, handler wajar mengembalikan 409 tanpa
    // pernah menulis — dan uji "registrasi boleh menulis" MERAH karena
    // kesalahan TIRUAN, bukan karena kebijakan. (Pola yang sama dengan
    // `projectRow()` pada verify_b13: ukur handler, bukan tiruan.)
    if (globalThis.__MOCK_NO_USERS) return [];
    return [{ id: 1, full_name: 'Budi Santoso', email: 'budi@test.com', phone: '0812', role: 'Customer', password_hash: 'x' }];
  }
  if (/FROM\s+daily_checkins/i.test(sql)) return [];
  return [];
};

/** SQL tulis = INSERT / UPDATE / DELETE / REPLACE. SELECT tidak dihitung. */
const WRITE_RE = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i;
const writes = () => __calls.filter(c => WRITE_RE.test(c.sql));

/**
 * Jalankan satu aksi tulis, kembalikan ringkasannya.
 * `__calls` dikosongkan sebelum setiap panggilan supaya yang diukur hanya
 * penulisan dari permintaan ini — kalau tidak, sisa panggilan sebelumnya
 * membuat uji berikutnya HIJAU/MERAH karena alasan yang salah.
 */
async function run(handler, { method = 'POST', path, body, cookie = null }) {
  __calls.length = 0;
  const res = await handler({ request: req(method, path, cookie, body), env: ENV });
  return { status: res.status, writes: writes() };
}

// ---------------------------------------------------------------------------
// Daftar aksi tulis yang diuji. Satu entri = satu jalur tulis nyata.
// `expect`: 'blocked'  -> tanpa sesi TIDAK BOLEH ada penulisan
//           'allowed'  -> tanpa sesi penulisan BOLEH (register)
// ---------------------------------------------------------------------------
const CASES = [
  // orders.js — setiap aksi tulis
  { mod: 'orders',   act: 'create_order',   handler: orders,   path: '/api/orders',   body: { action: 'create_order', service_id: 1, weight_kg: 3 } },
  { mod: 'orders',   act: 'move_status',    handler: orders,   path: '/api/orders',   body: { action: 'move_status', id: 1, status: 'proses' } },
  { mod: 'orders',   act: 'update_order',   handler: orders,   path: '/api/orders',   body: { action: 'update_order', id: 1, customer_name: 'Budi Santoso', service_id: 1 } },
  { mod: 'orders',   act: 'delete_order',   handler: orders,   path: '/api/orders',   body: { action: 'delete_order', id: 1 } },

  // customers.js
  { mod: 'customers',act: 'create_customer',handler: customers,path: '/api/customers',body: { action: 'create_customer', full_name: 'Budi Santoso', phone: '0812' } },
  { mod: 'customers',act: 'update_customer',handler: customers,path: '/api/customers',body: { action: 'update_customer', id: 1, full_name: 'Budi Santoso' } },
  { mod: 'customers',act: 'delete_customer',handler: customers,path: '/api/customers',body: { action: 'delete_customer', id: 1 } },

  // services.js — GET publik (C1), jadi jalur tulisnya wajib diuji
  { mod: 'services', act: 'create_service', handler: services, path: '/api/services', body: { action: 'create_service', code: 'SVC-9', name: 'Setrika', price: 5000 } },
  { mod: 'services', act: 'update_service', handler: services, path: '/api/services', body: { action: 'update_service', id: 1, code: 'SVC-1', name: 'Setrika', price: 5000 } },
  { mod: 'services', act: 'delete_service', handler: services, path: '/api/services', body: { action: 'delete_service', id: 1 } },
  { mod: 'services', act: 'toggle_service', handler: services, path: '/api/services', body: { action: 'toggle_service', id: 1, is_active: 0 } },

  // promos.js — GET publik
  { mod: 'promos',   act: 'create_promo',   handler: promos,   path: '/api/promos',   body: { action: 'create_promo', code: 'PROMO9', name: 'Promo', type: 'percent', value: 10 } },
  { mod: 'promos',   act: 'update_promo',   handler: promos,   path: '/api/promos',   body: { action: 'update_promo', id: 1, code: 'PROMO1', name: 'Promo', type: 'percent', value: 10 } },
  { mod: 'promos',   act: 'delete_promo',   handler: promos,   path: '/api/promos',   body: { action: 'delete_promo', id: 1 } },
  { mod: 'promos',   act: 'toggle_promo',   handler: promos,   path: '/api/promos',   body: { action: 'toggle_promo', id: 1, is_active: 0 } },

  // vouchers.js
  { mod: 'vouchers', act: 'claim',          handler: vouchers, path: '/api/vouchers', body: { action: 'claim', promo_id: 1 } },
  { mod: 'vouchers', act: 'bulk_claim',     handler: vouchers, path: '/api/vouchers', body: { action: 'bulk_claim', promo_id: 1, user_ids: [1, 2] } },
  { mod: 'vouchers', act: 'create_voucher', handler: vouchers, path: '/api/vouchers', body: { action: 'create_voucher', promo_id: 1, user_id: 1 } },
  { mod: 'vouchers', act: 'delete_voucher', handler: vouchers, path: '/api/vouchers', body: { action: 'delete_voucher', id: 1 } },

  // delivery.js — create_task sengaja boleh untuk pelanggan bersesi
  { mod: 'delivery', act: 'create_task',    handler: delivery, path: '/api/delivery', body: { action: 'create_task', type: 'pickup', customer_name: 'Budi Santoso', address: 'Jl. Melati 12' } },
  { mod: 'delivery', act: 'update_status',  handler: delivery, path: '/api/delivery', body: { action: 'update_status', id: 1, status: 'completed' } },
  { mod: 'delivery', act: 'assign_courier', handler: delivery, path: '/api/delivery', body: { action: 'assign_courier', id: 1, courier_id: 1 } },
  { mod: 'delivery', act: 'delete_task',    handler: delivery, path: '/api/delivery', body: { action: 'delete_task', id: 1 } },

  // pay.js — GET publik, POST wajib sesi (B17)
  { mod: 'pay',      act: 'POST /api/pay',  handler: pay,      path: '/api/pay',      body: { order_code: 'ORD-TEST01', amount: 10000, method: 'CASH' } },

  // profile.js
  { mod: 'profile',  act: 'update_profile', handler: profile,  path: '/api/profile',  body: { action: 'update_profile', full_name: 'Budi Santoso', phone: '0812' } },
  { mod: 'profile',  act: 'change_password',handler: profile,  path: '/api/profile',  body: { action: 'change_password', old_password: 'lama12345', new_password: 'baru12345' } },

  // checkin.js
  { mod: 'checkin',  act: 'POST /api/checkin', handler: checkin, path: '/api/checkin', body: {} },

  // registrasi: penulisan TANPA sesi adalah FITUR, bukan celah
  { mod: 'register', act: 'POST /api/auth/register', handler: register, path: '/api/auth/register',
    body: { full_name: 'Budi Baru', email: 'baru@test.com', password: 'rahasia123', confirm: 'rahasia123' },
    expect: 'allowed' }
];

console.log('=== B18 — tanpa sesi: apakah ada penulisan yang terkirim? ===\n');

for (const c of CASES) {
  const expectBlocked = c.expect !== 'allowed';
  let r;
  try {
    r = await run(c.handler, { path: c.path, body: c.body });
  } catch (e) {
    check(`${c.mod}:${c.act} — tidak melempar`, false, String(e && e.message));
    continue;
  }

  if (!expectBlocked) {
    // Registrasi: kosongkan tabel `users` tiruan agar jalur "email belum ada"
    // yang benar-benar menulis tercapai (lihat catatan pada __MOCK_ROWS).
    globalThis.__MOCK_NO_USERS = true;
    __calls.length = 0;
    try {
      r = await run(c.handler, { path: c.path, body: c.body });
    } finally {
      globalThis.__MOCK_NO_USERS = false;
    }
  }

  if (expectBlocked) {
    // Yang diukur: NOL penulisan terkirim. Status saja tidak cukup (B17).
    check(
      `${c.mod}:${c.act} — 0 penulisan tanpa sesi`,
      r.writes.length === 0,
      `${r.writes.length} penulisan, status ${r.status}, SQL: ${r.writes.map(w => w.sql.slice(0, 60)).join(' | ')}`
    );
    // Status tetap diperiksa sebagai sinyal, tetapi hanya 401/403/429 yang
    // wajar; 500 berarti handler melempar sebelum penjaga.
    check(
      `${c.mod}:${c.act} — status bukan 5xx`,
      r.status < 500,
      `status ${r.status}`
    );
  } else {
    check(
      `register — penulisan TETAP boleh tanpa sesi (fitur)`,
      r.writes.length > 0,
      `${r.writes.length} penulisan, status ${r.status}`
    );
  }
}

// ---------------------------------------------------------------------------
// Bagian 2 — kata kerja non-GET pada modul yang hanya punya GET.
// `track.js` publik by design; bila ia diam-diam mendapat jalur tulis,
// kelas defek B17 terulang. Uji ini mengunci kontraknya.
// ---------------------------------------------------------------------------
console.log('\n=== B18 — kata kerja terlarang pada modpublik (track) ===\n');

for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
  const r = await run(track, { method, path: '/api/track?code=ORD-TEST01', body: {} });
  check(
    `track: ${method} — 0 penulisan`,
    r.writes.length === 0,
    `${r.writes.length} penulisan, status ${r.status}`
  );
  check(
    `track: ${method} — ditolak (405)`,
    r.status === 405,
    `status ${r.status}`
  );
}

// ---------------------------------------------------------------------------
// Bagian 3 — jalur SUKSES tidak boleh mati.
// Penjaga yang menolak semua orang sama buruknya dengan penjaga yang tidak
// ada: kalau staf tidak bisa lagi membuat layanan, B18 "hijau" karena fitur
// mati. Ini adalah uji penyeimbang yang wajib ada di setiap perbaikan auth.
// ---------------------------------------------------------------------------
console.log('\n=== B18 — jalur sukses staf tidak boleh mati ===\n');

const staffToken = await createSessionToken(
  { id: 99, full_name: 'Admin Staff', role: 'Admin', email: 'admin@test.com' },
  ENV
);
// PELAJARAN B17 — bentuk objeknya `{id, full_name, role}`; `{user_role,
// user_name}` adalah bentuk JWT HASILNYA. Salah membentuk membuat staf
// menjadi "Customer" dan semua uji di bawah MERAH karena kesalahan harness.

const STAFF_CASES = [
  { mod: 'services', act: 'create_service', handler: services, path: '/api/services', body: { action: 'create_service', code: 'SVC-9', name: 'Setrika', price: 5000 } },
  { mod: 'promos',   act: 'create_promo',   handler: promos,   path: '/api/promos',   body: { action: 'create_promo', code: 'PROMO9', name: 'Promo', type: 'percent', value: 10 } },
  { mod: 'orders',   act: 'move_status',    handler: orders,   path: '/api/orders',   body: { action: 'move_status', id: 1, status: 'proses' } },
  { mod: 'delivery', act: 'update_status',  handler: delivery, path: '/api/delivery', body: { action: 'update_status', id: 1, status: 'completed' } },
  { mod: 'vouchers', act: 'create_voucher', handler: vouchers, path: '/api/vouchers', body: { action: 'create_voucher', promo_id: 1, user_id: 1 } }
];

for (const c of STAFF_CASES) {
  const r = await run(c.handler, { path: c.path, body: c.body, cookie: staffToken });
  check(
    `staf ${c.mod}:${c.act} — penulisan terjadi (fitur hidup)`,
    r.writes.length > 0,
    `status ${r.status}, ${r.writes.length} penulisan`
  );
  check(
    `staf ${c.mod}:${c.act} — status 200`,
    r.status === 200,
    `status ${r.status}`
  );
}

// ---------------------------------------------------------------------------
// Bagian 4 — GET publik tidak ikut tertutup (regresi B10/C1/C2).
// ---------------------------------------------------------------------------
console.log('\n=== B18 — GET publik tetap terbuka ===\n');

for (const [name, handler, path] of [
  ['services', services, '/api/services'],
  ['promos', promos, '/api/promos'],
  ['pay', pay, '/api/pay?order_code=ORD-TEST01']
]) {
  __calls.length = 0;
  const res = await handler({ request: req('GET', path), env: ENV });
  check(`GET publik ${name} — 200 (tidak ikut ditutup)`, res.status === 200, `status ${res.status}`);
}

console.log(`\nHASIL: ${pass}/${pass + fail} ${fail === 0 ? 'HIJAU' : 'MERAH'}`);
if (fail > 0) process.exitCode = 1;
