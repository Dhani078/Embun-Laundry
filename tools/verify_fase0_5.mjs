// Harness verifikasi Fase 0.5 — Perbaikan functions/api/notifications.js (K3):
// impor yang benar (getDb), kontrak validateOr400 yang benar, pembacaan properti objek (bukan array indeks),
// dan rate limiting yang konsisten (rl.ok).
//
// Jalankan: node tools/verify_fase0_5_run.mjs

import fs from 'node:fs';
import path from 'node:path';
import { onRequestGet } from '../functions/api/notifications.js';
import worker from '../src/index.js';

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
// Bagian 1 — Audit Kode Statik functions/api/notifications.js
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit Kode Statik functions/api/notifications.js');

const notifPath = path.join(ROOT, 'functions', 'api', 'notifications.js');
const notifCode = fs.readFileSync(notifPath, 'utf8');

check(
  'notifications.js TIDAK mengimpor getDB (harus getDb)',
  !/import\s*\{[^}]*\bgetDB\b[^}]*\}\s*from/.test(notifCode),
  'getDB (typo) masih diimpor'
);

check(
  'notifications.js mengimpor getDb',
  /import\s*\{[^}]*\bgetDb\b[^}]*\}\s*from/.test(notifCode),
  'getDb belum diimpor'
);

check(
  'notifications.js TIDAK mengimpor rateLimit yang tidak diekspor',
  !/import\s*\{[^}]*\brateLimit\b[^}]*\}\s*from/.test(notifCode),
  'rateLimit masih diimpor dari _ratelimit.js'
);

check(
  'notifications.js memeriksa rlRes.ok (bukan rlRes.allowed)',
  !/rlRes\.allowed/.test(notifCode) && /rlRes\.ok/.test(notifCode),
  'rlRes.allowed masih digunakan'
);

check(
  'notifications.js TIDAK membaca order[3] (harus order.status)',
  !/order\[3\]/.test(notifCode),
  'order[3] masih digunakan'
);

check(
  'notifications.js TIDAK membaca row[0] (harus named object property)',
  !/row\[0\]/.test(notifCode),
  'row[0] masih digunakan'
);

check(
  'notifications.js menggunakan kontrak validateOr400 dengan benar',
  !/\{\s*valid\s*,\s*errors\s*\}\s*=/i.test(notifCode),
  'Kontrak lama { valid, errors } masih dipakai'
);

// ---------------------------------------------------------------------------
// Bagian 2 — Uji Runtime Handler onRequestGet
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Uji Runtime Handler onRequestGet');

// 1. Validasi: order_code kosong / tidak ada
const reqNoCode = new Request('https://embun-laundry.dhanisepeda.workers.dev/api/notifications');
const resNoCode = await onRequestGet({ request: reqNoCode, env: {} });
check('tanpa order_code: return status 400', resNoCode.status === 400);

const bodyNoCode = await resNoCode.json();
check('tanpa order_code: body ok = false', bodyNoCode.ok === false);

// 2. Validasi: order_code terlalu pendek (< 3 char)
const reqShort = new Request('https://embun-laundry.dhanisepeda.workers.dev/api/notifications?order_code=A');
const resShort = await onRequestGet({ request: reqShort, env: {} });
check('order_code terlalu pendek: return status 400', resShort.status === 400);

// 3. Validasi: order_code terlalu panjang (> 20 char)
const reqLong = new Request('https://embun-laundry.dhanisepeda.workers.dev/api/notifications?order_code=' + 'A'.repeat(25));
const resLong = await onRequestGet({ request: reqLong, env: {} });
check('order_code terlalu panjang: return status 400', resLong.status === 400);

// 4. DB tidak terkonfigurasi (tanpa TIDB_DATABASE_URL) -> return 500
const reqNoDb = new Request('https://embun-laundry.dhanisepeda.workers.dev/api/notifications?order_code=ORD-123', {
  headers: { 'CF-Connecting-IP': '10.10.1.1' }
});
const resNoDb = await onRequestGet({ request: reqNoDb, env: {} });
check('DB tidak terkonfigurasi: return 500', resNoDb.status === 500);

// 5. Mock DB untuk pengujian handler
const mockEnv = {
  TIDB_DATABASE_URL: 'mysql://mock'
};

// Skenario 5A: Order tidak ditemukan -> 404
globalThis.__MOCK_ROWS = [];
const reqNotFound = new Request('https://embun-laundry.dhanisepeda.workers.dev/api/notifications?order_code=ORD-999', {
  headers: { 'CF-Connecting-IP': '10.10.2.1' }
});
const resNotFound = await onRequestGet({ request: reqNotFound, env: mockEnv });
check('order tidak ada di DB: return 404', resNotFound.status === 404);

// Skenario 5B: Order ditemukan tanpa notifikasi -> 200
globalThis.__MOCK_ROWS = (sql) => {
  if (sql.includes('FROM orders')) {
    return [{ id: 1, status: 'Diproses' }];
  }
  return []; // notifications kosong
};
const reqFound = new Request('https://embun-laundry.dhanisepeda.workers.dev/api/notifications?order_code=ORD-100', {
  headers: { 'CF-Connecting-IP': '10.10.3.1' }
});
const resFound = await onRequestGet({ request: reqFound, env: mockEnv });
check('order ada di DB: return 200', resFound.status === 200);
const bodyFound = await resFound.json();
check('order ada di DB: ok = true & status cocok', bodyFound.ok === true && bodyFound.order_status === 'Diproses');
check('order ada di DB: notifications berbentuk array', Array.isArray(bodyFound.notifications));

// Skenario 5C: Order ditemukan dengan daftar notifikasi -> 200
globalThis.__MOCK_ROWS = (sql) => {
  if (sql.includes('FROM orders')) {
    return [{ id: 2, status: 'Selesai' }];
  }
  if (sql.includes('FROM notifications')) {
    return [
      { id: 10, order_code: 'ORD-200', message: 'Cucian selesai', status: 'Selesai', created_at: '2026-09-16 09:00:00' }
    ];
  }
  return [];
};
const reqWithNotifs = new Request('https://embun-laundry.dhanisepeda.workers.dev/api/notifications?order_code=ORD-200', {
  headers: { 'CF-Connecting-IP': '10.10.4.1' }
});
const resWithNotifs = await onRequestGet({ request: reqWithNotifs, env: mockEnv });
const bodyWithNotifs = await resWithNotifs.json();
check('notifikasi terisi: jumlah item sesuai', bodyWithNotifs.notifications?.length === 1);
check('notifikasi terisi: pesan cocok', bodyWithNotifs.notifications?.[0]?.message === 'Cucian selesai');

// ---------------------------------------------------------------------------
// Bagian 3 — Uji Rate Limiting (B1)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 3 — Uji Rate Limiting');
const testIp = '10.99.99.1';
let lastStatus = 200;
// Limit adalah 30 permintaan per 5 menit
for (let i = 0; i < 35; i++) {
  const req = new Request('https://embun-laundry.dhanisepeda.workers.dev/api/notifications?order_code=ORD-100', {
    headers: { 'CF-Connecting-IP': testIp }
  });
  const res = await onRequestGet({ request: req, env: mockEnv });
  lastStatus = res.status;
  if (res.status === 429) break;
}
check('rate limit terpicu (HTTP 429) saat permintaan berlebih', lastStatus === 429);

// ---------------------------------------------------------------------------
// Bagian 4 — Uji Integrasi worker entrypoint src/index.js
// ---------------------------------------------------------------------------
console.log('\n# Bagian 4 — Uji Integrasi Worker Entrypoint');
const workerReq = new Request('https://embun-laundry.dhanisepeda.workers.dev/api/notifications?order_code=ORD-100');
const workerRes = await worker.fetch(workerReq, mockEnv);
check('worker entrypoint merespons /api/notifications secara aman (404 sebelum C3 / 200 setelah C3)', workerRes.status === 404 || workerRes.status === 200);

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL FASE 0.5: HIJAU ${pass}, MERAH ${fail} (${pass}/${pass + fail})`);
if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
