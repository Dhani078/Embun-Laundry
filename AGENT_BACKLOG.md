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

---

## FASE C — Fitur Inti

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| C1 | Halaman "Layanan" publik + filter | P2 | [x] | `1a02520` |
| C2 | Tracking order publik by kode (tanpa login) | P2 | [x] | `1551773` |
| C3 | Notifikasi real-time status (polling) | P2 | [ ] | — |
| C4 | Upload bukti pembayaran (R2 / base64 kecil) | P3 | [ ] | — |
| C5 | Invoice PDF (client-side / print CSS) | P3 | [ ] | — |
| C6 | Riwayat order pelanggan + filter tanggal | P2 | [ ] | — |
| C7 | Manajemen voucher & promo (admin) | P2 | [ ] | — |
| C8 | Laporan bulanan + chart | P2 | [ ] | — |
| C9 | Service worker (offline dasar) | P3 | [ ] | — |
| C10 | Multi-bahasa ID/EN | P4 | [ ] | — |

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
11. **B14 — pesan error generik di 20 titik + validasi `/api/pay` (P1) —
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
