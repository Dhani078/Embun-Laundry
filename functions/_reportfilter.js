// functions/_reportfilter.js
//
// B11 — SATU penjaga rentang tanggal untuk laporan.
//
// Mengapa modul ini ada:
// `/api/reports` menyusun SQL-nya sendiri dan menyisipkan nilai `?start=` /
// `?end=` ke dalam klausa BETWEEN SETELAH digabung string `' 00:00:00'` /
// `' 23:59:59'`. Tidak ada satu pun verifier yang pernah melihatnya, karena
// `verify_b7` (kanari SQL) dan `verify_b10` (IDOR) tidak memanggil reports.
// `/api/orders` SUDAH benar (memakai regex `YYYY-MM-DD` sejak B2) — jadi ini
// bukan pola baru, melainkan SATU tempat yang tertinggal.
//
// `tools/audit_sql_injection.py` TIDAK menemukannya karena aturannya:
// "sebuah nilai dianggap aman kalau sudah melewati cleanStr()/String()".
// Itu asumsi yang benar untuk placeholder `?` (B7), tetapi reports
// menyambung string, jadi `cleanStr()` saja tidak cukup. Pelajaran untuk
// tick berikutnya tercatat di AGENT_STATE.md: pembersihan ≠ validasi format.
//
// Nilai yang dikembalikan adalah string `YYYY-MM-DD HH:MM:SS` yang SUDAH
// lengkap, sehingga pemanggil tidak perlu lagi menyambung apa pun.

import { cleanStr, isDate } from './_validate.js';

/**
 * Baca & validasi `?start=`/`?end=` dari URLSearchParams.
 *
 * Kontrak:
 *   - keduanya kosong            -> { ok: true, cond: '', params: [] }  (semua waktu)
 *   - keduanya `YYYY-MM-DD` sah  -> klausa `created_at BETWEEN ? AND ?`
 *   - salah satu tidak sah       -> { ok: false, msg } (pemanggil balas 400)
 *
 * Mengapa salah-satu-kosong juga gagal: dulu itu berarti "tanpa batas",
 * sehingga laporan bisa diminta sepanjang masa hanya dengan menghapus satu
 * parameter. Untuk laporan, rentang tak lengkap adalah kesalahan klien.
 *
 * @param {URLSearchParams} sp
 * @param {number} [maxDays=3660] rentang maksimal yang diizinkan (hari)
 */
export function dateRange(sp, maxDays = 3660) {
  // `cleanStr` dulu supaya karakter kontrol & spasi ganda tidak lolos,
  // lalu `slice(0, 10)` memotong usaha mengirim string panjang.
  const rawStart = cleanStr(sp.get('start') || '').slice(0, 10);
  const rawEnd = cleanStr(sp.get('end') || '').slice(0, 10);

  const askStart = !!rawStart;
  const askEnd = !!rawEnd;

  // Tidak diminta sama sekali -> seluruh waktu (perilaku lama yang sah).
  if (!askStart && !askEnd) return { ok: true, cond: '', params: [] };

  // Diminta sebelah -> minta lengkap. Sebelumnya ini jatuh ke "tanpa batas".
  if (askStart !== askEnd) {
    return { ok: false, msg: 'Rentang tanggal tidak lengkap: start dan end harus diisi berdua (YYYY-MM-DD)' };
  }

  // Format betulan, bukan sekadar "sudah dibersihkan". `isDate()` juga
  // menolak 2026-02-31 (tanggal yang tidak pernah ada di kalender).
  if (!isDate(rawStart)) return { ok: false, msg: 'Format start tidak valid (YYYY-MM-DD)' };
  if (!isDate(rawEnd)) return { ok: false, msg: 'Format end tidak valid (YYYY-MM-DD)' };

  // Rentang wajar: mencegah satu permintaan yang menyapu bertahun-tahun
  // baris sekaligus (jalur DoS paling murah di endpoint agregat).
  // `T00:00:00Z` (UTC) dipakai supaya perhitungan selisih tidak bergeser
  // karena zona waktu mesin; beda hari saja yang penting di sini.
  const ms = new Date(rawEnd + 'T00:00:00Z') - new Date(rawStart + 'T00:00:00Z');
  const days = Math.floor(ms / 86400000);
  if (days < 0) return { ok: false, msg: 'Rentang tanggal terbalik: start harus sebelum end' };
  if (days > maxDays) return { ok: false, msg: `Rentang tanggal terlalu panjang (maksimal ${maxDays} hari)` };

  return {
    ok: true,
    cond: ' AND created_at BETWEEN ? AND ?',
    // Nilai dikembalikan SUDAH berformat datetime lengkap supaya pemanggil
    // tidak perlu menyambung string lagi (sumber nilai mentah pada B11).
    params: [rawStart + ' 00:00:00', rawEnd + ' 23:59:59']
  };
}
