// Harness verifikasi B3 — rahasia sesi (JWT_SECRET) harus datang dari
// lingkungan, BUKAN dari literal bawaan di dalam kode.
//
// ===========================================================================
// Kenapa ini layak dicurigai SEBELUM diukur
// ===========================================================================
// `_db.js` menulis:
//
//     const secret = env.JWT_SECRET || 'dhani-laundry-secure-jwt-secret-key-2026';
//
// Kalimat `||` itu tampak seperti "nilai cadangan yang sopan". Padahal dalam
// konteks kriptografi ia adalah **kunci cadangan yang dipublikasikan**:
// `wrangler.toml` ikut ter-commit ke repositori, jadi literal itu bisa
// dibaca siapa pun. Dengan kunci itu, siapa pun bisa menghitung tanda tangan
// HMAC-SHA256 yang sah untuk payload APA PUN — termasuk
// `{ "user_role": "Admin" }` — tanpa perlu punya akun, tanpa menyentuh
// basis data, dan tanpa meninggalkan jejak di log login.
//
// Yang membuatnya lebih berbahaya dari sekadar "ada kunci lemah": fallback
// itu aktif **hanya pada saat konfigurasi sedang tidak lengkap**, yaitu
// keadaan yang paling jarang diaudit. Saat itulah sistem justru tampak
// sehat — login berhasil, sesi diterima — hanya saja kunci gerbangnya
// sedang dipajang di etalase.
//
// Perbaikannya membalik arah gagalnya: **tanpa secret, tidak ada sesi.**
// Konfigurasi yang hilang harus berbunyi keras, bukan gagal-terbuka.
//
// ===========================================================================
// Yang diukur
// ===========================================================================
// Bukan "apakah kodenya masih berisi fallback" (itu bisa dicek dengan grep,
// dan grep tidak pernah membuktikan perilaku). Yang diukur adalah:
//
//   1. Token PALSU yang ditandatangani dengan literal yang bocor itu
//      -> DITOLAK, baik saat `JWT_SECRET` ada maupun tidak ada.
//   2. `createSessionToken()` MELEMPAR saat secret tidak ada (bukan
//      mengembalikan token yang tampak sah).
//   3. Secret kosong / hanya spasi diperlakukan sama seperti "tidak ada".
//      (`JWT_SECRET=""` di dasbor terlihat seperti sudah diisi.)
//   4. Jalur sukses TIDAK BOLEH mati: dengan secret terpasang, token yang
//      dibuat `createSessionToken()` tetap diterima kembali.
//   5. Tanda tangan diutak-atik -> ditolak. Token kedaluwarsa -> ditolak.
//   6. End-to-end lewat handler sungguhan (`/api/me`): tanpa secret,
//      permintaan bersesi harus 401, bukan 200.
//
// Jebakan yang sengaja dihindari:
//   - Token uji DITANDATANGANI SENDIRI oleh harness, tidak pernah meminjam
//     `createSessionToken()`. Kalau harness memakai fungsi produksi untuk
//     membuat token "palsu", ia hanya menguji dirinya sendiri.
//   - Uji "tanpa secret" dijalankan dengan env yang benar-benar tidak punya
//     kunci `JWT_SECRET` (bukan `undefined` yang tersirat), supaya yang
//     diukur benar-benar jalur gagal-tertutup.
//
// Jalankan:  node tools/verify_b3_run.mjs

import { getUserFromSession, createSessionToken } from '../functions/_db.js';
import { onRequestGet as me } from '../functions/api/me.js';

const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';

// KUNCI YANG BOCOR — persis persis seperti yang ada di repositori.
// Harness ini MEMAKAINYA UNTUK MENYERANG, supaya uji nomor 1 benar-benar
// mengukur "apakah kunci ini masih diterima", bukan sekadar membaca teks.
const LEAKED = 'dhani-laundry-secure-jwt-secret-key-2026';
const REAL = 'secret-yang-benar-dari-lingkungan';

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

// --- Penanda tangan mandiri (tidak meminjam kode produksi) ----------------
const enc = new TextEncoder();
const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function forge(payloadObj, secret) {
  const payload = b64url(enc.encode(JSON.stringify(payloadObj)));
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

function reqWith(token) {
  return new Request(BASE + '/api/me', {
    headers: { 'Cookie': `session_token=${token}` }
  });
}

const ADMIN_FORGED = {
  id: 1, user_id: 1, user_name: 'Penyerang',
  user_role: 'Admin', email: 'attacker@evil.test',
  exp: Math.floor(Date.now() / 1000) + 3600
};

// ===========================================================================
console.log('# Bagian 1 — token palsu yang ditandatangani dengan kunci yang bocor');
// ===========================================================================

const forged = await forge(ADMIN_FORGED, LEAKED);

// 1a. Lingkungan TANPA secret sama sekali -> gagal-tertutup.
check(
  'tanpa JWT_SECRET: token palsu Admin DITOLAK (getUserFromSession -> null)',
  (await getUserFromSession(reqWith(forged), {})) === null
);

// 1b. Lingkungan DENGAN secret yang benar -> kunci lama tidak boleh
//     diterima sebagai kunci kedua (tidak ada "pintu belakang").
check(
  'dengan JWT_SECRET benar: token dari kunci lama TETAP ditolak',
  (await getUserFromSession(reqWith(forged), { JWT_SECRET: REAL })) === null
);

// 1c. Header Authorization: Bearer pun harus mengikuti aturan yang sama.
//     (Kalau hanya cookie yang dijaga, jalur Bearer jadi celah yang luput.)
check(
  'tanpa JWT_SECRET: token palsu lewat header Bearer DITOLAK',
  (await getUserFromSession(
    new Request(BASE + '/api/me', { headers: { 'Authorization': `Bearer ${forged}` } }),
    {}
  )) === null
);

// 1d. Uji yang MENUTUP HIJAU PALSU — dan pelajaran utama tick ini.
//
//     Percobaan pertama menambahkan token yang ditandatangani dengan satu
//     "kunci cadangan sembarang". Itu GAGAL menangkap kerentanan: saat
//     mutasi memakai literal yang BERBEDA ('fallback-diam-diam'), harness
//     tetap HIJAU 21/21 padahal sistem sudah rentan lagi — terbukti lewat
//     probe. Sebabnya mendasar: **daftar literal tidak pernah bisa
//     mencakup kunci yang belum diketahui.** Menguji "kunci A ditolak,
//     kunci B ditolak" hanya membuktikan A dan B; kunci C lolos.
//
//     Yang benar-benar kebal adalah menguji SUMBER kuncinya, bukan
//     daftar nilainya: tanpa `JWT_SECRET` di lingkungan, **tidak boleh ada
//     satu pun kunci** yang bisa menghasilkan token yang diterima. Diukur
//     dengan mencoba banyak kunci berbeda (termasuk string kosong) dan
//     menuntut semuanya ditolak — ditambah pemeriksaan sumber di Bagian 6
//     bahwa tidak ada `||` yang menyuplai kunci ke HMAC.
const CANDIDATE_KEYS = [
  LEAKED,                    // persis seperti yang dulu ada di repositori
  'fallback-diam-diam',      // literal yang dipakai uji mutasi
  'fallback', 'default', 'secret',
  'change-me', 'embun-laundry', 'dev'
];
let acceptedWith = null;
for (const k of CANDIDATE_KEYS) {
  const t = await forge(ADMIN_FORGED, k);
  if ((await getUserFromSession(reqWith(t), {})) !== null) { acceptedWith = k; break; }
}
check(
  'tanpa JWT_SECRET: TIDAK ADA SATU PUN kunci cadangan yang diterima (9 kunci diuji)',
  acceptedWith === null,
  acceptedWith !== null ? `diterima dengan kunci "${acceptedWith}"` : ''
);

// ===========================================================================
console.log('\n# Bagian 2 — tanpa secret, pembuatan token harus GAGAL KERAS');
// ===========================================================================

let threw = null;
try {
  await createSessionToken({ id: 7, full_name: 'Budi', role: 'Customer' }, {});
} catch (e) { threw = e; }
check(
  'createSessionToken MELEMPAR saat JWT_SECRET tidak ada (bukan mengembalikan token)',
  threw !== null && threw instanceof Error,
  threw === null ? 'tidak melempar — token palsu tetap lahir' : ''
);

// Nilai kosong / spasi: di dasbor tampak "sudah diisi", jadi wajib ditolak.
for (const [label, val] of [['string kosong', ''], ['hanya spasi', '   ']]) {
  let t = null;
  try { await createSessionToken({ id: 7, full_name: 'B', role: 'Customer' }, { JWT_SECRET: val }); }
  catch (e) { t = e; }
  check(`createSessionToken MELEMPAR saat JWT_SECRET ${label}`, t !== null);
}

let t2 = null;
try { await createSessionToken({ id: 7, full_name: 'B', role: 'Customer' }, { JWT_SECRET: undefined }); }
catch (e) { t2 = e; }
check('createSessionToken MELEMPAR saat JWT_SECRET undefined', t2 !== null);

// ===========================================================================
console.log('\n# Bagian 3 — jalur sukses TIDAK BOLEH mati (anti over-blocking)');
// ===========================================================================

const good = await createSessionToken(
  { id: 42, full_name: 'Siti Rahayu', role: 'Admin', email: 'siti@test.test' },
  { JWT_SECRET: REAL }
);
check('dengan JWT_SECRET: createSessionToken mengembalikan token bertitik', typeof good === 'string' && good.includes('.'));

const back = await getUserFromSession(reqWith(good), { JWT_SECRET: REAL });
check('dengan JWT_SECRET: token yang sah DITERIMA kembali', back !== null && back !== undefined);
check('dengan JWT_SECRET: identitas pengguna ikut kembali (id 42)', back?.id === 42 || back?.user_id === 42);
check('dengan JWT_SECRET: peran ikut kembali dengan benar (Admin)', back?.user_role === 'Admin');

// Token sah, tetapi dipakai di lingkungan yang secret-nya BERBEDA.
check(
  'token sah DITOLAK bila secret lingkungan berbeda (rotasi secret menggugurkan sesi lama)',
  (await getUserFromSession(reqWith(good), { JWT_SECRET: REAL + '-rotated' })) === null
);

// ===========================================================================
console.log('\n# Bagian 4 — tanda tangan diutak-atik & token kedaluwarsa');
// ===========================================================================

const parts = good.split('.');
const tamperedSig = parts[1].slice(0, -2) + (parts[1].slice(-2) === 'AA' ? 'BB' : 'AA');
check(
  'tanda tangan diutak-atik -> DITOLAK',
  (await getUserFromSession(reqWith(`${parts[0]}.${tamperedSig}`), { JWT_SECRET: REAL })) === null
);

const expired = await forge(
  { id: 42, user_id: 42, user_role: 'Admin', exp: Math.floor(Date.now() / 1000) - 60 },
  REAL
);
check('token kedaluwarsa -> DITOLAK', (await getUserFromSession(reqWith(expired), { JWT_SECRET: REAL })) === null);

check('token tanpa titik -> DITOLAK', (await getUserFromSession(reqWith('abc'), { JWT_SECRET: REAL })) === null);
check('permintaan tanpa sesi -> null', (await getUserFromSession(reqWith(''), { JWT_SECRET: REAL })) === null);

// ===========================================================================
console.log('\n# Bagian 5 — end-to-end lewat handler sungguhan (/api/me)');
// ===========================================================================

const meRes = await me({ request: reqWith(forged), env: {}, ctx: {} });
check('tanpa JWT_SECRET: /api/me menolak token palsu (401, bukan 200)', meRes.status === 401, `status ${meRes.status}`);

const meRes2 = await me({ request: reqWith(good), env: { JWT_SECRET: REAL }, ctx: {} });
check('dengan JWT_SECRET: /api/me menerima token sah (200)', meRes2.status === 200, `status ${meRes2.status}`);

// ===========================================================================
console.log('\n# Bagian 6 — kode produksi tidak lagi memuat literal yang bocor');
// ===========================================================================

const src = await (await import('node:fs/promises')).readFile(
  new URL('../functions/_db.js', import.meta.url), 'utf8'
).catch(() => '');
check(
  '_db.js tidak lagi memuat literal secret yang bocor',
  src !== '' && !src.includes(LEAKED)
);

// Pemeriksaan yang kebal terhadap literal yang belum diketahui.
//
// Daftar kunci di Bagian 1d bisa saja dilewati oleh kunci kesembilan yang
// tak pernah terpikirkan. Karena itu sumbernya ikut diuji: baris mana pun
// yang menyuplai kunci ke HMAC tidak boleh mengandung `||` (cadangan) atau
// literal string. Pola ini menangkap `env.JWT_SECRET || '<apa pun>'`
// berapa pun jumlah variasi literalnya.
const keyLines = src.split('\n')
  .map((l, i) => ({ l, n: i + 1 }))
  // Baris yang menetapkan `secret` (satu-satunya nama yang dipakai _db.js)
  .filter(({ l }) => /const\s+secret\s*=/.test(l))
  // Komentar tidak bisa menyuplai kunci.
  .filter(({ l }) => !/^\s*(\/\/|\*|\/\*)/.test(l.trim()));

check('_db.js punya baris penetapan kunci yang bisa diuji', keyLines.length > 0, `ketemu ${keyLines.length}`);

const badLine = keyLines.find(({ l }) => /\|\|/.test(l) || /'[^']*'|"[^"]*"|`[^`]*`/.test(l));
check(
  'TIDAK ADA cadangan `||` maupun literal string pada penetapan kunci HMAC',
  badLine === undefined,
  badLine ? `baris ${badLine.n}: ${badLine.l.trim()}` : ''
);

console.log(`\nHASIL B3: HIJAU ${pass}, MERAH ${fail}`);
process.exit(fail === 0 ? 0 : 1);
