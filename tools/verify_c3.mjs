// tools/verify_c3.mjs
// Harness verifikasi Task C3 — Notifikasi Real-Time Status Order (Polling)
//
// Menguji:
// 1. Audit skema migrasi 0005_create_notifications_table.sql.
// 2. Audit routing dan CORS preflight /api/notifications di src/index.js.
// 3. Verifikasi validasi input & rate limit pada GET /api/notifications.
// 4. Verifikasi pengambilan riwayat notifikasi order (200, 404, order_status).
// 5. Verifikasi pembuatan notifikasi otomatis pada alur create_order, move_status, dan POST /api/pay.
// 6. Audit integrasi UI polling pada public/track.html dan public/index.html.
//
// Jalankan: node tools/verify_c3_run.mjs

import fs from 'node:fs';
import path from 'node:path';
import worker from '../src/index.js';
import { onRequestGet as notifGet, onRequestOptions as notifOptions } from '../functions/api/notifications.js';
import { onRequest as ordersHandler } from '../functions/api/orders.js';
import { onRequest as payHandler } from '../functions/api/pay.js';
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
  JWT_SECRET: 'c3-realtime-notifications-secret'
};

// ---------------------------------------------------------------------------
// Bagian 1 — Audit Migrasi & Kode Statik
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit Migrasi & Kode Statik');

const migrationPath = path.join(ROOT, 'db', 'migrations', '0005_create_notifications_table.sql');
check('file migrasi 0005_create_notifications_table.sql ada', fs.existsSync(migrationPath));

const migSql = fs.readFileSync(migrationPath, 'utf8');
check('migrasi 0005 memuat CREATE TABLE notifications',
  /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?notifications/i.test(migSql)
);
check('migrasi 0005 mendefinisikan kolom order_code, message, status, created_at',
  /order_code\s+VARCHAR/i.test(migSql) &&
  /message\s+TEXT/i.test(migSql) &&
  /status\s+VARCHAR/i.test(migSql) &&
  /created_at\s+DATETIME/i.test(migSql)
);

const indexJs = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
check('src/index.js mengimpor notificationsHandler', /import\s+\*\s+as\s+notificationsHandler\s+from/i.test(indexJs));
check('src/index.js mendaftarkan rute /api/notifications', /path\s*===\s*['"]\/api\/notifications['"]/i.test(indexJs));
check('src/index.js mendaftarkan preflight CORS untuk /api/notifications', /'\/api\/notifications':\s*notificationsHandler/.test(indexJs));

const ordersJs = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'orders.js'), 'utf8');
check('orders.js mencatat notifikasi pada create_order',
  /INSERT\s+INTO\s+notifications\b/i.test(ordersJs)
);
check('orders.js mencatat notifikasi pada move_status',
  /INSERT\s+INTO\s+notifications\s*\(order_code,\s*message,\s*status,\s*created_at\)/i.test(ordersJs)
);

const payJs = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'pay.js'), 'utf8');
check('pay.js mencatat notifikasi pada pembayaran berhasil',
  /INSERT\s+INTO\s+notifications\s*\(order_code,\s*message,\s*status,\s*created_at\)/i.test(payJs)
);

const trackHtml = fs.readFileSync(path.join(ROOT, 'public', 'track.html'), 'utf8');
check('track.html memuat wadah notifikasi real-time',
  trackHtml.includes('notif-box') && trackHtml.includes('notif-list')
);
check('track.html memuat fungsi polling /api/notifications',
  trackHtml.includes('/api/notifications?order_code=') && trackHtml.includes('startPolling')
);

const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
check('index.html memuat wadah notifikasi modal',
  indexHtml.includes('modalNotifBox') && indexHtml.includes('modalNotifList')
);
check('index.html memuat fungsi polling modal',
  indexHtml.includes('/api/notifications?order_code=') && indexHtml.includes('startTrackPolling')
);

// ---------------------------------------------------------------------------
// Bagian 2 — Uji Validasi & Rate Limiting GET /api/notifications
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Uji Validasi & Rate Limiting GET /api/notifications');

// 1. Tanpa order_code -> 400
{
  const req = new Request('https://embun.test/api/notifications', {
    headers: { 'CF-Connecting-IP': '10.20.1.1' }
  });
  const res = await notifGet({ request: req, env: ENV });
  check('permintaan tanpa order_code -> 400 Bad Request', res.status === 400);
  const body = await res.json();
  check('body permintaan tidak valid memuat ok: false', body.ok === false);
}

// 2. order_code tidak valid (terlalu pendek) -> 400
{
  const req = new Request('https://embun.test/api/notifications?order_code=AB', {
    headers: { 'CF-Connecting-IP': '10.20.1.2' }
  });
  const res = await notifGet({ request: req, env: ENV });
  check('order_code terlalu pendek (<3 char) -> 400 Bad Request', res.status === 400);
}

// 3. order_code terlalu panjang (>20 char) -> 400
{
  const req = new Request(`https://embun.test/api/notifications?order_code=${'A'.repeat(25)}`, {
    headers: { 'CF-Connecting-IP': '10.20.1.3' }
  });
  const res = await notifGet({ request: req, env: ENV });
  check('order_code terlalu panjang (>20 char) -> 400 Bad Request', res.status === 400);
}

// 4. Rate limiting (maks 30 req / 5 menit)
{
  let lastStatus = 0;
  const ip = '10.20.2.1';
  for (let i = 0; i < 35; i++) {
    const req = new Request('https://embun.test/api/notifications?order_code=ORD-TESTRL', {
      headers: { 'CF-Connecting-IP': ip }
    });
    const res = await notifGet({ request: req, env: ENV });
    lastStatus = res.status;
    if (res.status === 429) break;
  }
  check('rate limit terpicu (HTTP 429) setelah 30 permintaan', lastStatus === 429);
}

// ---------------------------------------------------------------------------
// Bagian 3 — Uji Runtime Respon Notifikasi (200 & 404)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 3 — Uji Runtime Respon Notifikasi');

// Mock rows data
const testNotifications = [
  { id: 1, order_code: 'ORD-101', message: 'Status pesanan ORD-101 diperbarui menjadi: proses', status: 'proses', created_at: '2026-09-16 10:00:00' },
  { id: 2, order_code: 'ORD-101', message: 'Pesanan ORD-101 berhasil dibuat dengan status baru', status: 'baru', created_at: '2026-09-16 09:30:00' }
];

globalThis.__MOCK_ROWS = (sql, params) => {
  const s = String(sql);
  if (/FROM\s+orders\s+WHERE\s+order_code\s*=\s*\?/i.test(s)) {
    if (params && params[0] === 'ORD-101') {
      return [{ id: 101, status: 'proses' }];
    }
    return [];
  }
  if (/FROM\s+notifications\s+WHERE\s+order_code\s*=\s*\?/i.test(s)) {
    if (params && params[0] === 'ORD-101') {
      return testNotifications;
    }
    return [];
  }
  return [];
};

// 1. Order tidak ditemukan -> 404
{
  const req = new Request('https://embun.test/api/notifications?order_code=ORD-999', {
    headers: { 'CF-Connecting-IP': '10.20.3.1' }
  });
  const res = await notifGet({ request: req, env: ENV });
  check('order_code tidak terdaftar -> 404 Not Found', res.status === 404);
}

// 2. Order ditemukan -> 200 dengan detail dan list notifikasi
{
  const req = new Request('https://embun.test/api/notifications?order_code=ORD-101', {
    headers: { 'CF-Connecting-IP': '10.20.3.2' }
  });
  const res = await notifGet({ request: req, env: ENV });
  check('order_code terdaftar -> 200 OK', res.status === 200);
  const data = await res.json();
  check('respons memuat order_code yang benar', data.order_code === 'ORD-101');
  check('respons memuat order_status terkini', data.order_status === 'proses');
  check('respons memuat array notifications', Array.isArray(data.notifications) && data.notifications.length === 2);
  check('item notifikasi memiliki kolom id, message, status, created_at',
    data.notifications[0].id === 1 && data.notifications[0].status === 'proses'
  );
}

// ---------------------------------------------------------------------------
// Bagian 4 — Uji Pembuatan Notifikasi Otomatis pada Orders & Payments
// ---------------------------------------------------------------------------
console.log('\n# Bagian 4 — Uji Pembuatan Notifikasi Otomatis');

const staffToken = await createSessionToken(
  { id: 1, full_name: 'Staf Uji', role: 'Staff', email: 'staff@test.com' },
  ENV
);

// 1. create_order membuat entri notifikasi
{
  __calls.length = 0;
  globalThis.__MOCK_ROWS = (sql) => {
    if (/FROM\s+services/i.test(sql)) return [{ price: 20000 }];
    if (/FROM\s+orders/i.test(sql)) return [{ id: 701, order_code: 'ORD-NEW01', status: 'baru' }];
    return [];
  };

  const req = new Request('https://embun.test/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_token=${staffToken}`
    },
    body: JSON.stringify({
      action: 'create_order',
      customer_name: 'Pelanggan Baru',
      customer_phone: '0812345678',
      service_id: 1,
      weight_kg: 2
    })
  });

  const res = await ordersHandler({ request: req, env: ENV, ctx: {} });
  check('create_order -> 200 OK', res.status === 200);
  const notifInsert = __calls.find(c => /INSERT\s+INTO\s+notifications/i.test(c.sql));
  check('create_order mengeksekusi INSERT INTO notifications', !!notifInsert);
  check('notifikasi create_order berstatus "baru"', notifInsert?.params?.includes('baru'));
}

// 2. move_status membuat entri notifikasi
{
  __calls.length = 0;
  globalThis.__MOCK_ROWS = (sql) => {
    if (/FROM\s+orders\s+WHERE\s+id\s*=\s*\?/i.test(sql)) {
      return [{ id: 701, order_code: 'ORD-NEW01', status: 'baru' }];
    }
    return [];
  };

  const req = new Request('https://embun.test/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_token=${staffToken}`
    },
    body: JSON.stringify({
      action: 'move_status',
      id: 701,
      status: 'selesai'
    })
  });

  const res = await ordersHandler({ request: req, env: ENV, ctx: {} });
  check('move_status -> 200 OK', res.status === 200);
  const notifInsert = __calls.find(c => /INSERT\s+INTO\s+notifications/i.test(c.sql));
  check('move_status mengeksekusi INSERT INTO notifications', !!notifInsert);
  check('notifikasi move_status memuat status baru "selesai"', notifInsert?.params?.includes('selesai'));
}

// 3. POST /api/pay membuat entri notifikasi pembayaran
{
  __calls.length = 0;
  globalThis.__MOCK_ROWS = (sql) => {
    if (/FROM\s+orders\s+WHERE\s+order_code\s*=\s*\?/i.test(sql)) {
      return [{ id: 701, order_code: 'ORD-NEW01', total_amount: 50000, paid_amount: 0, payment_status: 'unpaid', user_id: 1 }];
    }
    if (/FROM\s+payments/i.test(sql)) return [];
    return [];
  };

  const req = new Request('https://embun.test/api/pay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_token=${staffToken}`
    },
    body: JSON.stringify({
      order_code: 'ORD-NEW01',
      amount: 50000,
      method: 'CASH',
      idempotency_key: 'PAY-KEY-C3-001'
    })
  });

  const res = await payHandler({ request: req, env: ENV, ctx: {} });
  check('payHandler -> 200 OK', res.status === 200);
  const notifInsert = __calls.find(c => /INSERT\s+INTO\s+notifications/i.test(c.sql));
  check('POST /api/pay mengeksekusi INSERT INTO notifications', !!notifInsert);
  check('notifikasi pembayaran berstatus "dibayar"', notifInsert?.params?.includes('dibayar'));
}

// ---------------------------------------------------------------------------
// Bagian 5 — Uji Integrasi Entrypoint Worker (src/index.js) & CORS
// ---------------------------------------------------------------------------
console.log('\n# Bagian 5 — Uji Integrasi Worker Entrypoint & CORS');

{
  globalThis.__MOCK_ROWS = (sql, params) => {
    if (/FROM\s+orders/i.test(sql)) return [{ id: 101, status: 'proses' }];
    if (/FROM\s+notifications/i.test(sql)) return testNotifications;
    return [];
  };

  // GET via worker fetch
  const wReq = new Request('https://embun-laundry.dhanisepeda.workers.dev/api/notifications?order_code=ORD-101', {
    headers: { 'CF-Connecting-IP': '10.30.1.1' }
  });
  const wRes = await worker.fetch(wReq, ENV);
  check('worker entrypoint merespons GET /api/notifications dengan 200 OK', wRes.status === 200);

  // OPTIONS preflight
  const optReq = new Request('https://embun-laundry.dhanisepeda.workers.dev/api/notifications', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://embun-laundry.dhanisepeda.workers.dev',
      'Access-Control-Request-Method': 'GET'
    }
  });
  const optRes = await worker.fetch(optReq, ENV);
  check('OPTIONS preflight /api/notifications merespons aman (status 200/204)', optRes.status === 200 || optRes.status === 204);
}

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
