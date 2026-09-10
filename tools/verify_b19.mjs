// Harness verifikasi B19 — pelanggan tidak boleh MENENTUKAN HARGA SENDIRI.
//
// ===========================================================================
// Kenapa layak dicurigai SEBELUM diukur
// ===========================================================================
// `create_order` di `functions/api/orders.js` menerima `price_per_kg` dan
// `discount` LANGSUNG dari body. Batasannya memang ada (B2/B16) — `price_per_kg`
// 0..10.000.000, `discount` 0..100.000.000 — tetapi batas itu hanya soal
// BENTUK, bukan soal HAK. Yang tidak pernah ditanyakan: siapa yang boleh
// mengisi dua angka itu?
//
// `status` saja yang sudah dijaga: non-staf dipaksa `'baru'`. Harga dan diskon
// tidak. Akibatnya pelanggan dapat membuat pesanan dengan total sesuka dia:
//
//   - `price_per_kg: 1`    -> 3 kg laundry seharga Rp 3.000, bukan Rp 60.000.
//   - `discount: 100000000` -> `finalDisc` dipotong ke `subtotal`, jadi
//                              `total_amount` menjadi **0**.
//
// Keduanya bukan sekadar angka aneh: `total_amount` adalah dasar omzet di
// `/api/reports` dan `/api/dashboard`, dan `paid_amount`/piutang di laporan
// dihitung dari selisihnya. Satu permintaan dari akun Customer cukup untuk
// mengotori agregat itu, atau untuk membuat pesanan "lunas" tanpa bayar.
//
// Tidak ada satu pun antarmuka yang mengirim dua field ini: `create_order` di
// `public/app.js` hanya mengirim `customer_name`, `customer_phone`,
// `customer_address`, `service_id`, `weight_kg`, dan `voucher_code`. Jadi
// menutupnya tidak merusak UI mana pun — sama seperti B17.
//
// ===========================================================================
// Yang diukur
// ===========================================================================
// Bukan status respons, melainkan **parameter INSERT yang benar-benar
// terkirim** — pelajaran B17: 200/401 tidak pernah membuktikan apa yang
// tersimpan. Kontraknya:
//
//   1. sesi STAF, `price_per_kg` dikirim  -> harga itu yang tersimpan
//      (jalur sukses tidak boleh mati).
//   2. sesi PELANGGAN, `price_per_kg` dikirim -> harga TIDAK dipakai; yang
//      tersimpan harga dari tabel `services`.
//   3. sesi PELANGGAN, `discount` besar -> `total_amount` tersimpan penuh,
//      bukan 0.
//   4. sesi PELANGGAN, tanpa `price_per_kg` -> tetap harga `services`
//      (perilaku lama yang benar harus tetap benar).
//   5. VOUCHER pelanggan tetap berlaku: diskon dari voucher boleh, diskon
//      sepihak tidak.
//
// Jebakan yang sengaja dihindari:
//   - Uji harga HARUS membedakan SELECT harga layanan dari INSERT pesanan;
//     bila semua query dijawab baris yang sama, harga "tersimpan" bisa
//     kebetulan benar (HIJAU PALSU). Karena itu `__MOCK_ROWS` memilah
//     berdasarkan tabel.
//   - Uji diskon harus memeriksa `total_amount` pada params INSERT, bukan
//     sekadar ada/tidaknya baris.
//
// Jalankan:  node tools/verify_b19_run.mjs

import { onRequest as orders } from '../functions/api/orders.js';
import { createSessionToken } from '../functions/_db.js';
import { __calls } from './mock_tidb.mjs';

const ENV = { TIDB_DATABASE_URL: 'mysql://mock', JWT_SECRET: 'test-secret' };
const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

// Harga layanan sesungguhnya di tabel `services`. Nilai ini SENGAJA jauh dari
// apa pun yang dikirim klien, supaya kalau handler memakai harga klien,
// angkanya tidak mungkin kebetulan sama.
const SERVICE_PRICE = 20000;

// Pesanan tiruan untuk jalur SELECT setelah INSERT.
const NEW_ORDER = {
  id: 777,
  order_code: 'ORD-UJI19',
  customer_name: 'Budi Santoso',
  total_amount: 60000,
  status: 'baru'
};

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
 * Jawab SELECT sesuai tabelnya.
 *  - `services` -> harga SERVICE_PRICE (satu-satunya sumber harga yang sah)
 *  - `orders`   -> NEW_ORDER (dipakai SELECT setelah INSERT)
 *  - selain itu -> []
 */
globalThis.__MOCK_ROWS = (sql) => {
  const s = String(sql).replace(/\s+/g, ' ');
  if (/FROM services/i.test(s)) return [{ price: SERVICE_PRICE }];
  if (/FROM orders/i.test(s)) return [NEW_ORDER];
  if (/FROM user_vouchers/i.test(s)) return [];
  return [];
};

/** Baris INSERT INTO orders yang benar-benar terkirim. */
function orderInsert(calls) {
  return calls.find(c => /INSERT INTO orders/i.test(String(c.sql).replace(/\s+/g, ' ')));
}

/**
 * Ambil nilai sebuah kolom dari INSERT pesanan.
 *
 * Daftar kolom dibaca dari teks SQL-nya sendiri, bukan dari posisi yang
 * dihafal — kalau urutan kolom berubah, harness ini tidak akan diam-diam
 * mengukur kolom yang salah.
 */
function colOf(call, name) {
  if (!call) return undefined;
  const sql = String(call.sql).replace(/\s+/g, ' ');
  const m = sql.match(/INSERT INTO orders\s*\(([^)]*)\)/i);
  if (!m) return undefined;
  const cols = m[1].split(',').map(s => s.trim());
  const idx = cols.indexOf(name);
  if (idx === -1) return undefined;
  return call.params[idx];
}

async function createOrder(cookie, extra = {}) {
  __calls.length = 0;
  const body = {
    action: 'create_order',
    customer_name: 'Budi Santoso',
    customer_phone: '081234567890',
    customer_address: 'Jl. Melati 12',
    service_id: 1,
    weight_kg: 3,
    ...extra
  };
  const res = await orders({ request: req('POST', '/api/orders', body, cookie), env: ENV, ctx: {} });
  let json = null;
  let text = '';
  try { text = await res.text(); json = JSON.parse(text); } catch { /* bukan JSON */ }
  return { status: res.status, json, text, calls: [...__calls] };
}

// Token uji: satu staf, satu pelanggan.
// BENTUK OBJEKNYA mengikuti `createSessionToken()` di _db.js — `{full_name,
// role}`, BUKAN `{user_name, user_role}` (bentuk JWT hasilnya). Salah bentuk
// membuat token staf lahir sebagai "Customer" dan seluruh uji di bawah ini
// menjadi HIJAU PALSU. Lihat catatan tick 25.
const staffTok = await createSessionToken(
  { id: 1, full_name: 'Admin Uji', role: 'Admin', email: 'admin@gmail.com' }, ENV);
const custTok = await createSessionToken(
  { id: 2, full_name: 'Budi Santoso', role: 'Customer', email: 'budi@gmail.com' }, ENV);

// ===========================================================================
// [0] Kontrol — jalur yang sudah benar harus tetap benar
// ===========================================================================

console.log('\n[0] Kontrol — tanpa sesi & jalur normal');

{
  const r = await createOrder(null, {});
  check('tanpa sesi -> 401 (B10/B18 tidak boleh ikut terbuka)',
    r.status === 401, `status=${r.status} ${r.text.slice(0, 80)}`);
  check('tanpa sesi -> nol INSERT pesanan',
    !orderInsert(r.calls), JSON.stringify(r.calls.map(c => String(c.sql).slice(0, 40))));
}

{
  // Pelanggan TANPA menyebut harga: harga harus diambil dari tabel services.
  const r = await createOrder(custTok, {});
  const ins = orderInsert(r.calls);
  check('pelanggan tanpa price_per_kg -> 200',
    r.status === 200, `status=${r.status} ${r.text.slice(0, 80)}`);
  check('pelanggan tanpa price_per_kg -> harga dari tabel services',
    colOf(ins, 'price_per_kg') === SERVICE_PRICE,
    `tersimpan=${colOf(ins, 'price_per_kg')}`);
  check('pelanggan tanpa price_per_kg -> total = 3 x harga layanan',
    colOf(ins, 'total_amount') === 3 * SERVICE_PRICE,
    `total=${colOf(ins, 'total_amount')}`);
}

// ===========================================================================
// [1] STAF boleh menentukan harga (jalur sukses tidak boleh mati)
// ===========================================================================

console.log('\n[1] Staf — harga yang dikirim tetap dipakai');

{
  const r = await createOrder(staffTok, { price_per_kg: 15000 });
  const ins = orderInsert(r.calls);
  check('staf price_per_kg=15000 -> 200',
    r.status === 200, `status=${r.status} ${r.text.slice(0, 80)}`);
  check('staf price_per_kg=15000 -> harga tersimpan 15000',
    colOf(ins, 'price_per_kg') === 15000, `tersimpan=${colOf(ins, 'price_per_kg')}`);
  check('staf price_per_kg=15000 -> total = 45000',
    colOf(ins, 'total_amount') === 45000, `total=${colOf(ins, 'total_amount')}`);
}

// ===========================================================================
// [2] PELANGGAN — harga sepihak TIDAK boleh dipakai
// ===========================================================================

console.log('\n[2] Pelanggan — harga sepihak diabaikan');

{
  const r = await createOrder(custTok, { price_per_kg: 1 });
  const ins = orderInsert(r.calls);
  check('pelanggan price_per_kg=1 -> harga TIDAK tersimpan 1',
    colOf(ins, 'price_per_kg') !== 1, `tersimpan=${colOf(ins, 'price_per_kg')}`);
  check('pelanggan price_per_kg=1 -> harga tersimpan harga layanan',
    colOf(ins, 'price_per_kg') === SERVICE_PRICE,
    `tersimpan=${colOf(ins, 'price_per_kg')}`);
  check('pelanggan price_per_kg=1 -> total = 60000, bukan 3000',
    colOf(ins, 'total_amount') === 3 * SERVICE_PRICE,
    `total=${colOf(ins, 'total_amount')}`);
}

{
  // Harga lebih murah setengahnya — lebih halus dari 1, jadi lebih mudah
  // lolos dari pemeriksaan yang hanya menolak nilai ekstrem.
  const r = await createOrder(custTok, { price_per_kg: 10000 });
  const ins = orderInsert(r.calls);
  check('pelanggan price_per_kg=10000 -> tetap harga layanan',
    colOf(ins, 'price_per_kg') === SERVICE_PRICE,
    `tersimpan=${colOf(ins, 'price_per_kg')}`);
}

// ===========================================================================
// [3] PELANGGAN — diskon sepihak TIDAK boleh dipakai
// ===========================================================================

console.log('\n[3] Pelanggan — diskon sepihak diabaikan');

{
  const r = await createOrder(custTok, { discount: 100000000 });
  const ins = orderInsert(r.calls);
  check('pelanggan discount=100000000 -> diskon tersimpan 0',
    colOf(ins, 'discount') === 0, `tersimpan=${colOf(ins, 'discount')}`);
  check('pelanggan discount=100000000 -> total TIDAK menjadi 0',
    colOf(ins, 'total_amount') === 3 * SERVICE_PRICE,
    `total=${colOf(ins, 'total_amount')}`);
}

{
  // Diskon yang "masuk akal" — 50% — tetap sepihak.
  const r = await createOrder(custTok, { discount: 30000 });
  const ins = orderInsert(r.calls);
  check('pelanggan discount=30000 -> diskon tersimpan 0',
    colOf(ins, 'discount') === 0, `tersimpan=${colOf(ins, 'discount')}`);
  check('pelanggan discount=30000 -> total penuh',
    colOf(ins, 'total_amount') === 3 * SERVICE_PRICE,
    `total=${colOf(ins, 'total_amount')}`);
}

{
  // Kombinasi keduanya: murah sekaligus "gratis".
  const r = await createOrder(custTok, { price_per_kg: 1, discount: 100000000 });
  const ins = orderInsert(r.calls);
  check('pelanggan harga+diskon sepihak -> harga tetap harga layanan',
    colOf(ins, 'price_per_kg') === SERVICE_PRICE,
    `tersimpan=${colOf(ins, 'price_per_kg')}`);
  check('pelanggan harga+diskon sepihak -> total penuh',
    colOf(ins, 'total_amount') === 3 * SERVICE_PRICE,
    `total=${colOf(ins, 'total_amount')}`);
}

// ===========================================================================
// [4] STAF — diskon tetap boleh (penyesuaian kasir adalah fitur)
// ===========================================================================

console.log('\n[4] Staf — diskon manual tetap diizinkan');

{
  const r = await createOrder(staffTok, { discount: 5000 });
  const ins = orderInsert(r.calls);
  check('staf discount=5000 -> diskon tersimpan 5000',
    colOf(ins, 'discount') === 5000, `tersimpan=${colOf(ins, 'discount')}`);
  check('staf discount=5000 -> total = 55000',
    colOf(ins, 'total_amount') === 55000, `total=${colOf(ins, 'total_amount')}`);
}

// ===========================================================================
// [5] Status — penjaga yang sudah ada tidak boleh ikut longgar
// ===========================================================================

console.log('\n[5] Status — pelanggan tetap dipaksa "baru"');

{
  const r = await createOrder(custTok, { status: 'selesai' });
  const ins = orderInsert(r.calls);
  check('pelanggan status=selesai -> tersimpan "baru"',
    colOf(ins, 'status') === 'baru', `tersimpan=${colOf(ins, 'status')}`);
}

{
  const r = await createOrder(staffTok, { status: 'proses' });
  const ins = orderInsert(r.calls);
  check('staf status=proses -> tersimpan "proses"',
    colOf(ins, 'status') === 'proses', `tersimpan=${colOf(ins, 'status')}`);
}

// ===========================================================================
// [6] VOUCHER pelanggan — diskon dari SISTEM tetap berlaku
// ===========================================================================
// Pemeriksaan B19 mematikan `discount` yang datang dari body. Yang TIDAK
// boleh ikut mati ialah diskon dari voucher: ia bukan angka sepihak,
// melainkan baris `user_vouchers` yang diterbitkan sistem. Kalau pengetatan
// itu kelak merambat ke sini, pelanggan kehilangan hak yang sah — jadi
// jalurnya diukur, bukan diasumsikan.

console.log('\n[6] Voucher — diskon dari sistem tetap dipakai pelanggan');

{
  const saved = globalThis.__MOCK_ROWS;
  globalThis.__MOCK_ROWS = (sql) => {
    const s = String(sql).replace(/\s+/g, ' ');
    if (/FROM services/i.test(s)) return [{ price: SERVICE_PRICE }];
    if (/FROM user_vouchers/i.test(s)) {
      return [{
        id: 11, promo_id: 5, code: 'HEMAT10', name: 'Hemat 10%',
        type: 'percent', value: 10, min_spend: 0, max_discount: 0,
        expires_at: null, used_at: null
      }];
    }
    if (/FROM orders/i.test(s)) return [NEW_ORDER];
    return [];
  };

  const r = await createOrder(custTok, { voucher_code: 'hemat10' });
  const ins = orderInsert(r.calls);
  // subtotal = 3 x 20000 = 60000; voucher 10% -> diskon 6000, total 54000.
  check('voucher pelanggan -> diskon tersimpan 6000',
    colOf(ins, 'discount') === 6000, `tersimpan=${colOf(ins, 'discount')}`);
  check('voucher pelanggan -> total = 54000',
    colOf(ins, 'total_amount') === 54000, `total=${colOf(ins, 'total_amount')}`);

  globalThis.__MOCK_ROWS = saved;
}

// ===========================================================================

console.log(`\nHASIL: ${pass}/${pass + fail} hijau, ${fail} merah`);
process.exit(fail === 0 ? 0 : 1);
