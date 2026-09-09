// functions/_password.js
//
// B8 — Migrasi hash sandi: PBKDF2-HMAC-SHA256 via WebCrypto.
//
// ===========================================================================
// Kenapa ini perlu (diukur, bukan dikira)
// ===========================================================================
// `tools/probe_hash.mjs` + `tools/probe_schema.mjs` terhadap TiDB produksi:
//   - 9 pengguna, 8 di antaranya hash SHA-256 64-hex (1 baris debug 'testhash')
//   - kolom `password_hash` VARCHAR(255) → cukup untuk format baru (~86 char)
//   - terbukti COCOK: hash admin@gmail.com == sha256('admin123' + 'dhani-salt')
//
// Artinya: SATU kali SHA-256 dengan salt global yang tertulis di sumber.
// Salt global membuat satu tabel pelangi bisa dipakai untuk seluruh pengguna,
// dan satu SHA-256 praktis gratis untuk GPU (miliaran per detik).
//
// Format baru:
//   pbkdf2-sha256$<iterasi>$<salt base64url>$<hash base64url>
//   contoh: pbkdf2-sha256$10000$3x...$9F...   (panjang ± 86 char)
//
// Iterasi sengaja disematkan DI DALAM hash: kalau nanti batas CPU Workers
// diketahui lebih longgar, konstanta di bawah cukup dinaikkan — hash lama
// tetap terverifikasi dengan nilai iterasinya sendiri, dan pengguna
// ter-upgrade otomatis pada login berikutnya (lazy upgrade di login.js).
//
// ===========================================================================
// Kenapa 10.000 iterasi, bukan 600.000 (rekomendasi OWASP)
// ===========================================================================
// Workers menghitung CPU time, bukan wall clock. Ambang rencana gratis
// 10 ms CPU/permintaan. Hasil `node tools/bench_pbkdf2.mjs` (Node 22,
// mesin ini):
//     10.000 →  3,44 ms   20.000 →  6,16 ms   50.000 → 13,66 ms
//    100.000 → 25,24 ms  200.000 → 47,81 ms  600.000 → 139,73 ms
// `change_password` memanggil hash 2× (sandi lama + baru). Pada 10.000
// iterasi itu ~6,9 ms CPU → masih di bawah 10 ms. Pada 20.000 sudah 12,3 ms
// → akan MENGGAGALKAN ganti sandi di rencana gratis.
// Jadi 10.000 adalah nilai terbesar yang aman untuk dua-duanya (login 1×,
// ganti sandi 2×). Ini tetap ~10.000× lipat biaya dibanding kondisi
// sekarang, dan salt acak 16 byte per pengguna membuat tabel pelangi
// (yang kini berlaku untuk SEMUA pengguna) jadi tidak berguna.
// Naikkan konstanta ini bila batas CPU sudah dipastikan lebih longgar.

const PBKDF2_ITERATIONS = 10000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/** Penanda format. Dipakai juga untuk deteksi hash lawas. */
export const HASH_PREFIX = 'pbkdf2-sha256';

/** Salt lawas yang tertulis di sumber — hanya untuk verifikasi data lama. */
const LEGACY_SALT = 'dhani-salt';

// ---------------------------------------------------------------------------
// Utilitas
// ---------------------------------------------------------------------------

/** Uint8Array → base64url (tanpa padding). */
function toB64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url → Uint8Array. */
function fromB64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Perbandingan yang waktunya tidak bergantung pada posisi beda.
 * (Bukan `===` yang bisa berhenti di byte pertama.)
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// API publik
// ---------------------------------------------------------------------------

/**
 * Hash sandi dengan PBKDF2-HMAC-SHA256 + salt acak per pengguna.
 * @param {string} password
 * @returns {Promise<string>} `pbkdf2-sha256$<iterasi>$<salt>$<hash>`
 */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_BYTES * 8
  );
  return `${HASH_PREFIX}$${PBKDF2_ITERATIONS}$${toB64Url(salt)}$${toB64Url(new Uint8Array(bits))}`;
}

/**
 * Apakah `stored` sudah berformat PBKDF2 baru?
 * Dipakai login.js untuk memutuskan perlu upgrade atau tidak.
 */
export function isPbkdf2Hash(stored) {
  return typeof stored === 'string' && stored.startsWith(HASH_PREFIX + '$');
}

/**
 * Verifikasi sandi terhadap hash tersimpan.
 *
 * Menerima format baru DAN semua format lawas yang masih hidup di produksi,
 * supaya migrasi tidak mengunci pengguna yang belum pernah login ulang:
 *   1. `pbkdf2-sha256$...`            → PBKDF2 (format baru)
 *   2. `$2y$ / $2a$ / $2b$`           → bcrypt lewat bcryptjs (best effort)
 *   3. sama persis (seed lawas/debug) → plaintext
 *   4. sha256(password + 'dhani-salt')→ format yang dipakai produksi hari ini
 *   5. sha256(password)               → format lawas tanpa salt
 *
 * Selalu mengembalikan boolean; TIDAK pernah melempar.
 */
export async function verifyPassword(password, stored) {
  if (!stored || password == null) return false;

  try {
    // --- 1. Format baru: PBKDF2 ---
    if (isPbkdf2Hash(stored)) {
      const parts = stored.split('$');
      if (parts.length !== 4) return false;
      const iterations = parseInt(parts[1], 10);
      if (!Number.isFinite(iterations) || iterations < 1000 || iterations > 10000000) return false;
      const salt = fromB64Url(parts[2]);
      const expected = fromB64Url(parts[3]);

      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(String(password)),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        key,
        expected.length * 8
      );
      return timingSafeEqual(new Uint8Array(bits), expected);
    }

    // --- 2. bcrypt (best effort: butuh bcryptjs ter-bundle) ---
    if (stored.startsWith('$2')) {
      try {
        const bcrypt = await import('bcryptjs');
        return await bcrypt.compare(String(password), stored);
      } catch (e) {
        return false;
      }
    }

    // --- 3. Plaintext (seed lawas & baris debug; harus HAPUS, bukan abaikan) ---
    if (password === stored) return true;

    // --- 4. sha256(password + 'dhani-salt') — format produksi hari ini ---
    if (await sha256Hex(String(password) + LEGACY_SALT) === stored) return true;

    // --- 5. sha256(password) tanpa salt ---
    if (await sha256Hex(String(password)) === stored) return true;

    return false;
  } catch (e) {
    return false;
  }
}
