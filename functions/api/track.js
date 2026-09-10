// functions/api/track.js
//
// C2 — Pelacakan pesanan publik berdasarkan kode pesanan (TANPA login).
//
// ===========================================================================
// Kenapa endpoint ini butuh disiplin khusus (bukan sekadar SELECT biasa)
// ===========================================================================
// `pay.js` sudah mencatat fakta penting: kode pesanan berbentuk
// `ORD-<base36 waktu><3 karakter acak>` → hanya ~46 ribu kemungkinan per
// milidetik. Artinya kode pesanan BUKAN rahasia yang kuat; ia bisa ditebak.
//
// Jadi endpoint publik yang menerima kode saja harus gagal tertutup secara
// default. Tiga penjaga yang dipasang di sini:
//
//   1. PROYEKSI IZIN (allowlist), bukan `...order`.
//      Kolom dikirim satu per satu. Kalau nanti ada kolom baru di tabel
//      `orders` (mis. `internal_note`), ia TIDAK akan ikut bocor ke publik
//      hanya karena kita lupa. Ini sengaja berlawanan dengan kebiasaan
//      `SELECT o.*` + spread object.
//
//   2. NAMA DISAMARkan. Teks asli `customer_name` tidak pernah keluar.
//      Yang dikirim hanya "Budi S." — cukup bagi pemilik pesanan untuk
//      memastikan ini pesanannya, tidak cukup bagi pemeriksa acak.
//
//   3. RATE LIMIT. Tanpa login, satu IP bisa mencoba puluhan ribu kode.
//      Batasnya memakai modul B1 yang sama (memori + Cache API), jadi
//      konsisten dengan `/api/auth/login` dan tidak butuh binding baru
//      (KV masih terblokir bersama A6).
//
// Yang TIDAK diklaim: ini bukan pembuktian kepemilikan. Siapa pun yang
// mengetahui/berhasil menebak kode masih bisa melihat status — itu memang
// tujuan fitur ini (melacak tanpa akun). Yang diklaim: yang bocor bila kode
// ditebak hanyalah status dan nominal, BUKAN telepon dan alamat.

import { getDb, jsonResponse, readJson, corsOptions, SERVER_ERROR } from '../_db.js';
import { validateOr400 } from '../_validate.js';
import { clientKey, consume, peek } from '../_ratelimit.js';

// Batas lebih longgar dari login (10/5 menit) karena satu pelanggan wajar
// mengecek pesanannya beberapa kali, tetapi tetap jauh di bawah laju tebakan
// yang berguna (46 ribu/milidetik).
const RL_LIMIT = 20;
const RL_WINDOW_MS = 5 * 60 * 1000;
const RL_OPTS = { limit: RL_LIMIT, windowMs: RL_WINDOW_MS };

// Kolom VARCHAR(20) di skema. Lebih dari itu pasti bukan kode yang sah, jadi
// jangan pernah sampai ke TiDB.
const CODE_MAX = 20;

/**
 * Samarkan nama: "Budi Santoso" -> "Budi S.", "Budi" -> "Budi".
 *
 * Dipakai agar pemilik pesanan bisa mengenali pesanannya tanpa kita
 * menyiarkan nama lengkapnya ke siapa pun yang menebak kode.
 */
export function maskName(value) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const parts = text.split(' ');
  const first = parts[0];
  if (parts.length === 1) return first;
  // Hanya huruf/angka pertama dari kata terakhir, jadi "S." bukan "Santoso".
  const initial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${initial}.`;
}

/**
 * Ambil hanya field yang BOLEH dilihat publik.
 * Daftar ini adalah allowlist — kalau tabel bertambah kolom, kolom itu
 * otomatis tidak ikut terkirim.
 */
function publicView(row) {
  const masked = maskName(row.customer_name);
  return {
    order_code: row.order_code,
    customer_name: masked,
    customer_name_masked: masked,
    service_name: row.service_name,
    status: row.status,
    weight_kg: row.weight_kg,
    price_per_kg: row.price_per_kg,
    discount: row.discount,
    total_amount: row.total_amount,
    paid_amount: row.paid_amount,
    payment_status: row.payment_status,
    created_at: row.created_at,
    finished_at: row.finished_at
  };
}

function withRateHeaders(res, remaining, retryAfter) {
  res.headers.set('X-RateLimit-Limit', String(RL_LIMIT));
  res.headers.set('X-RateLimit-Remaining', String(remaining));
  if (retryAfter != null) res.headers.set('Retry-After', String(retryAfter));
  return res;
}

/** Balas dengan angka sisa jatah yang DIUKUR, bukan ditebak (pola B1). */
function reply(key, data, status, retryAfter = null) {
  const { remaining } = peek(key, RL_OPTS);
  return withRateHeaders(jsonResponse(data, status), remaining, retryAfter);
}

export async function onRequestGet({ request, env }) {
  // Rate limit SEBELUM menyentuh database: percobaan yang ditolak tidak
  // boleh menghabiskan koneksi TiDB (alasan sama dengan login.js).
  const key = `track:${clientKey(request)}`;
  const rl = await consume(key, RL_OPTS);
  if (!rl.ok) {
    return reply(
      key,
      { ok: false, msg: 'Terlalu banyak percobaan pelacakan. Coba lagi nanti.' },
      429,
      rl.retryAfter
    );
  }

  const db = await getDb(env);
  if (!db) return reply(key, { ok: false, msg: 'Database tidak terhubung' }, 500);

  try {
    const url = new URL(request.url);
    const raw = { code: url.searchParams.get('code') ?? url.searchParams.get('order_code') ?? '' };

    // Validasi memakai modul B2 yang sama dengan handler lain — jangan
    // menulis pemeriksaan panjang sendiri yang bisa meleset.
    const v = validateOr400(raw, {
      code: { type: 'str', required: true, min: 3, max: CODE_MAX, label: 'Kode pesanan' }
    });
    if (!v.ok) {
      const detail = await v.response.json();
      return reply(key, { ok: false, msg: detail.msg }, v.response.status);
    }
    const { code } = v.data;
    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      return reply(key, { ok: false, msg: 'Validasi gagal: Format kode pesanan tidak valid' }, 400);
    }

    // Parameterized (B7). Kolom dipilih satu per satu — bukan `o.*` — supaya
    // proyeksi publik benar-benar terkendali sejak dari SQL.
    const rows = await db.query(
      `SELECT o.order_code, o.customer_name, o.status, o.weight_kg,
              o.price_per_kg, o.discount, o.total_amount, o.paid_amount,
              o.payment_status, o.created_at, o.finished_at,
              s.name AS service_name
       FROM orders o
       JOIN services s ON s.id = o.service_id
       WHERE o.order_code = ?
       LIMIT 1`,
      [code]
    );

    // 404 tanpa detail: jangan konfirmasi apa pun tentang kode yang salah.
    if (rows.length === 0) {
      return reply(key, { ok: false, msg: 'Pesanan tidak ditemukan' }, 404);
    }

    return reply(key, { ok: true, order: publicView(rows[0]) }, 200);
  } catch (e) {
    // B14 — pesan generik. `e.message` dari driver bisa memuat connection
    // string, nama tabel, dan nomor baris.
    return reply(key, { ok: false, msg: SERVER_ERROR }, 500);
  }
}

// Router mengirim SEMUA metode ke `onRequest`, jadi preflight OPTIONS harus
// dijawab di sini — kalau diteruskan ke `onRequestGet`, browser akan
// menghabiskan jatah rate limit hanya untuk bertanya "bolehkah saya
// memanggil?" (dan preflight yang ditolak 429 membuat seluruh pelacakan
// gagal dari peramban).
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return onRequestOptions();
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
  }
  return onRequestGet({ request, env });
}

export async function onRequestOptions() {
  // B5: tanpa `Access-Control-Allow-Origin` di sini — header yang bergantung
  // pada origin dipasang terpusat oleh applyCors() di src/index.js.
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
