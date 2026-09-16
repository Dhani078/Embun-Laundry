// tools/verify_c4.mjs
// Harness verifikasi Task C4 — Upload Bukti Pembayaran (Cloudflare R2 / base64 kecil — P3)
//
// Menguji:
// 1. Audit berkas migrasi database: 0006_add_proof_image_to_payments.sql (ALTER TABLE & ROLLBACK).
// 2. Audit validasi backend functions/api/pay.js:
//    - Memvalidasi tipe MIME aman (image/jpeg, image/png, image/webp).
//    - Menolak format berbahaya (SVG/HTML/Script).
//    - Menolak ukuran muatan melebihi batas (~1.5MB).
//    - Memastikan proof_image masuk sebagai placeholder SQL parameter ?, bukan string concat.
// 3. Uji runtime POST /api/pay dengan muatan bukti transfer:
//    - PNG base64 valid -> diterima (200).
//    - SVG berbahaya -> ditolak (400).
//    - Teks HTML -> ditolak (400).
//    - String ukuran raksasa -> ditolak (400).
// 4. Audit antarmuka pelanggan (public/pay.html):
//    - Pemilihan metode pembayaran (QRIS, TRANSFER, DANA, dll).
//    - Dropzone dan input file bukti transfer.
//    - Pratinjau gambar dan penanganan resize via canvas di sisi klien.
//    - Pengiriman riil POST /api/pay dengan bukti transfer & kunci idempotensi.
// 5. Audit antarmuka staf (public/app.js):
//    - Method App.viewPaymentProof(orderCode) dan modal pratinjau bukti transfer.
//    - Tombol "🖼️ Bukti" pada daftar pesanan.
//    - Sanitasi XSS esc() pada data bukti.
//
// Jalankan: node tools/verify_c4_run.mjs

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
// 1. Audit Berkas Migrasi Database
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit Berkas Migrasi Database');

const migPath = path.join(ROOT, 'db', 'migrations', '0006_add_proof_image_to_payments.sql');
check('berkas migrasi 0006_add_proof_image_to_payments.sql ada', fs.existsSync(migPath));

const migSql = fs.existsSync(migPath) ? fs.readFileSync(migPath, 'utf8') : '';
check(
  'migrasi memuat ALTER TABLE payments ADD COLUMN proof_image MEDIUMTEXT',
  /ALTER\s+TABLE\s+payments\s+ADD\s+COLUMN\s+proof_image\s+MEDIUMTEXT/i.test(migSql)
);
check(
  'migrasi memuat petunjuk rollback',
  /ROLLBACK/i.test(migSql) && /DROP\s+COLUMN\s+proof_image/i.test(migSql)
);

// ---------------------------------------------------------------------------
// 2. Audit Statik Kode Backend functions/api/pay.js
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Audit Kode Statik pay.js');

const payCode = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'pay.js'), 'utf8');

check('pay.js menerima field proof_image di validasi', payCode.includes('proof_image'));
check('pay.js memvalidasi regex tipe data image (jpeg|png|webp|jpg)', 
  payCode.includes('data:image') && payCode.includes('jpeg|png|webp|jpg'));
check('pay.js memiliki batas ukuran payload bukti pembayaran', payCode.includes('2200000') || payCode.includes('2000000'));
check('pay.js menyertakan proof_image pada query INSERT INTO payments', 
  /INSERT\s+INTO\s+payments\s*\([^)]*proof_image[^)]*\)/i.test(payCode));
check('pay.js mengembalikan proof_image pada respons JSON pembayaran', 
  payCode.includes('proof_image: proofImage') || payCode.includes('proof_image,'));

// ---------------------------------------------------------------------------
// 3. Uji Runtime Validasi Bukti Pembayaran pada POST /api/pay
// ---------------------------------------------------------------------------
console.log('\n# Bagian 3 — Uji Runtime Validasi Bukti Pembayaran');

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret-c4' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

const userToken = await createSessionToken(
  { id: 7, full_name: 'Dewi Sartika', role: 'Customer', email: 'dewi@gmail.com' }, ENV
);

const staffToken = await createSessionToken(
  { id: 1, full_name: 'Kasir Utama', role: 'Staff', email: 'kasir@gmail.com' }, ENV
);

const testOrder = {
  id: 301,
  user_id: 7,
  order_code: 'ORD-C4-TEST',
  customer_name: 'Dewi Sartika',
  total_amount: 50000,
  paid_amount: 0,
  payment_status: 'unpaid'
};

function setupMock(order = testOrder) {
  resetMockCalls();
  globalThis.__MOCK_ROWS = (sql) => {
    if (/SELECT.*FROM orders WHERE order_code/i.test(sql)) return [order];
    if (/SELECT.*COALESCE\(SUM\(amount\)/i.test(sql)) return [{ outstanding: 0 }];
    if (/SELECT.*FROM payments WHERE idempotency_key/i.test(sql)) return [];
    if (/UPDATE orders/i.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO payments/i.test(sql)) return { affectedRows: 1 };
    if (/INSERT INTO notifications/i.test(sql)) return { affectedRows: 1 };
    return [];
  };
}

async function postPayment(body, token = userToken) {
  setupMock();
  const req = new Request(BASE + '/api/pay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_token=${token}`
    },
    body: JSON.stringify(body)
  });
  const res = await payHandler({ request: req, env: ENV });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// 1. Gambar 1x1 pixel PNG valid
const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const r1 = await postPayment({
  order_code: 'ORD-C4-TEST',
  method: 'TRANSFER',
  amount: 25000,
  proof_image: validPng
});
check('Bukti transfer PNG valid -> DITERIMA (200)', r1.status === 200 && r1.data.ok === true);
check('Respons memuat proof_image yang dikirimkan', r1.data.proof_image === validPng);

// Pastikan query INSERT menyimpan proof_image via placeholder ?
const payInsertCall = __calls.find(c => /INSERT INTO payments/i.test(c.sql));
check('INSERT INTO payments memakai parameter ? untuk proof_image', 
  payInsertCall && payInsertCall.params.includes(validPng));
check('Teks base64 tidak di-concatenate ke string SQL langsung', 
  payInsertCall && !payInsertCall.sql.includes('data:image/png'));

// 2. Format berbahaya: SVG dengan script
const maliciousSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=';
const r2 = await postPayment({
  order_code: 'ORD-C4-TEST',
  method: 'TRANSFER',
  amount: 25000,
  proof_image: maliciousSvg
});
check('Format SVG (berpotensi XSS) -> DITOLAK (400)', r2.status === 400 && r2.data.ok === false);

// 3. Format bukan gambar: HTML
const fakeHtml = 'data:text/html;base64,PGgxPkhhY2tlZDwvaDE+';
const r3 = await postPayment({
  order_code: 'ORD-C4-TEST',
  method: 'TRANSFER',
  amount: 25000,
  proof_image: fakeHtml
});
check('Format data text/html -> DITOLAK (400)', r3.status === 400 && r3.data.ok === false);

// 4. Format string acak bukan data URI
const invalidStr = 'gambar_struk_palsu.jpg';
const r4 = await postPayment({
  order_code: 'ORD-C4-TEST',
  method: 'TRANSFER',
  amount: 25000,
  proof_image: invalidStr
});
check('Format string bukan data URI -> DITOLAK (400)', r4.status === 400 && r4.data.ok === false);

// 5. Muatan ukuran raksasa (>2.2MB)
const hugeProof = 'data:image/jpeg;base64,' + 'A'.repeat(2300000);
const r5 = await postPayment({
  order_code: 'ORD-C4-TEST',
  method: 'TRANSFER',
  amount: 25000,
  proof_image: hugeProof
});
check('Muatan bukti melebihi 2.2MB -> DITOLAK (400)', r5.status === 400 && r5.data.ok === false);

// 6. Pembayaran tanpa bukti transfer tetap diizinkan (opsional untuk tunai/QRIS)
const r6 = await postPayment({
  order_code: 'ORD-C4-TEST',
  method: 'QRIS',
  amount: 10000
});
check('Pembayaran tanpa bukti gambar (QRIS/tunai) -> DITERIMA (200)', r6.status === 200 && r6.data.ok === true);

// ---------------------------------------------------------------------------
// 4. Audit Frontend Pelanggan public/pay.html
// ---------------------------------------------------------------------------
console.log('\n# Bagian 4 — Audit Frontend pay.html');

const payHtml = fs.readFileSync(path.join(ROOT, 'public', 'pay.html'), 'utf8');

check('pay.html memiliki tombol pemilih metode pembayaran', payHtml.includes('method-pill'));
check('pay.html memiliki elemen dropzone unggah bukti', payHtml.includes('class="dropzone"'));
check('pay.html memiliki elemen input file proofInput', payHtml.includes('id="proofInput"'));
check('pay.html membatasi accept file ke image/jpeg,image/png,image/webp', 
  payHtml.includes('accept="image/jpeg,image/png,image/webp"'));
check('pay.html memiliki wadah pratinjau bukti proofPreviewWrap', payHtml.includes('id="proofPreviewWrap"'));
check('pay.html memiliki fungsi processImageFile dengan kompresi kanvas', 
  payHtml.includes('processImageFile(') && payHtml.includes('canvas.toDataURL'));
check('pay.html mengirimkan proof_image ke POST /api/pay', 
  payHtml.includes('proof_image: base64Proof'));
check('pay.html tidak lagi memakai alert() dummy untuk konfirmasi', !payHtml.includes('alert(\'Pembayaran diverifikasi!'));

// ---------------------------------------------------------------------------
// 5. Audit Frontend Staf public/app.js
// ---------------------------------------------------------------------------
console.log('\n# Bagian 5 — Audit Frontend app.js');

const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');

check('app.js mendefinisikan App.viewPaymentProof', appJs.includes('viewPaymentProof('));
check('app.js menampilkan modal proofModal untuk melihat bukti', appJs.includes('id = \'proofModal\''));
check('app.js memiliki tombol 🖼️ Bukti pada renderPesanan', appJs.includes('btn-view-proof') && appJs.includes('viewPaymentProof'));
check('app.js menerapkan esc() pada orderCode dan method', 
  appJs.includes('esc(orderCode)') && appJs.includes('esc(p.method)'));

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log('');
console.log(`HASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} ${pass}/${pass + fail}`);

if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
