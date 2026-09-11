# AGENT BACKLOG

Task terurut prioritas. Tandai `[x]` jika selesai, catat commit hash.

Sumber kebenaran utama: `AGENT24.md` Bagian 7.
File ini adalah **working copy** yang diupdate setiap tick.

---

## FASE A — Fondasi & Stabilitas

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| A1 | Link `design-tokens.css` ke `index.html` + `dashboard.html` + `auth/*.html` | P1 | [x] | `21a94ea` |
| A2 | Link `hero-canvas.js` (p5.js CDN) + container `#hero-canvas-container` | P2 | [x] | `23e3fe2` |
| A3 | Migrasi hardcoded color `index.html` → token | P2 | [x] | `796e81e` |
| A3b | Token baru untuk 9 warna sisa (`#94a3b8` `#f8fafc` `#64748b` `#1e293b` `#090d16` `#f59e0b` `#ef4444`) | P2 | [x] | `f782d3d` |
| A4 | Semua API `try/catch` → respons JSON `{ok}` konsisten | P1 | [x] | `c07ed88` |
| A5 | Tambah endpoint `/api/health` (tanpa DB) | P1 | [x] | `d6cea6a` |
| A6 | Pindahkan secret dari `wrangler.toml` ke `wrangler secret` | **P0** | [ ] | — |
| A7 | Verifikasi 14 endpoint terdaftar di `src/index.js` | P1 | [x] | (verifikasi) |
| A8 | `robots.txt` + favicon + meta description/OG tags | P3 | [x] | `a502402` |

---

## FASE B — Keamanan

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| B1 | Rate limit `/api/auth/login` (in-memory per-IP) | P1 | [x] | `9981427` `ea05b75` |
| B2 | Validasi & sanitasi input server-side | P1 | [x] | `c9db43b` |
| B3 | JWT secret dari `env.JWT_SECRET`, bukan hardcoded | **P0** | [ ] | — |
| B4 | Header: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | P1 | [x] | `9632507` |
| B5 | CORS ketat (hanya origin sendiri) | P1 | [x] | `d32c367` |
| B6 | Cookie `HttpOnly; Secure; SameSite=Lax` | **P0** | [x] | (sudah benar) |
| B7 | Audit SQL injection (parameterized only) | **P0** | [x] | `ea05d42` |
| B8 | Migrasi hash → PBKDF2 via WebCrypto | P2 | [x] | `87d3fa9` |
| B9 | Escaping HTML data dari API (stored XSS) | **P0** | [x] | `be7d8cd` |
| B10 | Isolasi data (IDOR) orders/customers/delivery/pay | **P0** | [x] | `db95930` |
| B11 | Hak akses laporan + validasi rentang tanggal | **P0** | [x] | `5534bc3` |
| B12 | Hari check-in di zona `Asia/Jakarta`, bukan UTC | P1 | [x] | `1c2af13` |
| B13 | Validasi input `/api/profile` + pesan error generik | P1 | [x] | `3145171` |
| B14 | Pesan error generik 20 titik (11 modul) + validasi `/api/pay` | P1 | [x] | `58fb1b5` |
| B15 | Validasi input `/api/delivery` + jadwal bawaan `Asia/Jakarta` | P1 | [x] | `abc9922` |
| B16 | Batas validasi selaras lebar kolom TiDB | P1 | [x] | `502d56a` |
| B17 | Wajib sesi pada `POST /api/pay` (penulisan terbuka) | **P0** | [x] | `a8ca085` |
| B18 | Audit kata kerja TULIS semua modul (jaring regresi B17) | P1 | [x] | `ab7026e` |
| B19 | Harga & diskon bukan hak pelanggan (`create_order`) | P1 | [x] | `3709f0f` |
| B20 | Jumlah bayar dibatasi sisa tagihan (`POST /api/pay`) | P1 | [x] | `858262a` |

---

## FASE C — Fitur Inti

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| C1 | Halaman "Layanan" publik + filter | P2 | [x] | `1a02520` |
| C2 | Tracking order publik by kode (tanpa login) | P2 | [x] | `1551773` |
| C3 | Notifikasi real-time status (polling) | P2 | [ ] | — |
| C4 | Upload bukti pembayaran (R2 / base64 kecil) | P3 | [ ] | — |
| C5 | Invoice PDF (client-side / print CSS) | P3 | [ ] | — |
| C6 | Riwayat order pelanggan + filter tanggal | P2 | [x] | `pending-commit` | |
| C7 | Manajemen voucher & promo (admin) | P2 | [ ] | — |
| C8 | Laporan bulanan + chart | P2 | [ ] | — |
| C9 | Service worker (offline dasar) | P3 | [ ] | — |
| C10 | Multi-bahasa ID/EN | P4 | [ ] | — |
| C11 | Sinkronisasi `paid_amount` & `payment_status` orders via `POST /api/pay` | P1 | [x] | `ecfe4b9` |

---

## FASE D — Desain & UX

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| D1 | Terapkan design token ke seluruh dashboard | P3 | [ ] | — |
| D2 | Dark mode toggle (localStorage) | P3 | [ ] | — |
| D3 | Skeleton loading di semua tabel | P3 | [ ] | — |
| D4 | Empty state bermakna di setiap list | P3 | [ ] | — |
| D5 | Toast notification global (ganti alert) | P3 | [ ] | — |
| D6 | Micro-interaction konsisten (hover/focus/active) | P3 | [ ] | — |
| D7 | Responsive audit 360/768/1024/1440px | P3 | [ ] | — |
| D8 | Animasi masuk (IntersectionObserver) | P3 | [ ] | — |
| D9 | Finalisasi p5.js hero (droplet + ripple) | P3 | [ ] | — |

---

## FASE E — Performa & Observability

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| E1 | Cache `/api/services` di edge (TTL 5m) | P3 | [ ] | — |
| E2 | Lazy load gambar non-kritis | P3 | [ ] | — |
| E3 | Preconnect/preload font kritis | P3 | [ ] | — |
| E4 | Minifikasi CSS/JS saat build | P4 | [ ] | — |
| E5 | Logging terstruktur (dev only) | P3 | [ ] | — |
| E6 | Error boundary global SPA | P3 | [ ] | — |

---

## FASE F — Dokumentasi

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| F1 | Update `README.md` (arsitektur final) | P4 | [ ] | — |
| F2 | Lengkapi `API_DOCUMENTATION.md` | P4 | [ ] | — |
| F3 | `DATABASE_SCHEMA.md` sinkron TiDB aktual | P4 | [ ] | — |
| F4 | `CONTRIBUTING.md` + panduan dev lokal | P4 | [ ] | — |

---

## Prioritas Mutlak (kerjakan ini dulu)

1. **A6** — Secret di `wrangler.toml` (P0, keamanan) — TERBLOKIR, butuh
   Cloudflare API token
2. **B7** — Audit SQL injection (P0) — **SELESAI** `ea05d42`: 67 SQL
   literal diaudit, 0 interpolasi nilai user, 2 modul di-hardening.
   Alat: `tools/audit_sql_injection.py` (statik) + `tools/verify_b7_run.mjs`
   (runtime, canary). Jangan dikerjakan ulang.
3. **B1** — Rate limit `/api/auth/login` (P1) — **SELESAI** `ea05b75`
4. **B2** — Validasi & sanitasi input server-side (P1) — **SELESAI** `c9db43b`
   Jangan dikerjakan ulang. Periksa ulang dengan `node tools/verify_b2_run.mjs`.
5. **B5** — CORS ketat, hanya origin sendiri (P1) — **SELESAI** `d32c367`.
   Modul baru `functions/_cors.js`; 6 titik `*` dihapus; `Vary: Origin`
   ditambahkan. Periksa ulang dengan `node tools/verify_b5_run.mjs`
   (HASIL: HIJAU 50/50). Jangan dikerjakan ulang.
6. **B8** — Hash sandi PBKDF2 (P2) — **SELESAI** `87d3fa9`. Modul baru
   `functions/_password.js`; salt acak 16 byte per pengguna; lazy upgrade
   di `login.js`; terbukti di produksi (`admin@gmail.com` kini
   `pbkdf2-sha256$10000$…`). Periksa ulang dengan
   `node tools/verify_b8_run.mjs` (HASIL: HIJAU 35/35). Jangan dikerjakan
   ulang. Iterasi sengaja 10.000 — jangan dinaikkan tanpa mengukur ulang
   `tools/bench_pbkdf2.mjs`.
7. **B3** — JWT secret dari `env.JWT_SECRET` (P0) — BELUM: `_db.js` sudah
   membaca `env.JWT_SECRET`, TETAPI `wrangler.toml` [vars] masih menaruh
   nilai aslinya sehingga fallback hardcoded tidak pernah benar-benar mati.
   Butuh `wrangler secret put` → terblokir bersama A6 (butuh Cloudflare API
   token). Dikonfirmasi ulang tick 15: `npx wrangler whoami` →
   "You are not authenticated".
8. **B10** — isolasi data / IDOR (P0) — **SELESAI** `db95930` (tick 14,
   baru tercatat di backlog pada tick 15). Periksa ulang dengan
   `node tools/verify_b10_run.mjs` (HASIL: HIJAU 29/29). **PAKAI pembungkus
   `_run.mjs`** — menjalankan `verify_b10.mjs` langsung menghasilkan MERAH
   14/29 PALSU karena mock DB tidak terpasang. Jangan dikerjakan ulang.
9. **B11** — hak akses laporan + rentang tanggal (P0) — **SELESAI**
   `5534bc3` (tick 15). Dua defek di `/api/reports`: akun Customer menerima
   200 + seluruh agregat (hardening, BUKAN IDOR — jangan diklaim lebih), dan
   `?start=`/`?end=` disambung mentah sebelum masuk `BETWEEN` sehingga nilai
   ngawur diterima 200. BARU `functions/_reportfilter.js` ( satu penjaga
   `dateRange()`). Periksa ulang dengan `node tools/verify_b11_run.mjs`
   (HASIL: HIJAU 41/41). Jangan dikerjakan ulang.
10. **B12** — hari check-in di zona operasional (P1) — **SELESAI** `1c2af13`
    (tick 16). `checkin.js` memakai `toISOString()` (UTC) sehingga antara
    00:00–06:59 WIB "hari ini" = kemarin → penjaga "sudah check-in" buta dan
    satu hari bisa dua baris. BARU `functions/_today.js` (`todayIn()`,
    `Asia/Jakarta`). Periksa ulang `node tools/verify_b12_run.mjs`
    (HASIL: HIJAU 33/33). Jangan dikerjakan ulang.
11. **B13 — validasi input `/api/profile` + pesan error generik (P1) —
    SELESAI `3145171`** (tick 17). Menutup tiga celah yang ditemukan
    harness: (a) `update_profile` hanya cek `if (!name)` → nama 100.000
    char lolos ke TiDB; (b) `phone` bukan string → TypeError **500** dengan
    pesan `(body.phone || "").trim is not a function`; (c) kedua `catch`
    mengirim `msg: e.message` → connection string bisa bocor. Periksa ulang
    dengan `node tools/verify_b13_run.mjs` (HASIL: HIJAU 66/66). Jangan
    dikerjakan ulang.
- **B15 — validasi input `/api/delivery` + jadwal bawaan Asia/Jakarta (P1) —
  SELESAI `abc9922`** (tick 23). `delivery.js` adalah satu-satunya modul yang
  TIDAK ikut dipasangi `validateOr400()` pada B2. Tiga defek nyata, semua
  diukur sebelum diperbaiki: (a) 13 input ngawur diterima 200 — termasuk
  alamat array dan telepon objek yang tersimpan ke kolom alamat/telepon
  pelanggan; (b) `parseInt([5,9])` = 5, jadi `id` array lolos dan elemen
  pertamanya dipakai; (c) jadwal bawaan `toISOString()` (UTC), padahal
  `schedule_date` DATE NOT NULL. BARU tipe `time` di `_validate.js` dan
  `type:'int'` kini menolak objek/array. Periksa ulang dengan
  `node tools/verify_b15_run.mjs` (HASIL: HIJAU 93/93). Jangan dikerjakan
  ulang.
- **B16 — batas validasi selaras lebar kolom TiDB (P1) — SELESAI `502d56a`**
  (tick 24). Batas panjang sejak B2 ditulis sebaris (120/30/500) dan tidak
  pernah dibandingkan dengan lebar kolom tujuannya. Akibatnya klien menerima
  **500** untuk input yang seharusnya **400** (batas terlalu longgar), atau
  data sah ditolak (terlalu ketat). Periksa ulang dengan
  `node tools/verify_b16_run.mjs` (HASIL: HIJAU 156/156). Jangan dikerjakan
  ulang.
- **B17 — wajib sesi pada `POST /api/pay` (P0) — SELESAI `a8ca085`**
  (tick 25). **Celah tulis terbuka**: `POST /api/pay` membuat baris
  `payments` tanpa pemeriksaan sesi apa pun. Terbukti di produksi: tanpa
  cookie → 200 + `qr_payload`, baris tersimpan atas pesanan orang lain.
  Kode pesanan beredar di struk, jadi ini bisa dipakai siapa pun.
  `GET /api/pay` **TETAP publik dan sengaja demikian** (`public/pay.html`
  hanya GET; B10 sudah menyensor telepon & alamat) — jangan "diperbaiki".
  Periksa ulang dengan `node tools/verify_b17_run.mjs` (HASIL: HIJAU 19/19).
  Jangan dikerjakan ulang.
- **B18 — audit kata kerja TULIS semua modul (P1) — SELESAI `ab7026e`**
  (tick 26). **Bukan perbaikan defek, melainkan jaring regresi untuk kelas
  defek B17.** B17 lolos bertahun-tahun karena `verify_b10` mengimpor
  `pay.js` tetapi hanya menguji GET. B18 menutup polanya: **29 aksi tulis
  pada 10 modul** dipanggil TANPA cookie dan yang diukur adalah SQL tulis
  yang benar-benar terkirim — bukan status. HASIL: **HIJAU 76/76**, tidak
  ada satu pun jalur tulis yang terbuka. Periksa ulang dengan
  `node tools/verify_b18_run.mjs`. Jangan dikerjakan ulang.
  Yang diuji: orders/customers/services/promos/vouchers/delivery/pay/
  profile/checkin (semua aksi tulisnya), 4 kata kerja terlarang pada
  `track.js`, 10 uji jalur sukses staf, 3 uji GET publik tak ikut tertutup.
  **Registrasi diuji dengan asersi TERBALIK** — mendaftar adalah satu-satunya
  penulisan yang memang harus bisa tanpa sesi; jangan "diperbaiki" jadi 401.
- **B19 — harga & diskon bukan hak pelanggan pada `create_order` (P1) —
  SELESAI `3709f0f`** (tick 27). **Celah otorisasi nilai uang**: `price_per_kg`
  dan `discount` di `POST /api/orders` dipakai MENTAH dari body. Batasnya ada
  sejak B2/B16 (0..10.000.000), tetapi batas itu hanya soal **BENTUK, bukan
  HAK** — tidak ada satu pun baris yang bertanya siapa pengirimnya. Terbukti di
  produksi (akun Customer baru): kirim `price_per_kg: 1` → 3 kg tercatat
  Rp 3.000, bukan Rp 60.000; kirim `discount: 100000000` → `total_amount` = 0.
  Dampaknya melampaui satu baris: `total_amount` adalah dasar omzet di
  `/api/reports` dan `/api/dashboard`, dan piutang dihitung dari selisihnya
  dengan `paid_amount`. Perbaikan menyamakan keduanya dengan pola `status` yang
  sudah lama benar (`isStaff ? nilai : bawaan`). **Diskon VOUCHER tetap hidup
  untuk pelanggan** — ia datang dari `user_vouchers`, bukan dari body.
  Periksa ulang dengan `node tools/verify_b19_run.mjs` (HASIL: HIJAU 24/24;
  kode lama MERAH 10/22). Jangan dikerjakan ulang.
- **Pelajaran tick 27 — validasi bentuk yang rapi bisa menyembunyikan celah
  hak.** `create_order` sudah lolos B2 (validasi), B16 (batas selaras kolom),
  dan B18 (kata kerja tulis berpenjaga) — tetapi tidak ada satu pun dari
  ketiganya yang bertanya "bolehkah peran INI mengisi field INI". Pola
  pemeriksaannya: **cari field yang nilainya menentukan UANG atau HAK, lalu
  cek apakah ia dijaga oleh peran atau hanya oleh tipe.** `status` terjaga,
  `price_per_kg`/`discount` tidak — padahal ketiganya satu baris bersebelahan.
  Catatan penyeimbang yang sama berlaku untuk `update_order` (sudah
  `isStaff`-only) dan `pay.js` (`amount` bebas, tetapi terikat pesanan dan
  sudah berpenjaga pemilik sejak B17).
- **Pelajaran tick 27 — uji mutasi "pengetatan berlebihan" sama pentingnya
  dengan uji "celah dibuka".** Mutasi 3 (staf pun tak bisa menentukan harga)
  dan 4 (diskon voucher ikut mati) membuktikan harness juga menangkap FITUR
  YANG MATI, bukan cuma celah keamanan. Tanpa keduanya, "perbaikan" yang
  berlebihan akan tetap HIJAU.
- **Pelajaran tick 26 — uji mutasi yang HIJAU belum tentu kegagalan harness.**
  Mutasi "penjaga dipindah SETELAH penulisan" pada `delivery.js` tetap HIJAU
  76/76, dan itu BENAR: `delivery.js` punya penjaga `!user` di tingkat atas,
  jadi mutasi itu tidak bisa menghasilkan penulisan. Untuk membuktikan
  harness punya gigi pada pola B17, mutasi harus diletakkan di modul yang
  GET-nya publik dan TIDAK punya penjaga atas (`services.js`) — di situ
  status 401 tetap terkirim bersama UPDATE, MERAH 72/76. **Sebelum
  menyimpulkan harness lemah, cek apakah modul yang dimutasi punya penjaga
  lapis lain.**
- **Pelajaran tick 25 — mengukur batas B16 di produksi secara tak sengaja
  menemukan B17.** Pencarian kode pesanan nyata untuk uji batas memicu
  `POST /api/pay` tanpa cookie: 200, bukan 401. Dua pelajaran:
  1. **Uji keamanan yang hanya menyentuh GET bisa buta terhadap celah
     TULIS.** `verify_b10` mengimpor `pay.js` tetapi hanya menguji GET
     (karena GET-lah yang publik) — jadi celah POST lolos bertahun-tahun.
     Bila sebuah modul punya dua kata kerja, uji keduanya.
  2. **Status 401 yang dikembalikan SETELAH `db.execute()` tetap
     meninggalkan baris.** Karena itu `verify_b17` mengukur INSERT yang
     terkirim, bukan status; mutasi "guard dipindah setelah INSERT"
     terbukti MERAH (18/19). Contoh uji mutasi yang WAJIB ada untuk setiap
     perbaikan autentikasi.
- **Pelajaran tick 25 — bentuk objek untuk `createSessionToken()` mudah
  keliru.** Token uji dibuat dari `{role, full_name}`, BUKAN dari
  `{user_role, user_name}` (bentuk JWT hasilnya). Salah membentuknya
  menghasilkan token "Customer" untuk maksud staf → uji MERAH karena
  kesalahan harness, atau lebih buruk: HIJAU karena semua peran menjadi
  sama. Sudah diberi komentar di `verify_b17.mjs`.
- **Pelajaran tick 23 — tiga hijau palsu ditemukan pada harness SENDIRI.**
  Hijau tidak berarti harness punya gigi; hanya uji mutasi yang membuktikannya.
  1. `if (patch.type === undefined) delete body.type;` pada tabel patch:
     karena hampir semua patch tidak punya kunci `type`, SETIAP kasus
     kehilangan `type` dan 400 karena alasan yang SALAH. Mutasi "batas nama
     dibuka" tetap HIJAU 91/91. Perbaikan: `'type' in patch && ...`.
     **Waspadai pola ini di semua harness berbasis tabel patch.**
  2. Uji zona waktu tidak bisa membedakan benar/salah bila WIB dan UTC sedang
     hari yang sama — mutasi "jadwal balik UTC" HIJAU. Wajib ada uji dengan
     **jam dibekukan** (`2026-09-10T23:00:00Z` = 06:00 WIB hari berikutnya).
  3. Membekukan `Date` menyentuh scope global — wajib ada uji bahwa jam pulih
     sesudahnya, atau semua uji berikutnya mengukur waktu yang salah.
- **B14 — pesan error generik di 20 titik + validasi `/api/pay` (P1) —
  SELESAI `58fb1b5`** (tick 18). Ini ADALAH entri 12 yang dulu berbunyi
    "sisa pekerjaan yang nyata"; kini selesai, jangan dikerjakan ulang.
    Periksa ulang dengan `node tools/verify_b14_run.mjs` (HASIL: HIJAU
    76/76). Bukti: kode lama MERAH 46/76, kode baru HIJAU 76/76.
12. **Pelajaran tick 18 — `verify_b8` punya uji WAKTU (timing), bukan hanya
    uji benar/salah.** Satu uji berbunyi "2 hash (ganti sandi) < 10 ms" dan
    bisa MERAH murni karena mesin sedang sibuk (pernah 13,65 ms saat
    `run_all_verifiers.sh` menjalankan 11 verifier berurutan). Ulangi
    sebelum menyimpulkan regresi — jangan "memperbaiki" `_password.js`
    gara-gara satu angka. `_password.js` tidak disentuh commit ini.
13. **Pelajaran tick 18 — audit statik wajib membersihkan komentar dulu.**
    Pemeriksaan `msg: ... e.message` mula-mula MERAH pada `profile.js`,
    padahal file itu sudah benar sejak B13 — yang cocok adalah kalimat
    komentar "dulu `msg: e.message`". Tanpa pembersihan komentar, audit
    menghasilkan MERAH PALSU pada file yang justru sudah beres.
13. **Pelajaran dari tick 17 — uji "kolom rahasia tidak bocor" mudah
    HIJAU PALSU.** Kalau baris tiruan tidak punya `password_hash`, uji itu
    lolos sekalipun handler memakai `SELECT *`; kalau tiruan mengembalikan
    baris utuh, uji itu MERAH sekalipun SELECT-nya benar. `verify_b13`
    mengatasi ini dengan `projectRow()`: memotong baris sesuai daftar kolom
    di SELECT, sehingga yang diukur adalah handler, bukan tiruan.
14. **Celakanya cakupan verifier** (catatan lama, masih berlaku): B10, B11,
    B12, B13 lolos berbulan-bulan karena tidak ada harness yang memanggil
    endpointnya. Setelah tick 17, SEMUA endpoint yang pernah dicatat
    "belum punya harness" sudah terukur (`me`, `logout`, `profile`,
    `checkin`, `vouchers`). Alat: `bash tools/run_all_verifiers.sh`
    menjalankan 10 verifier sekaligus; `bash tools/baseline.sh` untuk cek
    produksi cepat.
12. Entri 6–9 di bawah ini adalah SALINAN usang yang tertinggal dari tick
    lampau (B1/B2/B5/A3b sudah `[x]` di tabel masing-masing). Abaikan.

### Status FASE A

Selesai: A1, A2, A3, **A3b**, A4, A5, A7, A8. Tersisa: **A6** (P0, terblokir
butuh Cloudflare API token).

> **B4 SELESAI (jangan diulang).** Header keamanan kini aktif di `/`,
> `/robots.txt`, `/dashboard`, dan `/api/*` (masing-masing 2 header terverifikasi).
> Mekanismenya DUA jalur:
> - **Aset statis** → `public/_headers` (native Cloudflare).
> - **`/api/*`** → `withSecurityHeaders()` di `src/index.js`.
>
> **JEBATAN YANG SUDAH DIBUKTIKAN (jangan coba lagi):**
> 1. `withSecurityHeaders()` TIDAK berlaku untuk aset statis — dengan
>    konfigurasi `[assets]` bawaan, Cloudflare menyajikan aset **SEBELUM**
>    Worker dijalankan. Kode tidak pernah dieksekusi (`CF-Cache-Status: HIT`,
>    nol header kustom).
> 2. `run_worker_first = true` MEMANG memasang header, tapi **merusak `/` dan
>    `/dashboard` menjadi 404**. Sudah di-rollback ke `false`.
> 3. Rebuild `new Response(body, {headers})` di JS juga tidak menolong, karena
>    akar masalahnya adalah Worker yang tidak dipanggil, bukan response beku.
>
> Jadi: untuk header aset statis, satu-satunya jalur yang benar adalah
> **`public/_headers`**. Jangan "memperbaiki" ini lewat kode Worker.

> Setelah semua P0 selesai, lanjut ke P1 berurutan.
> Jangan kerjakan P2/P3 sebelum P0/P1 tuntas.

---

## Catatan Operasional Loop (bukan task)

Hal-hal di bawah ini **bukan pekerjaan**, melainkan aturan main agar loop
tidak merusak dirinya sendiri. Baca sebelum menjalankan tick.

### Aturan Keras 13 & 14 (baru, AGENT24.md Bagian 3)

- **13 — Dilarang menulis secret ke working tree.** Pernah terjadi: tik
  menyalin `TIDB_DATABASE_URL` ke `.tmp/dburl.txt`. Walau `.tmp/` sudah
  di-`gitignore`, ini tetap dilarang. Secret dibaca langsung dari `env`.
- **14 — Tick tidak boleh menggantung.** Pernah terjadi: fire 19:02 dan
  19:22 berjalan 20+ menit tanpa commit, sehingga fire berikutnya dilewati
  terus. Bila lebih dari ~20 menit tanpa hasil, tulis ke `AGENT_LOG.md`
  lalu akhiri. Lebih baik lapor "tidak selesai" daripada mengunci lock.

### Lingkungan multi-loop

- Embun Laundry dan **EquipRent berjalan berdampingan** (keputusan user
  2026-09-09). Jangan pause/remove cron EquipRent `4af45b321a8c` — itu
  project user juga, dan ia mengaktifkan dirinya sendiri bila dipause.
- Scheduler hanya menjalankan **satu job per waktu** → fire bisa tertunda
  1–2 jam. Itu wajar, **bukan** insiden.
- Gateway bisa mati diam-diam dan menghentikan **semua** cron. Gejalanya:
  tidak ada commit baru berjam-jam padahal repeat masih sisa. Cek
  `hermes gateway status`, pulihkan dengan `hermes gateway start`.
- `hermes cron doctor` **pernah melaporkan "no issues" padahal job gagal
  berulang**. Jangan jadikan satu-satunya sumber; pakai `hermes cron runs`.

### Hal yang sudah selesai — JANGAN dikerjakan ulang

- **B4 header aset statis** → `public/_headers`. Dua pendekatan pernah gagal
  dan terbukti merugikan: `run_worker_first=true` (membuat `/` dan
  `/dashboard` **404**) dan rebuild `Response` di JS (no-op).
- **B1 rate limit** → `POST /api/auth/login` memang mengembalikan **429**
  bila dipanggil berulang dari IP yang sama. Itu perilaku benar, bukan bug.
  Batasi 1–2 percobaan login per verifikasi.

### Model LLM untuk cron loop (PENTING)

- Job cron memakai `model.default` global dari `config.yaml`. Default global
  saat ini `cbai/hy4-preview` — model ini **sering kehabisan kredit**
  (`HTTP 429 code 14018 "Credits exhausted"`). Bila itu terjadi, SEMUA tick
  gagal dan gejalanya menyesatkan (seolah bug kode).
- Solusi yang dipakai: model **per-job**, bukan global:
  `hermes cron edit 6644cfdf9118 --model combomaut --provider custom`
  (idem untuk `4af45b321a8c`). `combomaut` adalah router 9Router yang
  terbukti hidup (balas `HTTP 200`, SSE, via claude-sonnet-4-6).
- Verifikasi model hidup TANPA menunggu tick:
  `curl -s -m 60 http://localhost:20128/v1/chat/completions -H "Authorization: Bearer $HERMES_CUSTOM_LOCALHOST_20128_API_KEY" -H 'Content-Type: application/json' -d '{"model":"combomaut","messages":[{"role":"user","content":"say PONG"}],"max_tokens":20}'`
- **Jangan** buru-buru menyimpulkan "kode rusak" saat banyak tick gagal
  serentak; baca dulu `error` di `executions.db` atau file output terbaru di
  `cron/output/<job_id>/`.
- `hermes cron doctor` melaporkan sehat walau tick gagal berulang. Percaya
  `hermes cron runs` + kolom `error` di `executions.db`.
