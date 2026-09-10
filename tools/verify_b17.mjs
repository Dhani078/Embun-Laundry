// Harness verifikasi B17 — celah autentikasi pada POST /api/pay.
//
// PERTANYAAN YANG DIJAWAB: "kalau aku tidak login, bolehkah aku MENULIS
// baris pembayaran atas pesanan orang lain?" Jawaban yang benar: tidak.
//
// Latar belakang (ditemukan tick 25, diukur di produksi):
//   GET  /api/pay  sengaja publik — halaman pembayaran dibuka lewat kode
//                  pesanan, dan ia SUDAH menyensor telepon & alamat (B10).
//   POST /api/pay  TIDAK punya pemeriksaan sesi sama sekali. Padahal tidak
//                  ada satu pun halaman yang memanggilnya (public/pay.html
//                  hanya GET). Jadi ini adalah titik TULIS terbuka: siapa
//                  pun bisa membuat baris `payments` untuk pesanan siapa pun.
//
// Cara ukur: panggil handler SUNGGUHAN dengan driver DB tiruan
// (tools/mock_tidb.mjs) yang MENCATAT setiap SQL beserta params-nya, lalu
// periksa:
//   1. tanpa sesi      -> 401 dan NOL INSERT terkirim;
//   2. sesi pelanggan  -> 401 bila pesanan bukan miliknya, 200 bila miliknya;
//   3. sesi staf       -> 200 (jalur sukses tidak boleh mati).
//
// Mengapa INSERT diukur, bukan sekadar status: status 401 yang dikembalikan
// SETELAH `db.execute()` tetap meninggalkan baris di database. Yang
// dipertaruhkan di sini adalah penulisan, jadi yang diukur harus INSERT.
//
// Jalankan:  node tools/verify_b17_run.mjs

import { onRequest as pay } from '../functions/api/pay.js';
import { createSessionToken } from '../functions/_db.js';
import { __calls } from './mock_tidb.mjs';

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

// Pesanan milik "Budi Santoso". Dipakai untuk membedakan pemilik & orang lain.
const ORDER = {
  id: 60001,
  order_code: 'ORD-TEST01',
  customer_name: 'Budi Santoso',
  customer_phone: '081234567890',
  customer_address: 'Jl. Melati 12',
  service_id: 1,
  weight_kg: 3,
  price_per_kg: 20000,
  discount: 0,
  total_amount: 60000,
  paid_amount: 0,
  payment_status: 'unpaid',
  status: 'baru'
};

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

function req(method, path, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = `session_token=${cookie}`;
  return new Request(BASE + path, { method, headers });
}

/**
 * Jawab setiap SELECT sesuai konteksnya, bukan dengan baris seragam.
 * - SELECT orders by order_code -> pesanan ORDER (bila kodenya cocok)
 * - SELECT payments             -> [] (belum ada pembayaran)
 * Pemilahan ini penting: kalau semua query dijawab baris yang sama, uji
 * "pesanan tidak ditemukan" akan HIJAU PALSU karena row selalu ada.
 */
globalThis.__MOCK_ROWS = (sql) => {
  if (/FROM orders/i.test(sql)) return [ORDER];
  if (/FROM payments/i.test(sql)) return [];
  return [];
};

const inserts = () => __calls.filter(c => /INSERT INTO payments/i.test(c.sql));

async function postPay(cookie, body = {}) {
  __calls.length = 0;
  const payload = {
    order_code: 'ORD-TEST01',
    amount: 10000,
    method: 'CASH',
    ...body
  };
  const request = new Request(BASE + '/api/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  // Cookie disisipkan lewat Request kedua bila ada sesi.
  const finalReq = cookie
    ? new Request(BASE + '/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': `session_token=${cookie}` },
        body: JSON.stringify(payload)
      })
    : request;
  const res = await pay({ request: finalReq, env: ENV, ctx: {} });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, sql: [...__calls] };
}

// Token uji: satu staf, satu pelanggan pemilik, satu pelanggan asing.
//
// BENTUK OBJEKNYA WAJIB mengikuti `createSessionToken()` di _db.js, bukan
// bentuk JWT-nya: `user_name` diambil dari `full_name`, dan peran dari
// `role` — BUKAN `user_role`. Kalau harness mengirim `user_role`, token staf
// akan lahir sebagai "Customer" dan uji [4] MERAH karena kesalahan harness,
// bukan karena kode produksi. Ini calon HIJAU PALSU yang berlawanan.
const staffTok = await createSessionToken(
  { id: 1, full_name: 'Admin Uji', role: 'Admin' }, ENV
);
const ownerTok = await createSessionToken(
  { id: 7, full_name: 'Budi Santoso', role: 'Customer' }, ENV
);
const otherTok = await createSessionToken(
  { id: 8, full_name: 'Orang Lain', role: 'Customer' }, ENV
);

console.log('\n[1] tanpa sesi: TIDAK BOLEH menulis pembayaran');
{
  const r = await postPay(null);
  check('anonim -> 401', r.status === 401, `status=${r.status}`);
  check('anonim -> nol INSERT payments terkirim',
    inserts().length === 0, `insert=${inserts().length}`);
  check('anonim -> pesan tidak membocorkan detail',
    r.json?.msg !== 'Pesanan tidak ditemukan', `msg=${r.json?.msg}`);
  check('anonim -> tidak ada qr_payload dikembalikan',
    !r.json?.qr_payload, `qr=${r.json?.qr_payload}`);
}

console.log('\n[2] pelanggan ASING: tidak boleh menulis atas pesanan orang lain');
{
  const r = await postPay(otherTok);
  check('pelanggan asing -> 401', r.status === 401, `status=${r.status}`);
  check('pelanggan asing -> nol INSERT payments terkirim',
    inserts().length === 0, `insert=${inserts().length}`);
}

console.log('\n[3] pelanggan PEMILIK: boleh menulis atas pesanannya sendiri');
{
  const r = await postPay(ownerTok);
  check('pemilik -> 200', r.status === 200, `status=${r.status}`);
  check('pemilik -> satu INSERT payments terkirim',
    inserts().length === 1, `insert=${inserts().length}`);
  check('pemilik -> INSERT memakai id pesanan yang benar',
    inserts()[0]?.params?.[0] === ORDER.id, `param0=${inserts()[0]?.params?.[0]}`);
  check('pemilik -> jumlah tersimpan sesuai input (10000)',
    inserts()[0]?.params?.[2] === 10000, `amount=${inserts()[0]?.params?.[2]}`);
}

console.log('\n[4] staf: boleh menulis atas pesanan siapa pun (fitur kasir)');
{
  const r = await postPay(staffTok);
  check('staf -> 200', r.status === 200, `status=${r.status}`);
  check('staf -> satu INSERT payments terkirim',
    inserts().length === 1, `insert=${inserts().length}`);
}

console.log('\n[5] jalur GET publik TIDAK BOLEH ikut tertutup (regresi B10/C2)');
{
  __calls.length = 0;
  const res = await pay({
    request: req('GET', '/api/pay?order_code=ORD-TEST01', null),
    env: ENV, ctx: {}
  });
  const json = await res.json();
  check('GET anonim -> 200 (halaman pembayaran tetap jalan)',
    res.status === 200, `status=${res.status}`);
  check('GET anonim -> telepon TIDAK dikirim',
    json?.order?.customer_phone === null || json?.order?.customer_phone === undefined,
    `phone=${json?.order?.customer_phone}`);
  check('GET anonim -> alamat TIDAK dikirim',
    json?.order?.customer_address === null || json?.order?.customer_address === undefined,
    `addr=${json?.order?.customer_address}`);
  check('GET anonim -> total tetap dikirim (halaman butuh)',
    json?.order?.total_amount === ORDER.total_amount,
    `total=${json?.order?.total_amount}`);
}

console.log('\n[6] validasi tetap berlaku bagi yang berhak (B14 tidak boleh hilang)');
{
  const r = await postPay(staffTok, { amount: 0 });
  check('staf amount=0 -> 400', r.status === 400, `status=${r.status}`);
  check('staf amount=0 -> nol INSERT', inserts().length === 0, `insert=${inserts().length}`);

  const r2 = await postPay(staffTok, { method: 'BTC' });
  check('staf method=BTC -> 400', r2.status === 400, `status=${r2.status}`);
}

console.log(`\nHASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} (${pass}/${pass + fail})`);
if (fail > 0) process.exitCode = 1;
