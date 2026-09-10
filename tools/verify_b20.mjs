// Harness verifikasi B20 — jumlah bayar dibatasi oleh sisa tagihan.
//
// ===========================================================================
// Kenapa layak dicurigai SEBELUM diukur
// ===========================================================================
// `POST /api/pay` membuat baris `payments` dengan `amount` yang dikirim
// klien. Sejak B14 nilainya DIBATASI BENTUKNYA: `int`, 1..100.000.000.
// Sejak B17 ia WAJIB SESInya. Yang tidak pernah ditanyakan: **berapakah
// batas yang benar untuk pesanan ini?**
//
// Batas 100.000.000 bukan batas bisnis — ia batas supaya kolom INT tidak
// meluap. Padahal setiap pesanan punya batas yang sesungguhnya, yaitu
// `total_amount`. Karena batas itu tidak pernah dipakai:
//
//   1. Satu pesanan Rp 60.000 bisa dibayar Rp 100.000.000 dalam satu
//      permintaan -> `payments` menjumlah Rp 100.000.000 untuk tagihan
//      Rp 60.000. `status` barisnya 'pending', tetapi jumlahnya nyata.
//   2. Tanpa batas per pesanan, permintaan yang sama bisa DIULANG
//      tanpa henti — 1000 kali Rp 100.000.000 = Rp 100 miliar pada satu
//      pesanan. Tidak ada yang berhenti di situ.
//
// Kenapa ini lebih dari sekadar "angka aneh":
//   - `payments` adalah catatan uang yang masuk. Kasir menyetorkan uang
//     berdasarkan jumlah baris ini; bila ia bisa diisi dari luar, ia
//     tidak lagi bisa dipakai untuk rekonsiliasi.
//   - `orders.paid_amount` dan `payment_status` di layar pelanggan
//     (`/pay`, `/track`) dihitung dari tabel ini. Nilai yang membengkak
//     membuat pesanan tampak lunas berlipat.
//   - Laporan piutang (`/api/reports`) mengurangi `paid_amount` dari
//     `total_amount`.
//
// Yang TIDAK diklaim: ini bukan pencurian uang sungguhan (metodenya
// 'manual'/'pending', tanpa gateway). Yang diklaim: catatan pembayaran
// bisa diisi tanpa batas oleh siapa pun yang punya sesi, dan itu cukup
// untuk merusak rekonsiliasi.
//
// ===========================================================================
// Yang diukur
// ===========================================================================
// Bukan status respons, melainkan **parameter INSERT yang benar-benar
// terkirim** — pelajaran B17: 200/400 tidak pernah membuktikan apa yang
// tersimpan. Kontraknya:
//
//   1. Bayar pas (Rp 60.000 dari tagihan Rp 60.000) -> tetap 200.
//      Jalur sukses tidak boleh mati.
//   2. Bayar LEBIH dari sisa -> 400 dan NOL baris terkirim.
//   3. Bayar pas lalu bayar lagi -> kali kedua 400, NOL baris.
//   4. `paid_amount` yang sudah ada DIKURANGI dari sisa.
//   5. Baris `pending` yang sudah ada juga DIKURANGI — kalau tidak,
//      uji nomor 3 lolos hanya dengan mengulang permintaan.
//   6. Pesanan yang sudah lunas -> 400.
//   7. Validasi BENTUK (B14) dan sesi (B17) tidak boleh ikut longgar.
//
// Jebakan yang sengaja dihindari:
//   - Mock DB harus MEMILAH jawaban per tabel. Bila semua query dijawab
//     baris yang sama, uji "pesanan tidak ditemukan" menjadi HIJAU PALSU.
//   - Sisa tagihan harus dihitung dari `total_amount` DAN `paid_amount`
//     DAN jumlah `pending`. Menguji hanya salah satunya memberi harness
//     yang berlubang.
//
// Jalankan:  node tools/verify_b20_run.mjs

import { onRequest as pay } from '../functions/api/pay.js';
import { createSessionToken } from '../functions/_db.js';
import { __calls } from './mock_tidb.mjs';

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

// Tagihan pesanan uji. Angkanya SENGAJA jauh dari apa pun yang dikirim
// klien, supaya kalau handler mengabaikan tagihan, hasilnya tidak mungkin
// kebetulan sama.
const TOTAL = 60000;

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

/**
 * Keadaan pesanan yang bisa diubah per bagian uji.
 * `paid`    = orders.paid_amount (sudah dicatat sebagai lunas)
 * `pending` = jumlah baris payments berstatus 'pending' yang belum dihapus
 */
const state = { paid: 0, pending: 0, failPayments: false };

function order() {
  return {
    id: 60001,
    order_code: 'ORD-TEST20',
    customer_name: 'Budi Santoso',
    service_id: 1,
    weight_kg: 3,
    total_amount: TOTAL,
    paid_amount: state.paid,
    payment_status: state.paid >= TOTAL ? 'paid' : (state.paid > 0 ? 'partial' : 'unpaid')
  };
}

globalThis.__MOCK_ROWS = (sql) => {
  const s = String(sql).replace(/\s+/g, ' ');
  if (/FROM payments/i.test(s)) {
    if (state.failPayments) throw new Error('DB down');
    // Handler memakai `COALESCE(SUM(amount),0) AS outstanding`, jadi baris
    // tiruan HARUS memuat kunci `outstanding`. Mengembalikan `{amount}` saja
    // membuat handler membaca 0 dan seluruh uji batas menjadi HIJAU PALSU.
    return [{ outstanding: state.pending }];
  }
  if (/FROM orders/i.test(s)) return [order()];
  return [];
};

/** Baris INSERT INTO payments yang benar-benar terkirim. */
const payInserts = () => __calls.filter(c => /INSERT INTO payments/i.test(String(c.sql)));

/**
 * Ambil nilai sebuah kolom dari INSERT pembayaran.
 *
 * Daftar kolom dibaca dari teks SQL-nya sendiri, dan nilai `?` dipetakan
 * dengan MENGHITUNG placeholder di klausa VALUES — bukan dengan mengasumsikan
 * params[i] berpasangan dengan kolom[i]. Ini penting karena INSERT ini
 * menyisipkan literal (`'manual'`, `'pending'`) di tengah daftar; pemetaan
 * naif membuat harness mengukur `qr_payload` saat diminta `amount`, dan
 * menghasilkan MERAH/HIJAU yang sama-sama bohong.
 */
function colOf(call, name) {
  if (!call) return undefined;
  const sql = String(call.sql).replace(/\s+/g, ' ');
  const m = sql.match(/INSERT INTO payments\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*)\)/i);
  if (!m) return undefined;
  const cols = m[1].split(',').map(s => s.trim());
  const tokens = m[2].split(',').map(s => s.trim());
  let p = 0;
  for (let i = 0; i < cols.length; i++) {
    const tok = tokens[i] || '';
    if (tok === '?') {
      if (cols[i] === name) return call.params[p];
      p++;
    }
  }
  return undefined;
}

async function postPay(cookie, body = {}) {
  __calls.length = 0;
  const payload = { order_code: 'ORD-TEST20', amount: 10000, method: 'CASH', ...body };
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = `session_token=${cookie}`;
  const res = await pay({
    request: new Request(BASE + '/api/pay', {
      method: 'POST', headers, body: JSON.stringify(payload)
    }),
    env: ENV, ctx: {}
  });
  let json = null; let text = '';
  try { text = await res.text(); json = JSON.parse(text); } catch { /* bukan JSON */ }
  const ins = payInserts();

  // SIMULASI KETERUSTAAN: bila baris benar-benar terkirim, permintaan
  // BERIKUTNYA harus melihatnya. Tanpa ini, uji [2] ("bayar pas dua kali")
  // mengukur dunia yang mustahil — baris pertama menghilang begitu saja —
  // dan penjaga yang benar pun tampak gagal. Karena itu sisa dihitung ulang
  // dari `pending` yang kini bertambah, persis seperti TiDB yang sesungguhnya.
  if (res.status === 200 && ins.length === 1) {
    state.pending += Number(colOf(ins[0], 'amount')) || 0;
  }

  return { status: res.status, json, text, ins };
}

const staffTok = await createSessionToken(
  { id: 1, full_name: 'Admin Uji', role: 'Admin', email: 'admin@gmail.com' }, ENV);
const ownerTok = await createSessionToken(
  { id: 2, full_name: 'Budi Santoso', role: 'Customer', email: 'budi@gmail.com' }, ENV);
const otherTok = await createSessionToken(
  { id: 3, full_name: 'Siti Aminah', role: 'Customer', email: 'siti@gmail.com' }, ENV);

// ===========================================================================
// [0] Kontrol — jalur yang sudah benar harus tetap benar
// ===========================================================================

console.log('\n[0] Kontrol — sesi & jalur normal');

{
  state.paid = 0; state.pending = 0;
  const r = await postPay(null, { amount: TOTAL });
  check('tanpa sesi -> 401 (B17 tidak boleh ikut terbuka)',
    r.status === 401, `status=${r.status} ${r.text.slice(0, 80)}`);
  check('tanpa sesi -> nol INSERT pembayaran',
    r.ins.length === 0, JSON.stringify(r.ins.map(c => String(c.sql).slice(0, 40))));
}

{
  state.paid = 0; state.pending = 0;
  const r = await postPay(otherTok, { amount: TOTAL });
  check('pelanggan asing -> 401 (B17)',
    r.status === 401, `status=${r.status}`);
  check('pelanggan asing -> nol INSERT pembayaran',
    r.ins.length === 0, `inserts=${r.ins.length}`);
}

{
  // Bayar PAS: tagihan 60000, dibayar 60000. Ini jalur yang sah dan tidak
  // boleh mati gara-gara pengetatan.
  state.paid = 0; state.pending = 0;
  const r = await postPay(ownerTok, { amount: TOTAL });
  check('pemilik bayar pas 60000 -> 200',
    r.status === 200, `status=${r.status} ${r.text.slice(0, 80)}`);
  check('pemilik bayar pas 60000 -> satu baris terkirim',
    r.ins.length === 1, `inserts=${r.ins.length}`);
  check('pemilik bayar pas 60000 -> amount tersimpan 60000',
    colOf(r.ins[0], 'amount') === TOTAL, `tersimpan=${colOf(r.ins[0], 'amount')}`);
}

{
  // Bayar SEBAGIAN: 20000 dari 60000 jelas sah (cicilan).
  state.paid = 0; state.pending = 0;
  const r = await postPay(ownerTok, { amount: 20000 });
  check('pemilik bayar sebagian 20000 -> 200',
    r.status === 200, `status=${r.status}`);
  check('pemilik bayar sebagian 20000 -> amount tersimpan 20000',
    colOf(r.ins[0], 'amount') === 20000, `tersimpan=${colOf(r.ins[0], 'amount')}`);
}

// ===========================================================================
// [1] Bayar LEBIH dari tagihan
// ===========================================================================

console.log('\n[1] Jumlah melebihi tagihan ditolak');

{
  state.paid = 0; state.pending = 0;
  const r = await postPay(ownerTok, { amount: 100000000 });
  check('bayar 100000000 dari tagihan 60000 -> 400',
    r.status === 400, `status=${r.status} ${r.text.slice(0, 80)}`);
  check('bayar 100000000 -> NOL baris terkirim',
    r.ins.length === 0, `inserts=${r.ins.length}`);
}

{
  // Lebih sedikit, tetapi tetap di atas tagihan. Ini yang paling mudah lolos
  // bila penjaga hanya menolak nilai "ekstrem".
  state.paid = 0; state.pending = 0;
  const r = await postPay(ownerTok, { amount: TOTAL + 1 });
  check(`bayar ${TOTAL + 1} dari tagihan ${TOTAL} -> 400`,
    r.status === 400, `status=${r.status}`);
  check(`bayar ${TOTAL + 1} -> NOL baris terkirim`,
    r.ins.length === 0, `inserts=${r.ins.length}`);
}

{
  // Staf pun tidak boleh: "kasir" bukan berarti boleh menulis angka bebas.
  state.paid = 0; state.pending = 0;
  const r = await postPay(staffTok, { amount: 100000000 });
  check('staf bayar 100000000 -> 400',
    r.status === 400, `status=${r.status}`);
  check('staf bayar 100000000 -> NOL baris terkirim',
    r.ins.length === 0, `inserts=${r.ins.length}`);
}

// ===========================================================================
// [2] Pengulangan — batas per pesanan, bukan per permintaan
// ===========================================================================

console.log('\n[2] Permintaan kedua atas pesanan yang sama ditolak');

{
  // Bayar pas, lalu bayar pas lagi. Tanpa batas per pesanan, yang kedua
  // tetap 200 dan menjumlah 120000 untuk tagihan 60000.
  state.paid = 0; state.pending = 0;
  const a = await postPay(ownerTok, { amount: TOTAL });
  const b = await postPay(ownerTok, { amount: TOTAL });
  check('bayar pas lalu bayar pas lagi -> kali pertama 200',
    a.status === 200, `status=${a.status}`);
  check('bayar pas lalu bayar pas lagi -> kali kedua 400',
    b.status === 400, `status=${b.status} ${b.text.slice(0, 80)}`);
  check('bayar pas lalu bayar pas lagi -> kali kedua NOL baris',
    b.ins.length === 0, `inserts=${b.ins.length}`);
}

{
  // Tiga kali 30000 = 90000 untuk tagihan 60000.
  state.paid = 0; state.pending = 0;
  const a = await postPay(ownerTok, { amount: 30000 });
  const b = await postPay(ownerTok, { amount: 30000 });
  const c = await postPay(ownerTok, { amount: 30000 });
  check('3 x 30000 -> kali pertama 200', a.status === 200, `status=${a.status}`);
  check('3 x 30000 -> kali ketiga 400', c.status === 400, `status=${c.status}`);
  check('3 x 30000 -> total baris terkirim 2, bukan 3',
    a.ins.length + b.ins.length + c.ins.length === 2,
    `baris=${a.ins.length + b.ins.length + c.ins.length}`);
}

// ===========================================================================
// [3] Sisa dihitung dari paid_amount DAN baris pending
// ===========================================================================

console.log('\n[3] Sisa tagihan mengurangi yang sudah dibayar');

{
  // Sudah lunas separuh: 45000 dari 60000. Sisa 15000.
  state.paid = 45000; state.pending = 0;
  const ok = await postPay(ownerTok, { amount: 15000 });
  const over = await postPay(ownerTok, { amount: 15001 });
  check('paid 45000, bayar 15000 (pas sisa) -> 200',
    ok.status === 200, `status=${ok.status}`);
  check('paid 45000, bayar 15001 (lebih 1) -> 400',
    over.status === 400, `status=${over.status}`);
  check('paid 45000, bayar 15001 -> NOL baris',
    over.ins.length === 0, `inserts=${over.ins.length}`);
}

{
  // Sudah lunas penuh: sisa 0, jadi pembayaran sekecil apa pun salah.
  state.paid = TOTAL; state.pending = 0;
  const r = await postPay(ownerTok, { amount: 1 });
  check('pesanan lunas, bayar 1 -> 400',
    r.status === 400, `status=${r.status}`);
  check('pesanan lunas -> NOL baris terkirim',
    r.ins.length === 0, `inserts=${r.ins.length}`);
}

{
  // Baris PENDING yang sudah ada wajib dihitung. Ini yang membuat uji [2]
  // punya gigi: tanpa ini, "bayar pas dua kali" lolos karena paid_amount
  // belum pernah ditulis oleh siapa pun.
  state.paid = 0; state.pending = 45000;
  const ok = await postPay(ownerTok, { amount: 15000 });
  const over = await postPay(ownerTok, { amount: 15001 });
  check('pending 45000, bayar 15000 -> 200',
    ok.status === 200, `status=${ok.status}`);
  check('pending 45000, bayar 15001 -> 400',
    over.status === 400, `status=${over.status}`);
}

// ===========================================================================
// [4] Kegagalan baca riwayat -> gagal tertutup
// ===========================================================================

console.log('\n[4] Riwayat pembayaran tak terbaca -> jangan menulis');

{
  state.paid = 0; state.pending = 0; state.failPayments = true;
  const r = await postPay(ownerTok, { amount: 10000 });
  check('SELECT payments gagal -> NOL baris terkirim',
    r.ins.length === 0, `inserts=${r.ins.length}`);
  check('SELECT payments gagal -> bukan 200',
    r.status !== 200, `status=${r.status}`);
  state.failPayments = false;
}

// ===========================================================================
// [5] Regresi — validasi bentuk (B14) & metode tidak boleh berubah
// ===========================================================================

console.log('\n[5] Regresi B14 — bentuk angka tetap diperiksa');

{
  state.paid = 0; state.pending = 0;
  const r = await postPay(ownerTok, { amount: 0 });
  check('amount 0 -> 400', r.status === 400, `status=${r.status}`);
}

{
  state.paid = 0; state.pending = 0;
  const r = await postPay(ownerTok, { amount: [1, 2] });
  check('amount array -> 400', r.status === 400, `status=${r.status}`);
}

{
  state.paid = 0; state.pending = 0;
  const r = await postPay(ownerTok, { method: 'BITCOIN' });
  check('method di luar enum -> 400', r.status === 400, `status=${r.status}`);
}

{
  state.paid = 0; state.pending = 0;
  const r = await postPay(ownerTok, { order_code: 'X'.repeat(5000) });
  check('order_code 5000 karakter -> 400', r.status === 400, `status=${r.status}`);
}

{
  state.paid = 0; state.pending = 0;
  const r = await postPay(staffTok, { amount: 20000, method: 'TRANSFER' });
  check('staf bayar 20000 TRANSFER -> 200 (kasir tetap jalan)',
    r.status === 200, `status=${r.status}`);
  check('staf bayar 20000 -> amount tersimpan 20000',
    colOf(r.ins[0], 'amount') === 20000, `tersimpan=${colOf(r.ins[0], 'amount')}`);
  check('staf bayar 20000 -> method tersimpan TRANSFER',
    colOf(r.ins[0], 'method') === 'TRANSFER', `tersimpan=${colOf(r.ins[0], 'method')}`);
}

console.log(`\nHASIL: ${pass}/${pass + fail} hijau, ${fail} merah`);
process.exit(fail === 0 ? 0 : 1);
