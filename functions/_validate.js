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

  if (type === 'str' || type === 'email' || type === 'date') {
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
    return text;
  }

  if (type === 'int') {
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
