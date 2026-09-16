// Harness verifikasi Fase 0.7 — Race-Safe POST /api/pay & Idempotency Key (K5)
//
// Menguji pembaruan atomik kolom paid_amount di level basis data untuk mencegah
// overpayment / double counting pada saat lonjakan transaksi simultan, serta memastikan
// idempotency_key mencegah pembayaran berulang dengan muatan yang sama.
//
// Jalankan: node tools/verify_fase0_7_run.mjs

import fs from 'node:fs';
import path from 'node:path';
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

// ---------------------------------------------------------------------------
// Bagian 1 — Audit Berkas Migrasi Database (0003_add_idempotency_key_to_payments.sql)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit Berkas Migrasi Database');

const migPath = path.join(ROOT, 'db', 'migrations', '0003_add_idempotency_key_to_payments.sql');
check('berkas migrasi 0003_add_idempotency_key_to_payments.sql ada', fs.existsSync(migPath));

const migSql = fs.existsSync(migPath) ? fs.readFileSync(migPath, 'utf8') : '';
check(
  'migrasi memuat ALTER TABLE payments ADD COLUMN idempotency_key',
  /ALTER\s+TABLE\s+payments\s+ADD\s+COLUMN\s+idempotency_key\s+VARCHAR\(64\)\s+NULL/i.test(migSql)
);
check(
  'migrasi menambahkan UNIQUE index uq_payments_idempotency_key',
  /ALTER\s+TABLE\s+payments\s+ADD\s+UNIQUE\s+INDEX\s+uq_payments_idempotency_key\s*\(idempotency_key\)/i.test(migSql)
);
check(
  'migrasi memuat petunjuk rollback',
  /ROLLBACK/i.test(migSql) && /DROP\s+COLUMN\s+idempotency_key/i.test(migSql)
);

// ---------------------------------------------------------------------------
// Bagian 2 — Audit Kode Statik functions/api/pay.js
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Audit Kode Statik');

const payCode = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'pay.js'), 'utf8');

check(
  'pay.js menggunakan UPDATE atomic paid_amount = paid_amount + ?',
  /paid_amount\s*=\s*paid_amount\s*\+\s*\?/.test(payCode)
);
check(
  'pay.js memiliki penjaga batas WHERE paid_amount + ? <= total_amount',
  /paid_amount\s*\+\s*\?\s*<=\s*total_amount/.test(payCode)
);
check(
  'pay.js memeriksa affectedRows === 0 / rowsAffected === 0 untuk menolak race',
  /affectedRows\s*===\s*0/.test(payCode) || /rowsAffected\s*===\s*0/.test(payCode)
);
check(
  'pay.js memvalidasi atau membaca idempotency_key',
  /idempotency_key/.test(payCode)
);
check(
  'pay.js menyertakan idempotency_key pada INSERT INTO payments',
  /INSERT\s+INTO\s+payments\s*\([^)]*idempotency_key[^)]*\)/i.test(payCode)
);

// ---------------------------------------------------------------------------
// Bagian 3 — Uji Runtime Idempotensi & Penanganan Race Condition
// ---------------------------------------------------------------------------
console.log('\n# Bagian 3 — Uji Runtime Idempotensi & Race Safety');

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret-k5' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

const userToken = await createSessionToken(
  { id: 10, full_name: 'Budi Santoso', role: 'Customer', email: 'budi@gmail.com' }, ENV
);

const testOrder = {
  id: 501,
  user_id: 10,
  order_code: 'ORD-RACE-01',
  customer_name: 'Budi Santoso',
  total_amount: 100000,
  paid_amount: 0,
  status: 'baru',
  payment_status: 'unpaid'
};

function mkReq(body, headers = {}) {
  return new Request(BASE + '/api/pay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_token=${userToken}`,
      ...headers
    },
    body: JSON.stringify(body)
  });
}

// 1. Uji Idempotensi: Pengiriman berulang dengan idempotency_key yang sama
{
  resetMockCalls();
  let existingPaymentRecord = null;

  globalThis.__MOCK_ROWS = (sql) => {
    if (/FROM orders/i.test(sql)) return [testOrder];
    if (/FROM payments WHERE idempotency_key/i.test(sql)) {
      return existingPaymentRecord ? [existingPaymentRecord] : [];
    }
    if (/FROM payments/i.test(sql)) return [{ outstanding: 0 }];
    return [];
  };

  // Panggilan pertama: Memproses pembayaran baru
  const res1 = await payHandler({
    request: mkReq({
      order_code: 'ORD-RACE-01',
      amount: 50000,
      method: 'QRIS',
      idempotency_key: 'IDEMP-KEY-TEST-001'
    }),
    env: ENV
  });
  check('Panggilan pertama idempotensi -> status 200', res1.status === 200);
  const body1 = await res1.json();
  check('Panggilan pertama mengembalikan qr_payload', !!body1.qr_payload);

  // Set bahwa baris pembayaran sudah ada di database untuk kunci tersebut
  existingPaymentRecord = {
    id: 1001,
    amount: 50000,
    qr_payload: body1.qr_payload
  };

  // Panggilan kedua dengan kunci yang sama persis
  resetMockCalls();
  const res2 = await payHandler({
    request: mkReq({
      order_code: 'ORD-RACE-01',
      amount: 50000,
      method: 'QRIS',
      idempotency_key: 'IDEMP-KEY-TEST-001'
    }),
    env: ENV
  });
  check('Panggilan kedua dengan idempotency_key sama -> status 200', res2.status === 200);
  const body2 = await res2.json();
  check('Panggilan kedua mengembalikan flag idempotent: true', body2.idempotent === true);
  check('Panggilan kedua mengembalikan qr_payload yang sama', body2.qr_payload === body1.qr_payload);

  const updatesSecondCall = __calls.filter(c => /UPDATE orders/i.test(c.sql));
  const insertsSecondCall = __calls.filter(c => /INSERT INTO payments/i.test(c.sql));
  check('Panggilan kedua TIDAK mengeksekusi UPDATE orders ganda', updatesSecondCall.length === 0);
  check('Panggilan kedua TIDAK mengeksekusi INSERT payments ganda', insertsSecondCall.length === 0);
}

// 2. Uji Penolakan Race Condition (Simulasi 0 affectedRows dari DB row guard)
{
  resetMockCalls();
  globalThis.__MOCK_ROWS = (sql) => {
    if (/FROM orders/i.test(sql)) return [testOrder];
    if (/WHERE idempotency_key/i.test(sql)) return [];
    if (/FROM payments/i.test(sql)) return [{ outstanding: 0 }];
    if (/UPDATE orders/i.test(sql)) {
      // Simulasikan TiDB menolak UPDATE karena batas tagihan telah dilampaui
      // oleh permintaan lain yang masuk milidetik sebelumnya
      return { affectedRows: 0, rowsAffected: 0 };
    }
    return [];
  };

  const resRace = await payHandler({
    request: mkReq({
      order_code: 'ORD-RACE-01',
      amount: 50000,
      method: 'CASH',
      idempotency_key: 'IDEMP-RACE-002'
    }),
    env: ENV
  });
  check('Saat atomic UPDATE gagal (affectedRows = 0) -> DITOLAK 400', resRace.status === 400);
  const bodyRace = await resRace.json();
  check('Pesan penolakan race jelas', bodyRace.msg?.includes('Validasi gagal'));

  const insertsAfterRace = __calls.filter(c => /INSERT INTO payments/i.test(c.sql));
  check('NOL baris payments ter-insert saat atomic update ditolak', insertsAfterRace.length === 0);
}

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL FASE 0.7: HIJAU ${pass}, MERAH ${fail} (${pass}/${pass + fail})`);
if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
