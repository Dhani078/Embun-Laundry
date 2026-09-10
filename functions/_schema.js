// functions/_schema.js
//
// B16 — LEBAR KOLOM AKTUAL TiDB, sebagai SATU sumber kebenaran.
//
// Latar belakang, dan kenapa berkas ini perlu ada:
//
// Sejak B2 (tick 11) batas panjang ditulis SEBARIS di setiap spesifikasi
// validasi — `max: 120`, `max: 30`, `max: 500`. Angka-angka itu tidak pernah
// dibandingkan dengan lebar kolom yang sesungguhnya. Akibatnya dua arah:
//
//   - TERLALU LONGGAR -> klien menerima **500**, bukan 400. Nilai melewati
//     validasi kita, lalu ditolak TiDB. Ini yang paling merugikan: klien
//     tidak tahu field mana yang salah, dan log server penuh 500.
//   - TERLALU KETAT   -> input sah ditolak mentah-mentah.
//
// Dua arah itu diukur di produksi pada tick ini (bukan ditebak), dengan nilai
// batas: nilai N diterima 200, N+1 menghasilkan 500. Hasilnya persis menyamai
// `DATABASE_SCHEMA.md`. Yang TIDAK ikut diukur: `services.description`,
// `pickup_delivery.address`, dan `pickup_delivery.notes` — ketiganya TEXT,
// jadi tak terjangkau probe dan tidak pernah menghasilkan 500.
//
// Kenapa harus satu berkas, bukan perbaikan setempat: kalau suatu hari skema
// berubah (mis. `services.name` VARCHAR(80) diperlebar jadi 120 karena ada
// layanan bernama panjang), perubahannya dilakukan di SATU tempat. Kalau
// tersebar di enam handler, yang terjadi justru seperti tempo hari: beberapa
// modul benar, sisanya ketinggalan tanpa ada yang memperhatikan.
//
// CATATAN PENTING: konstanta di sini adalah lebar AKTUAL hasil ukur, bukan
// salinan `DATABASE_SCHEMA.md`. Bila keduanya berbeda, yang berlaku adalah
// hasil ukur terhadap TiDB (dan selisihnya wajib dicatat di AGENT_LOG.md).

/**
 * Lebar maksimum per kolom, dalam bentuk `tabel.kolom`.
 *
 * Hanya kolom yang DITULIS lewat API yang dicantumkan — lebar kolom yang
 * hanya dibaca (`SELECT`) tidak pernah bisa menghasilkan 500.
 */
export const COL = Object.freeze({
  'users.full_name': 100,
  'users.email': 120,
  'users.phone': 30,

  'services.code': 20,
  'services.name': 80,
  'services.category': 20,
  'services.badge': 30,

  'customers.full_name': 120,
  'customers.phone': 32,
  'customers.address': 255,

  'orders.customer_name': 100,
  'orders.customer_phone': 32,
  'orders.customer_address': 255,

  'promos.code': 32,
  'promos.name': 120
});

/**
 * Ambil lebar kolom. Sengaja MELEMPAR bila kuncinya tidak dikenal: kunci
 * yang salah ketik lebih baik gagal saat modul dipakai (deploy batal, nyata
 * terlihat) daripada diam-diam menjadi batas yang ngawur.
 */
export function colWidth(key) {
  const n = COL[key];
  if (!n) throw new Error(`_schema: kolom "${key}" tidak terdaftar`);
  return n;
}

/**
 * Spesifikasi field teks yang panjangnya mengikuti lebar kolom.
 *
 * `max` diambil dari `COL`, tetapi bisa DIPERKECIL lewat `max` pada `extra`
 * bila ada alasan bisnis (mis. kode voucher sengaja pendek). Yang TIDAK
 * boleh adalah memperbesar — itu akan mengembalikan 500 yang baru saja
 * diperbaiki.
 */
export function col(key, label, extra = {}) {
  const width = colWidth(key);
  const capped = extra.max !== undefined ? Math.min(extra.max, width) : width;
  return { type: 'str', label, ...extra, max: capped };
}
