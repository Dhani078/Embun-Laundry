// functions/_today.js
//
// B12 — "hari ini" menurut jam operasional, BUKAN menurut UTC.
//
// Mengapa modul ini ada:
// `functions/api/checkin.js` menghitung hari dengan
// `new Date().toISOString().split('T')[0]`. `toISOString()` SELALU UTC.
// Cloudflare Workers berjalan di UTC, sedangkan operasional laundry berada di
// Asia/Jakarta (UTC+7). Akibatnya antara pukul 00:00 dan 06:59 WIB — saat
// toko justru mulai buka — "hari ini" menurut kode adalah **kemarin**.
//
// Terbukti dengan `tools/verify_b12_run.mjs` pada kode lama:
//   06:00 WIB (23:00 UTC hari sebelumnya) -> hari terkirim 2026-09-10,
//   padahal hari Asia/Jakarta saat itu 2026-09-11.
// Dampaknya nyata dan dua arah: check-in pagi tercatat di baris kemarin,
// sehingga penjaga "sudah check-in hari ini" tidak pernah melihatnya dan
// hari yang sama bisa menghasilkan DUA baris.
//
// Catatan untuk tick berikutnya: pola ini (`toISOString().split('T')[0]`)
// dipakai juga di `functions/api/delivery.js` untuk `schedule_date`.
// Di sana ia hanya dipakai sebagai NILAI BAWAAN saat klien tidak mengirim
// tanggal, jadi tidak ada penjaga "sudah ada" yang bergantung padanya —
// jauh lebih tidak berbahaya. Tetapi bila nanti ada fitur "jadwal hari ini"
// atau "tugas yang jatuh tempo hari ini", perbaiki juga dengan modul ini.

/** Zona waktu operasional aplikasi (WIB). */
export const APP_TZ = 'Asia/Jakarta';

/**
 * Tanggal hari ini (`YYYY-MM-DD`) di zona waktu operasional.
 *
 * `en-CA` dipakai karena format lokalnya persis `YYYY-MM-DD`; ini bukan
 * aksi bahasa, melainkan cara paling hemat untuk meminta format ISO dari
 * `Intl` tanpa merangkai string sendiri dari potongan tanggal.
 *
 * @param {Date} [now]  waktu acuan (disuntikkan oleh harness uji)
 * @param {string} [tz] zona waktu; bawaan `Asia/Jakarta`
 * @returns {string}
 */
export function todayIn(now = new Date(), tz = APP_TZ) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
  } catch (e) {
    // `Intl` tanpa data zona waktu hanya terjadi di runtime yang ganjil.
    // Jangan sampai satu kegagalan format menghentikan check-in: jatuh ke
    // perilaku lama (UTC). Salah jam masih lebih baik daripada error 500,
    // dan kejadiannya akan tampak sebagai lonjakan baris di log.
    return now.toISOString().split('T')[0];
  }
}
