// tools/verify_c1.mjs
// Harness verifikasi C1 — Halaman & API Layanan publik + filter.
//
// Menguji:
// 1. GET /api/services mengembalikan 200 dan array layanan.
// 2. Publik (tanpa login): hanya layanan aktif (is_active = 1) yang dikembalikan.
// 3. Filter kategori (?cat=Express): query menyertakan filter category.
// 4. Pencarian (?q=Cuci): query menyertakan filter LIKE pada code, name, description.
// 5. Staf (?status=nonaktif): hanya staf yang diizinkan memfilter nonaktif.
// 6. Hardening B14: error DB menghasilkan 500 generik tanpa membocorkan connection string.
//
// Jalankan:  node tools/verify_c1_run.mjs

import { onRequest as servicesHandler } from '../functions/api/services.js';
import { createSessionToken } from '../functions/_db.js';
import { __calls } from './mock_tidb.mjs';

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

const MOCK_SERVICES = [
  { id: 1, code: 'SRV-01', name: 'Cuci Komplit Reguler', category: 'Reguler', price: 7000, duration_hours: 48, is_active: 1, unit: 'kg' },
  { id: 2, code: 'SRV-02', name: 'Cuci Kering Express', category: 'Express', price: 12000, duration_hours: 12, is_active: 1, unit: 'kg' },
  { id: 3, code: 'SRV-03', name: 'Bed Cover Sedang', category: 'Satuan', price: 25000, duration_hours: 48, is_active: 1, unit: 'pcs' },
  { id: 4, code: 'SRV-04', name: 'Jas / Safari', category: 'Dry Cleaning', price: 35000, duration_hours: 72, is_active: 1, unit: 'pcs' },
  { id: 5, code: 'SRV-05', name: 'Layanan Usang', category: 'Reguler', price: 5000, duration_hours: 48, is_active: 0, unit: 'kg' }
];

let pass = 0;
let fail = 0;

function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name} — ${detail}`);
  }
}

console.log('\n--- UJI C1: KATALOG LAYANAN PUBLIK & FILTER ---');

// 1. GET publik tanpa filter
{
  globalThis.__MOCK_ROWS = (sql, params) => {
    // Verifikasi bahwa untuk publik ada filter is_active = 1
    if (sql.includes('is_active = 1')) {
      return MOCK_SERVICES.filter(s => s.is_active === 1);
    }
    return MOCK_SERVICES;
  };

  const req = new Request(`${BASE}/api/services`, { method: 'GET' });
  const res = await servicesHandler({ request: req, env: ENV });
  const json = await res.json();

  check('GET /api/services berhasil 200', res.status === 200);
  check('ok:true', json.ok === true);
  check('Mengembalikan array services', Array.isArray(json.services));
  check('Publik hanya melihat layanan aktif', json.services.every(s => s.is_active === 1));
  check('Layanan nonaktif tidak muncul ke publik', !json.services.some(s => s.code === 'SRV-05'));
}

// 2. Filter kategori ?cat=Express
{
  globalThis.__MOCK_ROWS = (sql, params) => {
    check('SQL memakai parameter kategori', sql.includes('category = ?') && params.includes('Express'));
    return MOCK_SERVICES.filter(s => s.is_active === 1 && s.category === 'Express');
  };

  const req = new Request(`${BASE}/api/services?cat=Express`, { method: 'GET' });
  const res = await servicesHandler({ request: req, env: ENV });
  const json = await res.json();

  check('Filter kategori mengembalikan 200', res.status === 200 && json.ok === true);
  check('Semua hasil kategori Express', json.services.length === 1 && json.services[0].category === 'Express');
}

// 3. Pencarian teks ?q=Cover
{
  globalThis.__MOCK_ROWS = (sql, params) => {
    check('SQL memakai parameter pencarian ter-parameterisasi', sql.includes('LIKE ?') && params.includes('%Cover%'));
    return MOCK_SERVICES.filter(s => s.name.includes('Cover'));
  };

  const req = new Request(`${BASE}/api/services?q=Cover`, { method: 'GET' });
  const res = await servicesHandler({ request: req, env: ENV });
  const json = await res.json();

  check('Pencarian teks mengembalikan 200', res.status === 200 && json.ok === true);
  check('Menemukan layanan Bed Cover', json.services.length === 1 && json.services[0].name.includes('Bed Cover'));
}

// 4. Staf dapat melihat layanan nonaktif dengan ?status=nonaktif
{
  const adminToken = await createSessionToken({
    id: 1,
    full_name: 'Admin Toko',
    role: 'Admin',
    email: 'admin@gmail.com'
  }, ENV);

  globalThis.__MOCK_ROWS = (sql, params) => {
    if (sql.includes('is_active = 0')) {
      return MOCK_SERVICES.filter(s => s.is_active === 0);
    }
    return MOCK_SERVICES;
  };

  const req = new Request(`${BASE}/api/services?status=nonaktif`, {
    method: 'GET',
    headers: { 'Cookie': `session_token=${adminToken}` }
  });
  const res = await servicesHandler({ request: req, env: ENV });
  const json = await res.json();

  check('Staf dapat meminta status nonaktif (200)', res.status === 200 && json.ok === true);
  check('Mengembalikan layanan nonaktif', json.services.length === 1 && json.services[0].code === 'SRV-05');
}

// 5. Non-staf minta ?status=nonaktif tetap dipaksa aktif
{
  globalThis.__MOCK_ROWS = (sql, params) => {
    check('SQL publik tetap menjaga is_active = 1', sql.includes('is_active = 1'));
    return MOCK_SERVICES.filter(s => s.is_active === 1);
  };

  const req = new Request(`${BASE}/api/services?status=nonaktif`, { method: 'GET' });
  const res = await servicesHandler({ request: req, env: ENV });
  const json = await res.json();

  check('Publik minta nonaktif tetap diproteksi', json.services.every(s => s.is_active === 1));
}

// 6. Hardening B14: Kesalahan internal database mengembalikan pesan generik
{
  globalThis.__MOCK_ROWS = () => {
    throw new Error('RAHASIA: connection string mysql://root:secret@gateway.tidbcloud.com/embun_laundry');
  };

  const req = new Request(`${BASE}/api/services`, { method: 'GET' });
  const res = await servicesHandler({ request: req, env: ENV });
  const json = await res.json();

  check('DB error mengembalikan 500', res.status === 500 && json.ok === false);
  check('B14: Pesan error generik', json.msg === 'Terjadi kesalahan pada server');
  check('B14: Secret DB tidak bocor ke respons', !JSON.stringify(json).includes('RAHASIA'));
}

console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`);
if (fail > 0) process.exit(1);
