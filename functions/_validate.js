// functions/_validate.js
//
// B2 — Validasi & sanitasi input sisi server.
//
// Sebelum modul ini ada, setiap handler membaca `body.x` mentah dan
// langsung memakainya: panjang tak terbatas, tipe tak diperiksa, dan nilai
// enum (mis. `status`, `type`) hanya dijaga oleh kebetulan. Yang paling
// berisiko bukan injeksi (sudah di-parameterisasi di B7), melainkan:
//   1. string raksasa yang dikirim ke TiDB,
//   2. angka negatif / tak hingga pada harga dan diskon,
//   3. nilai enum asing yang membuat baris tak pernah cocok.
//
// Modul ini menyediakan satu fungsi `validate(body, spec)` yang mengembalikan
// objek hasil — TIDAK melempar — supaya handler tetap bisa menjawab
// `{ ok: false }` dengan rapi (kontrak A4).

import { jsonResponse } from './_db.js';

// Karakter kontrol (NUL..US, DEL) tidak pernah bermakna dalam data bisnis
// dan sering dipakai untuk menyelundupkan header/log. Ganti jadi spasi.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/** Bersihkan string: buang karakter kontrol, rapikan spasi, trim. */
export function cleanStr(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
}

/** Format email sederhana namun cukup: satu @, domain bertitik, panjang wajar. */
export function isEmail(value) {
  return value.length > 5 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Tanggal `YYYY-MM-DD` yang benar-benar ada di kalender. */
export function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Waktu `YYYY-MM-DD HH:MM:SS` (detik dan menit boleh dihilangkan) — cocok
 * dengan kolom MySQL `DATETIME`.
 *
 * B16 — `promos.expires_at` bertipe DATETIME dan dulu divalidasi sebagai
 * `type:'str'` dengan `max: 32`. Terbukti di produksi: `expires_at:
 * "besok-saja"` (10 karakter, jadi "lolos" pembatasan panjang) diteruskan ke
 * TiDB dan berujung **500**, bukan 400. Panjang tidak pernah bisa
 * menggantikan pemeriksaan format.
 *
 * Detik dan menit sengaja opsional: klien wajar mengirim `"2026-12-31"` atau
 * `"2026-12-31 23:00"` untuk tenggat promo, dan MySQL mengisinya sendiri
 * dengan `00:00:00`.
 */
export function isDateTime(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (!m) return false;
  const y = m[1];
  const mo = m[2];
  const d = m[3];
  const h = m[4] || '00';
  const mi = m[5] || '00';
  const s = m[6] || '00';
  if (Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) return false;
  // Tanggal harus benar-benar ada di kalender: 2026-02-31 bukan tanggal.
  const probe = new Date(`${y}-${mo}-${d}T00:00:00Z`);
  if (Number.isNaN(probe.getTime())) return false;
  const ymd = `${y}-${mo}-${d}`;
  return probe.toISOString().slice(0, 10) === ymd;
}

/**
 * Waktu `HH:MM` atau `HH:MM:SS` — cocok dengan kolom MySQL `TIME`.
 *
 * B15 — `pickup_delivery.start_time`/`end_time` bertipe TIME. Klien yang
 * mengirim `"pagi sekali"` atau `"99:99"` hanya akan berujung pada 500 dari
 * TiDB, bukan 400 dari kita. Detik bersifat opsional karena klien wajar
 * mengirim `"09:00"`.
 */
export function isTime(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) return false;
  return true;
}

/** Angka bulat 32-bit positif yang aman untuk kolom id. */
export function isId(value) {
  return Number.isInteger(value) && value > 0 && value <= 2147483647;
}

class FieldError extends Error {}

function fail(msg) {
  throw new FieldError(msg);
}

/**
 * Validasi satu field menurut spesifikasinya.
 * Melempar FieldError; `validate()` menangkapnya jadi hasil `{ok:false}`.
 */
function checkField(name, spec, raw) {
  const label = spec.label || name;
  const type = spec.type || 'str';

  // 'raw' = string yang TIDAK boleh diubah sedikit pun (kata sandi).
  // `cleanStr()` akan merusak sandi yang mengandung spasi ganda atau spasi di
  // ujung, jadi untuk field ini hanya panjangnya yang diperiksa.
  if (type === 'raw') {
    const text = typeof raw === 'string' ? raw : (raw === null || raw === undefined ? '' : String(raw));
    if (!text) {
      if (spec.required) fail(`${label} wajib diisi`);
      return spec.default !== undefined ? spec.default : '';
    }
    const rawMax = spec.max || 255;
    if (text.length > rawMax) fail(`${label} terlalu panjang (maksimal ${rawMax} karakter)`);
    if (spec.min && text.length < spec.min) fail(`${label} terlalu pendek (minimal ${spec.min} karakter)`);
    return text;
  }

  if (type === 'str' || type === 'email' || type === 'date' || type === 'datetime') {
    // B13 — objek dan array DITOLAK, bukan diubah jadi string. Tanpa
    // penjaga ini `{ "phone": { "n": 1 } }` lolos karena `String({})` adalah
    // "[object Object]" — sebuah string, jadi panjangnya "valid" — dan
    // sampah itu tersimpan di kolom VARCHAR. Angka/boolean masih diterima
    // (koersi wajar untuk klien yang mengirim `phone: 81234567890`).
    if (raw !== null && raw !== undefined && typeof raw === 'object') {
      fail(`Format ${label} tidak valid`);
    }
    const text = cleanStr(raw);
    if (!text) {
      if (spec.required) fail(`${label} wajib diisi`);
      return spec.default !== undefined ? spec.default : '';
    }
    const max = spec.max || 255;
    if (text.length > max) fail(`${label} terlalu panjang (maksimal ${max} karakter)`);
    if (spec.min && text.length < spec.min) fail(`${label} terlalu pendek (minimal ${spec.min} karakter)`);
    if (type === 'email' && !isEmail(text)) fail(`Format ${label} tidak valid`);
    if (type === 'date' && !isDate(text)) fail(`Format ${label} tidak valid (YYYY-MM-DD)`);
    if (type === 'datetime' && !isDateTime(text)) {
      fail(`Format ${label} tidak valid (YYYY-MM-DD HH:MM:SS)`);
    }
    return text;
  }

  if (type === 'int') {
    // B15 — objek dan array DITOLAK untuk angka juga, bukan di-`Number()`.
    // Tanpa penjaga ini `{ "id": [3] }` lolos karena `Number([3])` adalah 3:
    // array berelemen satu menjadi id yang sah, tanpa ada yang memperingatkan.
    // Terbukti pada `assign_courier` dan `delete_task` — keduanya menerima
    // `id: [3]` dan mengubah baris ke-3. (Penjaga serupa untuk `str`/`email`/
    // `date` ditambahkan lebih dulu pada B13.)
    if (raw !== null && raw !== undefined && typeof raw === 'object') {
      fail(`Format ${label} tidak valid`);
    }
    const num = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
    if (!Number.isFinite(num)) {
      if (spec.required) fail(`${label} wajib diisi`);
      return spec.default !== undefined ? spec.default : 0;
    }
    if (!Number.isInteger(num)) fail(`${label} harus berupa angka bulat`);
    const min = spec.min !== undefined ? spec.min : 0;
    const max = spec.max !== undefined ? spec.max : 2147483647;
    if (num < min || num > max) fail(`${label} di luar rentang yang diizinkan (${min}–${max})`);
    return num;
  }

  // 'time' = `HH:MM` / `HH:MM:SS` untuk kolom MySQL TIME. Diperkenalkan B15
  // untuk `pickup_delivery.start_time`/`end_time`.
  if (type === 'time') {
    if (raw !== null && raw !== undefined && typeof raw === 'object') {
      fail(`Format ${label} tidak valid`);
    }
    const text = cleanStr(raw);
    if (!text) {
      if (spec.required) fail(`${label} wajib diisi`);
      return spec.default !== undefined ? spec.default : '';
    }
    if (!isTime(text)) fail(`Format ${label} tidak valid (HH:MM)`);
    return text;
  }

  if (type === 'enum') {
    const text = cleanStr(raw);
    if (!text) {
      if (spec.required) fail(`${label} wajib diisi`);
      return spec.default !== undefined ? spec.default : spec.values[0];
    }
    if (!spec.values.includes(text)) fail(`${label} tidak valid`);
    return text;
  }

  if (type === 'bool') {
    if (raw === undefined) return spec.default !== undefined ? spec.default : 0;
    return raw === true || raw === 1 || raw === '1' || raw === 'true' ? 1 : 0;
  }

  fail(`Tipe field ${label} tidak dikenali`);
}

/**
 * @param {object} body  objek JSON hasil `readJson()`
 * @param {object} spec  { namaField: { type, required, max, ... } }
 * @returns {{ok: true, data: object} | {ok: false, msg: string}}
 */
export function validate(body, spec) {
  const data = {};
  try {
    for (const [name, fieldSpec] of Object.entries(spec)) {
      data[name] = checkField(name, fieldSpec, body?.[name]);
    }
  } catch (e) {
    if (e instanceof FieldError) return { ok: false, msg: e.message };
    throw e;
  }
  return { ok: true, data };
}

/** Jawaban 400 seragam untuk kegagalan validasi. */
export function validationError(msg) {
  return jsonResponse({ ok: false, msg: `Validasi gagal: ${msg}` }, 400);
}

/**
 * Gabungan `validate()` + jawaban 400 — bentuk yang dipakai handler.
 * @returns {{ok: true, data: object} | {ok: false, response: Response}}
 */
export function validateOr400(body, spec) {
  const result = validate(body, spec);
  if (!result.ok) return { ok: false, response: validationError(result.msg) };
  return result;
}

// Spesifikasi yang dipakai bersama oleh beberapa handler.
export const STATUS_ORDER = ['baru', 'proses', 'selesai', 'batal'];

export const SPEC = {
  personName: { type: 'str', required: true, max: 120, min: 2, label: 'Nama' },
  phone: { type: 'str', max: 30, label: 'Telepon' },
  address: { type: 'str', max: 500, label: 'Alamat' },
  id: { type: 'int', required: true, min: 1, label: 'ID' }
};

// B16 — spesifikasi yang panjangnya mengikuti LEBAR KOLOM TiDB
// (`functions/_schema.js`), bukan angka yang dikira-kira.
//
// Sengaja BERDIRI SENDIRI, bukan menggantikan `SPEC`: batas di `SPEC` dipakai
// handler yang menulis ke banyak tabel sekaligus atau yang batasnya memang
// bukan lebar kolom; mengubahnya akan menggeser perilaku yang sudah
// diverifikasi B2.
import { col } from './_schema.js';

export const COL_SPEC = Object.freeze({
  userName: col('users.full_name', 'Nama lengkap', { required: true, min: 2 }),
  userPhone: col('users.phone', 'Telepon'),
  userEmail: col('users.email', 'Email'),

  serviceCode: col('services.code', 'Kode'),
  serviceName: col('services.name', 'Nama', { required: true, min: 2 }),
  serviceCategory: col('services.category', 'Kategori'),
  serviceBadge: col('services.badge', 'Badge'),

  customerName: col('customers.full_name', 'Nama', { required: true, min: 2 }),
  customerPhone: col('customers.phone', 'Telepon'),
  customerAddress: col('customers.address', 'Alamat'),

  // `customer_name` pada `create_order` TIDAK wajib — staf boleh membiarkannya
  // kosong dan nama diambil dari sesi. Karena itu `required` tidak ditaruh di
  // sini; `update_order` menambahkannya sendiri lewat spread.
  orderCustomerName: col('orders.customer_name', 'Nama pelanggan'),
  orderCustomerPhone: col('orders.customer_phone', 'Telepon pelanggan'),
  orderCustomerAddress: col('orders.customer_address', 'Alamat pelanggan'),

  promoCode: col('promos.code', 'Kode'),
  promoName: col('promos.name', 'Nama', { required: true, min: 2 })
});
