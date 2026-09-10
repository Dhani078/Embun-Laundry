# AGENT STATE

Terakhir update: 2026-09-10T21:32:00+08:00
Tick ke: 25
Model: cbai/hy4-preview (custom:9router)

## Konfigurasi loop (update 2026-09-10)

- Cron `6644cfdf9118` — **every 5m**, repeat 2000, `deliver=all`,
  `continuity=true`, workdir `C:\xampp\htdocs\dhani-laundry`.
- **EquipRent dibiarkan jalan berdampingan** (keputusan user 2026-09-09).
  Jangan pause/remove `4af45b321a8c` — itu project user juga, dan ia
  mengaktifkan dirinya sendiri bila dipause.
- Scheduler hanya menjalankan **satu job per waktu** → penundaan fire 1–2 jam
  itu wajar, bukan insiden. Watchdog `RIVAL_IDS=[]`, `STALE_HOURS=6`.
- Gateway bisa mati diam-diam; bila semua cron berhenti, cek
  `hermes gateway status` lalu `hermes gateway start`.
- `hermes cron doctor` pernah melaporkan "no issues" padahal job gagal
  berulang → pakai `hermes cron runs` sebagai sumber kebenaran.

## Insiden tercatat

- **Kebocoran secret ke working tree** (2026-09-09): sebuah tick menulis
  `TIDB_DATABASE_URL` ke `.tmp/dburl.txt`. File sudah dihapus; `.tmp/` tidak
  terlacak git (`.gitignore:9`). Dicegah oleh **Aturan Keras 13** di
  AGENT24.md: secret dibaca dari `env`, tidak pernah ditulis ke disk.
- **Tick menggantung** (2026-09-09): fire 19:02 dan 19:22 berjalan 20+ menit
  tanpa commit, sehingga fire berikutnya dilewati. Dicegah oleh **Aturan
  Keras 14**: bila >20 menit tanpa hasil, tulis ke log dan akhiri.

## Baseline terakhir

| Path | Status | Catatan |
|------|--------|---------|
| `/` | 200 | Landing page OK, token ter-link |
| `/auth/login.html` | 307 → `/auth/login` | Redirect normal (asset scheme) |
| `/auth/register.html` | 307 | Redirect normal |
| `/dashboard.html` | 307 → `/dashboard` | Worker serve `dashboard.html` |
| `/api/health` | 200 | Liveness OK |
| `/api/services` | 200 | 4 layanan |
| `/assets/design-tokens.css` | **200** | DULU 404 — sudah fix di tick 3 |
| `/assets/hero-canvas.js` | **200** | DULU 404 — sudah fix di tick 3 |
| login admin | OK | `admin@gmail.com` / `admin123` |

## Task aktif

- ID: — (tidak ada; tick 8 selesai)
- Judul: —
- Fase: selesai
- Mulai: —

## Task selesai

- **B15** — validasi input `/api/delivery` + jadwal bawaan Asia/Jakarta (P1,
  melengkapi B2) — `abc9922` (tick 23)
  - `delivery.js` adalah satu-satunya modul yang TIDAK ikut dipasangi
    `validateOr400()` pada B2. Celahnya sudah dicatat sendiri di `_today.js`
    sejak B12. Satu tick menutup dua hal: input tanpa validasi, dan tanggal
    yang salah zona.
  - **Defek 1 — 13 input ngawur diterima 200** (diukur dulu dengan probe
    sementara): `customer_name` 5.000 char (kolom VARCHAR(80) -> 500 dari
    TiDB), `phone` objek -> `[object Object]` tersimpan, `address` array ->
    `"a,b"` tersimpan di alamat, `order_code` 9.000 char, `notes` 20.000
    char, `schedule_date: 'besok-saja'`, `start_time: 'pagi sekali'`.
    **Kolom yang dipertaruhkan: alamat dan telepon pelanggan.**
  - **Defek 2 — `parseInt(body.id)` pada ARRAY**: `id: [5,9]` bernilai 5 —
    elemen pertama dipakai, sisanya dibuang, tanpa keluhan. `id: -3` dan
    `courier_id: -7` juga lolos.
  - **Defek 3 — jadwal bawaan UTC**: `toISOString().split('T')[0]`.
    `schedule_date` adalah DATE NOT NULL, jadi tugas yang dibuat antara
    00:00–06:59 WIB tercatat sebagai hari KEMARIN dan langsung tampil
    "lewat jadwal". Kini `todayIn()` dari `_today.js`.
  - Perubahan: `delivery.js` seluruh field `create_task` + 3 aksi lain lewat
    `validateOr400()` (batas mengikuti `DATABASE_SCHEMA.md`); parameter GET
    dibersihkan. `_validate.js` mendapat TIPE BARU **`time`**
    (`HH:MM`/`HH:MM:SS`) + `isTime()`, dan `type:'int'` kini MENOLAK
    objek/array (dulu `Number([3])` = 3 lolos).
  - BARU `tools/verify_b15.mjs` + `verify_b15_run.mjs` — **93 uji**.
    Periksa ulang dengan `node tools/verify_b15_run.mjs`.
  - **Uji mutasi 7x — semua MERAH** (batas nama dibuka, `date`/`time` jadi
    str bebas, jadwal balik UTC, Customer boleh pilih kurir, validasi
    dilewati, filter GET dimatikan). Dipulihkan: HIJAU 93/93.
  - **TIGA HIJAU PALSU pada harness sendiri — pelajaran terpenting tick ini:**
    1. `if (patch.type === undefined) delete body.type;` membuat SETIAP kasus
       kehilangan `type` -> 400 karena "Tipe wajib diisi", bukan karena field
       yang diuji. Mutasi "batas nama -> 100.000" tetap HIJAU 91/91 padahal
       kode rusak. Perbaikan: `'type' in patch && patch.type === undefined`.
       **Pola ini berbahaya di semua harness berbasis tabel patch.**
    2. Uji zona waktu tidak bisa membedakan benar/salah bila WIB dan UTC
       sedang hari yang sama. Wajib ada uji dengan **jam dibekukan**
       (`2026-09-10T23:00:00Z` = 06:00 WIB hari berikutnya).
    3. Membekukan `Date` menyentuh scope global — wajib ada uji bahwa jam
       pulih sesudahnya, atau uji berikutnya mengukur waktu yang salah.
  - **JANGAN dikerjakan ulang.** Terbukti di produksi: 10 input ngawur ->
    400; jalur sukses 200; B10 401 tanpa sesi; B4 + B5 utuh; preflight 204.

- **C1** — Halaman "Layanan" publik + filter (P2) — `1a02520` (tick 21)
  - Endpoint `/api/services`: publik secara default diproteksi hanya melihat layanan aktif (`is_active = 1`).
  - Frontend (`public/index.html`): bilah pencarian real-time + filter pill kategori dinamis (`Semua`, `Reguler`, `Express`, `Satuan`, `Dry Cleaning`) dengan zero latency.
  - Halaman mandiri [`public/track.html`](file:///c:/xampp/htdocs/dhani-laundry/public/track.html) terintegrasi.
  - Terverifikasi: 13/13 Verifier HIJAU (`tools/verify_c1_run.mjs`: 18/18).

- **C2** — Tracking order publik by kode (tanpa login) (P2) — `1551773` (tick 20)
  - Endpoint publik baru: `/api/track?code=...` (dan `?order_code=...`)
  - B10 Data Isolation: `customer_phone` & `customer_address` tidak diekspos (absen), nama disamarkan (`Budi S.`)
  - Rate limiting (B1) aktif pada endpoint
  - Hardening SQL (B7 parameterized) + server error generik (B14)
  - UI landing page (`public/index.html`): modal tracking + visual progress stepper (Diterima -> Diproses -> Selesai) + auto URL parameter `?track=ORD-XXX`
  - Terverifikasi: 12/12 Verifier HIJAU (`tools/verify_c2_run.mjs`: 47/47)

- **B14** — pesan error generik di 20 titik (11 modul) + validasi `/api/pay`
  (P1) — `58fb1b5` (tick 18)
  - Ini adalah entri 12 di AGENT_BACKLOG.md yang dulu berbunyi "sisa
    pekerjaan yang nyata — pola `msg: e.message` ada di 18 titik lain".
    Setelah dihitung ulang saat implementasi, ternyata **20 titik** di
    11 modul: `checkin` (2), `customers` (2), `dashboard` (1), `delivery`
    (2), `orders` (2), `pay` (2), `promos` (2), `reports` (1), `services`
    (2), `vouchers` (2), `login` (1), `register` (1).
  - **Defek 1 — kebocoran pesan internal**: `e.message` berasal dari driver
    `@tidbcloud/serverless` dan dapat memuat connection string, nama
    database, nama tabel, dan nomor baris. Terbukti: harness menyuntikkan
    pesan berpenanda `RAHASIA: connection string mysql://...` dan teks itu
    muncul utuh di badan respons 20 endpoint (sebelum diperbaiki).
    Solusi: BARU konstanta `SERVER_ERROR` di `functions/_db.js` — satu
    sumber pesan generik agar tidak ada modul yang lupa. Ini melengkapi
    B13, yang baru membersihkan `profile.js`.
  - **Defek 2 — celah B2 di `/api/pay`** (4 sub-defek, semua terbukti):
    - `parseInt(body.amount) || 0` menerima ARRAY: `amount: [1,2]` →
      bernilai 1, INSERT ke `payments` tetap dijalankan, respons 200.
      **Nilai uang berasal dari array.**
    - Tidak ada batas atas: `amount: 2000000000` diterima mentah.
    - `method` dikirim apa adanya ke kolom
      `ENUM('QRIS','DANA','OVO','GOPAY','TRANSFER','CASH')` → nilai asing
      berakhir sebagai 500 dari TiDB, bukan 400 dari kita.
    - `order_code` tidak dibatasi padahal kolomnya `VARCHAR(20)`; 5000
      karakter hanya berakhir sebagai 500 dari DB.
    Kini ketiganya lewat `validateOr400()`; enum `method` mengikuti skema
    `DATABASE_SCHEMA.md`. GET `?order_code=` > 40 karakter juga ditolak 400.
  - **Bukti defek (diukur)**: kode lama → **MERAH 46/76**; kode baru →
    **HIJAU 76/76**. Tidak ada hijau kosong.
  - Jalur sukses diuji tidak mati: login PBKDF2 sah tetap **200** + cookie
    `HttpOnly; Secure; SameSite=Lax`; `amount` wajar tetap 200 + INSERT
    ter-parameterisasi; `method: 'DANA'` tetap 200.
  - Terbukti di produksi (`bash tools/probe_b14_live.sh`): `amount` array /
    2e9 / negatif → **400**; `method` asing → 400
    `{"ok":false,"msg":"Validasi gagal: Metode pembayaran tidak valid"}`
    (teks baru = kode baru sudah hidup); `order_code` raksasa → 400; login
    admin 200; `/api/me`, `/api/orders`, `/api/dashboard`, `/api/checkin`,
    `/api/vouchers` bersesi → 200; tanpa sesi → 401; header B4 utuh.
  - **Catatan untuk tick berikutnya — jangan terkecoh dua angka 404**:
    `pay GET ?order_code=200X` dan `pay POST method asing` bisa
    mengembalikan 404, BUKAN 400. Itu karena `order_code` 200 karakter
    ditolak lebih dulu, dan untuk `method` asing kodenya berhenti di
    "pesanan tidak ditemukan" SEBELUM `method` diuji — urutan yang benar.
    Uji ulang dengan `order_code` yang ADA untuk melihat 400 validasi.
  - **Pelajaran — `verify_b8` punya uji WAKTU.** Uji "2 hash < 10 ms"
    pernah MERAH pada 13,65 ms saat 11 verifier dijalankan berurutan;
    HIJAU 35/35 pada tiga kali ulang terpisah. `_password.js` tidak
    disentuh commit ini. Ulangi sebelum menyimpulkan regresi.
  - **Pelajaran — audit statik wajib buang komentar dulu.** Pemeriksaan
    `msg: ... e.message` mula-mula MERAH pada `profile.js` padahal file itu
    benar sejak B13 — yang cocok adalah kalimat komentarnya.

- **B13** — validasi input `/api/profile` + pesan error generik (P1,
  melengkapi B2) — `3145171` (tick 17)
  - Task ini lahir dari catatan tick 16: "endpoint mana yang belum punya
    harness?" Jawabannya `me.js`, `logout.js`, `profile.js`. Ketiganya kini
    terukur oleh `tools/verify_b13.mjs` (66 uji).
  - **Defek 1 — celah B2 di `update_profile`**: `full_name` hanya dicek
    `if (!name)`. Nama 100.000 karakter diteruskan mentah ke TiDB → 200
    (kolom VARCHAR(120) akan memotong/menolak → 500 dari DB, bukan 400 dari
    kita). Modul `_validate.js` sudah ada sejak B2, hanya belum dipakai.
  - **Defek 2 — 500 nyata, terukur**: `phone` bukan string membuat
    `(body.phone || '').trim()` melempar TypeError → 500 dengan pesan
    `(body.phone || "").trim is not a function`. Bila `phone` objek, nilai
    `[object Object]` tersimpan di kolom VARCHAR.
  - **Defek 3 — kebocoran pesan internal**: kedua `catch` di `profile.js`
    mengirim `msg: e.message`. Pesan driver DB dapat berisi connection
    string, nama tabel, nomor baris. Kini pesan generik.
  - Perubahan: `profile.js` memakai `validateOr400()` (nama 2–120, telepon
    ≤30); `_validate.js` menolak objek/array untuk tipe
    `str`/`email`/`date` (sebelumnya `String({})` = `"[object Object]"`
    lolos karena panjangnya "valid").
  - **Bukti defek (diukur)**: kode lama di-checkout dari HEAD → **MERAH
    55/66**; kode baru → **HIJAU 66/66**. Tidak ada hijau kosong.
  - Terbukti di produksi: tanpa sesi 401; nama 100.000 char → **400**
    "Nama terlalu panjang (maksimal 120 karakter)"; `phone` objek → **400**
    "Format Telepon tidak valid"; nama+telepon wajar → **200**;
    `password_hash` tidak ikut terkirim; logout `Set-Cookie` HttpOnly;
    Secure; SameSite=Lax; Max-Age=0.
  - **Pelajaran (berlaku umum)**: uji "respons tidak mengembalikan kolom
    rahasia" bisa HIJAU PALSU maupun MERAH PALSU, tergantung isi baris
    tiruan. `verify_b13` kini memotong baris sesuai daftar kolom di SELECT
    (`projectRow()`), sehingga uji mengukur handler, bukan tiruan.

- **B12** — hari check-in di zona operasional (Asia/Jakarta), bukan UTC —
  `1c2af13`
  - **Defek**: `functions/api/checkin.js` menghitung hari dengan
    `new Date().toISOString().split('T')[0]`. `toISOString()` SELALU UTC;
    Workers jalan di UTC, operasional laundry di WIB (UTC+7). Antara pukul
    00:00–06:59 WIB — jam toko mulai buka — "hari ini" menurut kode adalah
    **kemarin**. Akibat ganda: check-in pagi tercatat di baris kemarin,
    sehingga penjaga "sudah check-in hari ini" tidak pernah melihatnya dan
    satu hari bisa membuahkan DUA baris.
  - **Bukti defek (diukur)**: kode lama di-checkout dari HEAD, harness
    dijalankan → **MERAH 29/33**, dengan baris
    `06:00 WIB -> hari terkirim=2026-09-10 (harus 2026-09-11)`. Kode baru
    → **HIJAU 33/33**.
  - BARU `functions/_today.js`: `todayIn()` memakai
    `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta'})`. `en-CA` karena
    format lokalnya persis `YYYY-MM-DD`. Fallback ke UTC bila `Intl` gagal.
  - `tools/mock_tidb.mjs`: `__MOCK_ROWS` kini boleh berupa FUNGSI
    `(sql, params) => rows`, bukan hanya array — perlu karena check-in
    menjalankan SELECT "sudah ada?" lalu SELECT COUNT(*), dan harness harus
    membedakan jawabannya.
  - BARU `tools/verify_b12.mjs` + `verify_b12_run.mjs` — 33 uji untuk
    `checkin.js` (GET/POST, zona waktu, check-in ganda) DAN `vouchers.js`
    POST (hak akses, validasi `promo_id`, `bulk_claim`). Keduanya belum
    pernah punya harness sama sekali — celah yang dicatat sendiri tick 15.
  - **Terbukti di produksi**: tanpa sesi 401; admin GET `checked_today:false`
    → POST `Check-in sukses` → GET `checked_today:true` → POST lagi **400
    "Sudah check-in hari ini"**. Penjaga hari bekerja pada hari yang benar.
  - **Peringatan untuk tick berikutnya**: pola `toISOString().split('T')[0]`
    masih ada di `functions/api/delivery.js` untuk `schedule_date`. Di sana
    hanya NILAI BAWAAN saat klien tak mengirim tanggal, jadi jauh lebih
    tidak berbahaya — tetapi kalau nanti ada fitur "jadwal hari ini",
    pakai `_today.js`.

- **B11** — hak akses laporan + validasi rentang tanggal (P0 hardening) —
  `5534bc3`
  - Dua defek di `/api/reports`, keduanya lolos dari SEMUA verifier karena
    tidak ada satu pun harness yang pernah memanggil endpoint ini
    (`verify_b7` kanari SQL dan `verify_b10` IDOR tidak menyentuh reports).
  - **Defek 1 — hak akses** (hardening, BUKAN IDOR — jangan diklaim lebih
    dari kenyataan): akun Customer menerima 200 + `kpi`/`chart`/`daily`.
    Memang ada filter `customer_name = ?`, jadi bukan kebocoran baris orang
    lain. Tetapi tidak ada satu pun halaman pelanggan yang memanggil
    `/api/reports` (menu Laporan hanya dirender untuk `isStaff` di
    `public/app.js`), jadi 3 query agregat per permintaan murni terbuang.
    Kini: bukan staf → 403 SEBELUM ada query dijalankan.
  - **Defek 2 — rentang tanggal**: `?start=`/`?end=` diambil mentah lalu
    DISAMBUNG ke string `' 00:00:00'`/`' 23:59:59'` sebelum masuk
    `BETWEEN ? AND ?`. Placeholder mencegah injeksi (B7), tetapi bukan nilai
    ngawur: `start=bukan-tanggal` → 200, rentang terbalik → 200, rentang
    10.000 tahun → 200 menyapu seluruh tabel, kirim salah satu saja =
    "tanpa batas". Kini semua itu 400 dan SATU pun SELECT tidak terkirim.
  - BARU `functions/_reportfilter.js`: satu penjaga `dateRange()`.
    Mengembalikan string datetime LENGKAP supaya pemanggil tidak perlu
    menyambung apa pun (sumber nilai mentah pada defek 2). Menolak format
    salah, `2026-02-31`, rentang terbalik, >3660 hari, dan rentang sebelah.
  - `custFilter` DIHAPUS dari reports.js: staf melihat seluruh toko, jadi
    setelah 403 itu menjadi dead code.
  - **Peringatan untuk tick berikutnya**: kalau pelanggan kelak perlu
    "riwayat + total belanjaku" (backlog C6), itu endpoint BARU dengan
    agregat per pelanggan — BUKAN membuka kembali `/api/reports`.
  - **Pelajaran alat (catat!)**: `tools/audit_sql_injection.py` TIDAK
    menemukan defek 2 karena aturannya "nilai yang sudah lewat `cleanStr()`
    dianggap aman". Itu benar untuk placeholder `?`, tetapi SALAH untuk
    penyambungan string. **Pembersihan ≠ validasi format.** Audit statis
    tidak bisa melihat ini; yang menemukannya adalah membaca handler dan
    membuat harness yang memanggilnya.
  - **Pelajaran verifier (catat!)**: `tools/verify_b8_run.mjs` sesekali
    MERAH pada uji "2 hash < 10 ms" (12.57 ms saat mesin sedang sibuk).
    Itu FLAKY, bukan regresi — jalankan ulang sebelum menyimpulkan. Pola
    yang sama berlaku untuk semua uji berbasis waktu.
  - **Cara menjalankan harness dengan benar**: SELALU pakai pembungkus
    `*_run.mjs` (`node tools/verify_b10_run.mjs`), BUKAN `verify_b10.mjs`
    langsung. Tanpa loader `sql_guard_loader.mjs`, `@tidbcloud/serverless`
    tidak diganti mock-nya → handler 500 → 14/29 MERAH PALSU. Ini sudah
    menghabiskan waktu satu tick; jangan ulangi.
  - Periksa ulang: `node tools/verify_b11_run.mjs` (41/41). Jangan dikerjakan
    ulang.

- **B10** — isolasi data (IDOR) pada orders/customers/delivery/pay (P0) —
  `db95930`
  - **Ini HANYA tercatat di commit dan tick 15; AGENT_STATE.md tick 14 belum
    memuatnya.** Jangan dikerjakan ulang.
  - Defek: `GET /api/orders`, `/api/customers`, `/api/delivery` mengembalikan
    SELURUH baris untuk permintaan TANPA sesi. Penyebabnya halus: handler
    mengizinkan `user === null`, lalu `myName` menjadi `''` sehingga cabang
    `!isStaff && myName` tidak pernah menambahkan filter `customer_name`.
    Terbukti di produksi: 3 pesanan dari 3 pelanggan berbeda tampil untuk
    permintaan anonim, lengkap dengan nama/telepon/alamat/nominal.
  - orders.js, delivery.js: 401 bila tanpa sesi; fail-closed juga bila sesi
    sah tetapi tidak memuat nama. customers.js: daftar PII khusus staf.
  - pay.js: halaman pembayaran sengaja bisa dibuka tanpa login (capability
    URL), jadi tidak di-401; sebagai gantinya PII (telepon + alamat) dibuang
    untuk pemanggil yang bukan pemilik atau staf.
  - Periksa ulang: `node tools/verify_b10_run.mjs` (29/29) — PAKAI
    pembungkus `_run`, jangan file `verify_b10.mjs` langsung.

- **B9** — escaping HTML untuk seluruh data dari API (P0, stored XSS) —
  `be7d8cd`
  - **Defek**: `app.js`, `index.html`, `pay.html` menyuntikkan nilai dari
    API secara MENTAH ke `innerHTML` (mis. `${o.customer_name}`).
    `customer_name` berasal dari `users.full_name` yang bebas diisi saat
    registrasi — `_validate.js` tidak menghapus `<`, `>`, `"`. Pendaftar
    dengan nama `<img src=x onerror=...>` menjalankan skrip di browser
    setiap Admin/Owner/Staff yang membuka Dashboard/Pesanan/Pelanggan/
    Delivery. **Stored XSS yang menarget akun paling berkuasa.**
  - BARU `public/assets/escape.js`: satu helper `esc()` bersama untuk
    ketiga berkas. Meng-escape `& < > " '` — aman di isi elemen DAN di
    nilai atribut ber-tanda kutip ganda. null/undefined → `''`.
  - 46 titik penyuntikan di-escape. `dashboard.html` memuat `escape.js`
    SEBELUM `app.js` (urutan diuji).
  - **JANGAN tambah esc() berlapis**: `esc()` sengaja TIDAK idempoten
    (`esc(esc('<b>'))` merusak tampilan). Satu pemanggilan per titik.
  - Perbaikan sampingan: `pay.html?code=` kini `encodeURIComponent`;
    `t.type.toUpperCase()` → `String(t.type || '').toUpperCase()` (dulu
    satu baris `type` null merusak seluruh tabel delivery).
  - Periksa ulang: `node tools/verify_b9.mjs` (32/32) dan
    `python tools/audit_xss.py` (keduanya exit 0). Jangan dikerjakan ulang.
  - **Pelajaran alat**: audit XSS pertama MELEWATKAN `cust.`, `t.`,
    `kpi.` karena daftar variabel DB terlalu sempit. Sudah diperlebar.
    Setiap menambah renderer baru, wajib jalankan `tools/audit_xss.py`.

- **B8** — migrasi hash sandi → PBKDF2-HMAC-SHA256 (P2) — `87d3fa9`
  - Modul baru `functions/_password.js`: `hashPassword()`, `verifyPassword()`,
    `isPbkdf2Hash()`. Format `pbkdf2-sha256$<iterasi>$<salt>$<hash>` (86
    karakter, MUAT di `password_hash VARCHAR(255)` yang sudah ada).
  - **Salt acak 16 byte per pengguna** — dua hash untuk sandi yang sama
    TIDAK pernah identik. Ini inti perbaikannya: dulu salt-nya GLOBAL
    (`dhani-salt`, tertulis di sumber), jadi satu tabel pelangi berlaku
    untuk seluruh pengguna.
  - Iterasi 10.000 (BUKAN 600.000 rekomendasi OWASP) karena Workers
    menghitung **CPU time**, bukan wall clock: `tools/bench_pbkdf2.mjs`
    mengukur 10.000 → 3,4 ms, 20.000 → 6,2 ms. `change_password`
    memanggil hash **2×** (sandi lama + baru), jadi 10.000 adalah nilai
    terbesar yang masih di bawah ambang 10 ms CPU. Terukur: 3,5 ms/hash,
    7,0 ms untuk 2 hash.
  - Iterasi tersemat DI DALAM hash → konstanta bisa dinaikkan nanti tanpa
    membatalkan hash lama.
  - `verifyPassword()` tetap menerima semua format lawas yang masih hidup:
    SHA-256 + salt, SHA-256 tanpa salt, plaintext (baris debug `testhash`),
    bcrypt. Migrasi tidak mengunci siapa pun.
  - **Lazy upgrade di `login.js`**: login sah dengan hash lawas → tulis
    ulang ke PBKDF2 lewat `ctx.waitUntil()`. Tidak menahan respons; gagal
    tulis tidak membatalkan login. Hash yang SUDAH PBKDF2 tidak ditulis
    ulang (terbukti: nol UPDATE pada login kedua).
  - **Deduplikasi**: dulu ada DUA salinan algoritma (`_db.js` dan
    `login.js`) yang bisa menyimpang tanpa ketahuan. `_db.js` kini hanya
    re-export dari `_password.js`.
  - `profile.js change_password`: pakai `verifyPassword()` (satu sumber)
    dan menolak sandi baru < 6 karakter — **defek nyata**, sebelumnya
    sandi 1 karakter diterima dan langsung ditulis ke DB.
  - **TERBUKTI DI PRODUKSI** (`tools/probe_b8_live.mjs`, setelah deploy):
    `admin@gmail.com` → `pbkdf2-sha256$10000$6LBzy3uvk7…`,
    `verifyPassword('admin123') -> true`. Sebelumnya
    `0a1233d67b1b6a30…` (SHA-256 + salt global).
  - Bukti: `node tools/verify_b8_run.mjs` → **HIJAU 35/35**, exit 0. Uji
    menangkap SQL UPDATE yang benar-benar dikirim (bukan menebak).
    Regresi: B7 nol temuan, B2 47/47, B5 50/50, B1 HIJAU, A3b 15/15.
  - **JANGAN dikerjakan ulang.**
  - **CATATAN**: jangan naikkan iterasi tanpa mengukur ulang
    `tools/bench_pbkdf2.mjs` — `change_password` memanggil hash 2× dan akan
    melewati batas CPU Workers pada > 10.000.
  - **CATATAN**: `verifyPassword()` sengaja masih menerima plaintext dan
    SHA-256 lawas. Itu BUKAN regresi — itu syarat agar pengguna yang belum
    login ulang tidak terkunci. Hapus jalur lawas hanya setelah seluruh
    baris berformat PBKDF2 (pantau dengan `tools/probe_hash.mjs`).

- **B5** — CORS ketat: hanya origin sendiri (P1) — `d32c367`
  - Modul baru `functions/_cors.js`: `isOriginAllowed()`, `corsHeaders()`,
    `applyCors()`. Daftar izin: origin produksi + `*.dhanisepeda.workers.dev`
    (preview) + `localhost`/`127.0.0.1`/`[::1]` (dev) + `ALLOWED_ORIGINS`
    dari env.
  - 6 titik hardcoded `Access-Control-Allow-Origin: *` DIHAPUS:
    `jsonResponse()` + `corsOptions()` (`_db.js`) dan `onRequestOptions` di
    `auth/login`, `auth/logout`, `auth/register`, `health`.
  - `src/index.js`: `applyCors()` dipasang di 3 jalur (preflight OPTIONS,
    respons handler, 404 endpoint) → terpusat, tidak ada yang lolos.
  - `Vary: Origin` dikirim bila ada header Origin → CDN tidak mencampur
    respons antar-origin.
  - Bukti: `node tools/verify_b5_run.mjs` → **HIJAU 50/50**, exit 0.
    Uji menjalankan `src/index.js` sungguhan (bukan fungsi terisolasi).
  - Post-verify produksi mengukur AKHIRAT: origin `evil.example.com` →
    **tanpa ACAO**; origin produksi → ACAO persis + `Max-Age: 86400`;
    preflight OPTIONS tetap 200 (bukan 405); nol regresi
    (`/` `/api/health` `/api/services` 200, login admin 200, `/dashboard` 200).
  - **JANGAN dikerjakan ulang.**
  - **CATATAN**: `Access-Control-Allow-Methods` / `-Headers` sengaja MASIH
    dikirim ke origin asing. Itu tidak membocorkan apa pun (tanpa ACAO
    browser tetap memblokir) dan menjaga preflight tidak jadi 405.
- **B2** — validasi & sanitasi input server-side (P1) — `c9db43b`
  - Modul baru `functions/_validate.js`: `validate(body, spec)`,
    `validateOr400()`, `cleanStr()`, `isEmail()`, `isDate()`.
    Tipe: `str`, **`raw`** (kata sandi: panjang dibatasi, TIDAK
    dibersihkan), `int`, `enum`, `bool`, `email`, `date`.
  - 7 handler dipasang: `customers`, `services`, `orders`, `promos`,
    `vouchers`, `auth/register`, `auth/login`.
  - Defek nyata yang diperbaiki (bukan "sudah aman dari dulu"):
    (1) `Math.max(1, parseInt(weight_kg))` mengizinkan **100000 kg**, kini
    1..1000; (2) `bulk_claim` menerima **daftar user tak terbatas**, kini
    maks 500; (3) register **tidak punya batas bawah sandi**, kini min 6;
    (4) `start`/`end` digabung mentah ke `'... 00:00:00'`, kini wajib
    `YYYY-MM-DD`; (5) persen promo bisa **500**, kini maks 100.
  - Bukti: `node tools/verify_b2_run.mjs` → **HIJAU 47/47**, exit 0.
    Regresi hijau: B7, B1, A3b. `node --check` semua → exit 0.
  - **JANGAN dikerjakan ulang.**
  - **PERINGATAN**: `cleanStr()` mengganti karakter kontrol jadi SPASI
    (bukan menghapus) agar kata tak melebur. Kata sandi wajib pakai tipe
    `raw` — jangan pernah `cleanStr()` pada sandi.
- **A3b** — token baru untuk 9 warna sisa (P2) — `f782d3d`
  - 13 token nilai-persis: `--color-slate-50/400/500/800/950`,
    `--color-bg-inverse`, `--color-border-inverse`,
    `--color-text-on-inverse{, -muted, -subtle}`, `--color-rating`,
    `--color-error-500`
  - 9 kemunculan dimigrasi di `index.html` → sisa hex 22 → 11
    (10 di `:root` inline + 1 `<meta theme-color>`)
  - Bukti: `python tools/verify_a3b.py` → HIJAU 15/15, exit 0
  - **JANGAN dikerjakan ulang.** Jangan "merapikan" slate → neutral (beda
    nilai = regresi visual). Jangan definisikan ulang
    `--color-text-inverse` (sudah ada, `#ffffff`, dipakai halaman lain).
- **A5** — endpoint `/api/health` — `d6cea6a`
- **B4** — security headers global — `9632507`
- **B6** — cookie `HttpOnly; Secure; SameSite=Lax` — (sudah benar sejak awal)
- **A7** — verifikasi 16 endpoint terdaftar — (sudah tuntas sejak awal)
- **A1** — link design-tokens.css **SELESAI PENUH** — `21a94ea`
  - Termasuk perbaikan bug produksi: 2 aset yang belum ter-commit
- **A2** — hero canvas p5.js + `#hero-canvas-container` — `23e3fe2`
  - Perbaikan draft: palette dark + `clear()` (bukan `background()`),
    `pointer-events:none`, guard mount, orbs pre-render ke buffer statis
- **A8** — robots.txt + sitemap.xml + meta/OG tags — `a502402`
  (selesai tick 6; tabel backlog belum ditandai `[x]`, perlu disinkronkan)
- **A3** — migrasi hardcoded hex → token (sebagian) — `796e81e`
  - 25 baris diubah, 27 kemunculan diganti, **value-identical → nol regresi**
  - Token dipakai: `--color-neutral-0` (25x), `--color-brand-500/600/900`
  - Sisa 18 kemunculan TIDAK diganti: tidak ada token dengan nilai persis
    (`#94a3b8`x4 `#f8fafc`x3 `#64748b`x2 `#1e293b`x2 `#0f172a` `#e2e8f0`
    `#090d16` `#f59e0b` `#ef4444`) → calon task **A3b**
  - Tidak diganti juga: `<meta theme-color>` (`var()` tidak resolve di
    atribut HTML) dan blok `:root` inline (Gate 5 membolehkan)
- **B7** — audit SQL injection (P0) — `ea05d42`
  - Bukti, bukan keyakinan: 67 string SQL literal diaudit
    (`tools/audit_sql_injection.py`), 57 ber-placeholder `?`, **0 memakai
    interpolasi nilai user**. 17 handler diuji runtime
    (`tools/verify_b7_run.mjs`) dengan canary → **0 SQL kotor**.
  - 2 modul di-hardening (bukan "sudah aman dari dulu"):
    - `dashboard.js`: fragmen `${custFilter}`/`${custFilterAnd}` yang
      disambung ke SQL diganti dua bentuk SQL **penuh terpisah** yang
      digerakkan boolean `scoped`.
    - `reports.js`: `?group=` kini lookup di peta konstanta `GROUP_EXPR`;
      kunci asing jatuh ke 'bulan' (terbukti: canary → `DATE_FORMAT`).
  - Alat baru ter-commit: `audit_sql_injection.py`, `mock_tidb.mjs`,
    `sql_guard_loader.mjs`, `verify_b7.mjs`, `verify_b7_run.mjs`.
- **B1** — rate limit `/api/auth/login` (P1) — `9981427` + `ea05b75`
  - **Dua lapis**: memori per-isolate (10/5 mnt) + **Cache API shared
    per-datacenter (20/5 mnt)**. Lapis 1 saja terbukti tidak cukup.
  - Modul baru `functions/_ratelimit.js`; harness `tools/verify_b1.mjs`
    (7 uji, HIJAU) + `tools/mock_tidb.mjs` kini bisa menyuntik baris.
  - 2 defek urutan diperbaiki: (1) `getDb()` sebelum parse body → body
    rusak jadi 500, kini 400; (2) header Remaining diukur ulang via `peek()`.
  - Terbukti di produksi: 429 pada percobaan ke-21, `Retry-After: 277`,
    dan **self-healing** (login sah 200 lagi setelah jendela kedaluwarsa).
- **A4** — semua API `try/catch` → respons JSON `{ok}` konsisten — `c07ed88`
  - 2 defek produksi nyata diperbaiki (bukan sekadar "sudah ada try"):
    (1) body JSON rusak → **500 dari runtime**, kini 400 `{ok:false}`;
    (2) preflight OPTIONS → **405/401** di 11/16 endpoint, kini 204/200
  - Helper baru di `_db.js`: `readJson(request)` + `corsOptions(methods)`
  - `me.js` dibungkus try/catch (satu-satunya `await` di luar guard)
  - Alat audit ikut ter-commit: `tools/audit_api_guard.py`,
    `tools/audit_throw_sites.py`, `tools/probe_api.py`

## Blokir

- **A6** (P0) — secret `TIDB_DATABASE_URL` + `JWT_SECRET` masih plaintext di
  `wrangler.toml`. Butuh **Cloudflare API token** untuk `wrangler secret put`.
  - Butuh: `CLOUDFLARE_API_TOKEN` dengan izin Workers Secrets:Edit
  - Atau: manusia jalankan `npx wrangler secret put TIDB_DATABASE_URL` manual
  - Sejak: 2026-09-08T21:42
  - Task terdampak: A6, B3 (sebagian)
- **Catatan mitigasi**: JWT sudah baca `env.JWT_SECRET` dengan fallback;
  setelah secret diset di produksi, fallback otomatis tidak terpakai.

## Tech debt tercatat

1. `wrangler.toml` berisi `TIDB_DATABASE_URL` + `JWT_SECRET` plaintext → **P0**.
2. `public/index.html` — sisa **11 kemunculan hex pada 11 baris** setelah
   A3b (`f782d3d`), turun dari 49 kemunculan/47 baris. Sisanya:
   - 10 di blok `:root` inline (definisi, wajar — Gate 5 membolehkan)
   - 1 `<meta name="theme-color" content="#2563eb">` — `var()` TIDAK
     di-resolve di atribut HTML, jangan diganti
   - **9 warna sisa A3b SUDAH SELESAI** (`#94a3b8` `#f8fafc` `#64748b`
     `#1e293b` `#090d16` `#f59e0b` `#ef4444`) — kini token keluarga
     **slate** (`--color-slate-*`) terpisah dari **neutral** (warm).
     Jangan "merapikan" slate → neutral: nilainya berbeda = regresi visual.
   - CATATAN PENGUKURAN: baseline lama mencatat "40" (itu `grep -c` =
     BARIS). Pakai `tools/hexdiff.py` dan laporkan baris DAN kemunculan.
2a. **B4 belum mencakup aset statis.** Header keamanan
   (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`) ADA di `/api/*`
   tetapi TIDAK ada di respons HTML statis (`/`, `/dashboard`). B4 dulu
   ditandai selesai hanya karena diverifikasi lewat endpoint API.
   Perlu ditambahkan di jalur serve-aset di `src/index.js`.
2b. p5.js kini dependensi baru (CDN 1.03MB, SRI-pinned, deferred).
   - Draft `hero-canvas.js` awalnya TIDAK bisa dipakai langsung: palette
     near-white di atas hero gradient gelap. Sudah diperbaiki.
   - Jika nanti ingin nol dependensi, port sketch ke raw canvas 2D
     (~150 baris) dan hapus tag p5 + integrity.
4. 4 tabrakan nama token `index.html` vs `design-tokens.css`:
   `--radius-lg` (18 vs 12px), `--radius-md` (12 vs 8px), `--radius-sm`
   (8 vs 6px), `--shadow-sm` (beda nilai). Link sengaja diletakkan SEBELUM
   `<style>` inline supaya `:root` index menang → nol regresi visual.
   Saat A3 dikerjakan, hapus blok `:root` inline agar token yang menang.

## Catatan untuk tick berikutnya

- **URL PRODUKSI**: `https://embun-laundry.dhanisepeda.workers.dev` —
  bukan `dhani078`. Sumber kebenaran: `public/sitemap.xml`.
- **Urutan fokus**: FASE A selesai kecuali **A6** (terblokir, butuh
  Cloudflare API token). FASE B: **B7 selesai**, **B1 selesai**,
  **A3b selesai**, **B2 selesai (tick 11)**, **B5 selesai (tick 12)**.
  → **Berikutnya B8** (hash sandi PBKDF2 via WebCrypto) atau masuk FASE C
  (fitur). B8 butuh migrasi: sandi lama SHA-256(`dhani-salt` + pw) harus
  tetap bisa login → simpan format lama dulu, rehash saat login sukses.
- **FASE C sudah dimulai**: **C2 selesai** (`1551773` + `7362779`),
  **C1 selesai** (`1a02520` + `292523c`). Berikutnya C3 (notifikasi
  real-time status) atau C6 (riwayat order pelanggan).
- **C2 JANGAN dikerjakan ulang.** Endpoint `/api/track` sudah ada dan
  teruji 58/58. Periksa ulang dengan `node tools/verify_c2_run.mjs`.
  Yang perlu diingat: endpoint ini **publik tanpa login**, dan kode pesanan
  hanya ~46 ribu kemungkinan per milidetik → `publicView()` adalah
  allowlist. Menambah field ke sana tanpa uji "TIDAK bocor" = celah PII.
- **Ada agent lain mengerjakan repo ini bersamaan** (terbukti tick 22:
  `run_all_verifiers.sh` dan `AGENT_LOG.md` diubah oleh sibling subagent,
  dan C1/C2 ter-commit di luar tick). Karena itu:
  - SELALU `git status` + `git diff HEAD` sebelum menyimpulkan
    "pekerjaanku hilang" — bisa jadi sudah ter-commit oleh sibling.
  - Refresh `.agent-lock` di tengah tick yang panjang, jangan hanya di awal.
  - Jangan menulis file .md tanpa `git pull --rebase` sesaat sebelum itu.
- **Uji mutasi adalah cara membuktikan harness punya gigi.** Hijau saja
  tidak berarti apa-apa. Tick 22 merusak kode sengaja 3x (hapus
  `?order_code=`, bocorkan PII, salah `progress_step`) dan harness MERAH
  setiap kali (56/58, 54/58, 57/58). Terapkan pola ini ke verifier baru.
- **B5 JANGAN dikerjakan ulang.** Sudah tuntas `d32c367`. Untuk memeriksa
  ulang: `node tools/verify_b5_run.mjs` (exit 0, HASIL: HIJAU 50/50).
  Jangan "memperbaiki" `Access-Control-Allow-Methods` yang masih dikirim ke
  origin asing — itu disengaja agar preflight tidak jadi 405.
- Semua `fetch()` di `public/` memakai URL relatif (`/api/...`) → same
  origin, jadi daftar izin B5 aman. Sudah diperiksa (26 pemanggilan).
  Jika nanti ada domain kustom, set `ALLOWED_ORIGINS` di dasbor Cloudflare.
- **B2 JANGAN dikerjakan ulang.** Sudah tuntas `c9db43b`. Periksa ulang
  dengan `node tools/verify_b2_run.mjs` (exit 0, HASIL: HIJAU 47/47).
- **A3b JANGAN dikerjakan ulang.** Sudah tuntas `f782d3d`. Untuk memeriksa
  ulang: `python tools/verify_a3b.py` (exit 0, HASIL: HIJAU).
- **B1 JANGAN dikerjakan ulang.** Sudah tuntas `ea05b75`. Untuk memeriksa
  ulang: `node tools/verify_b1.mjs` (7 uji, HASIL: HIJAU).
- **PELAJARAN PENTING (berlaku umum)**: jangan menandai selesai hanya karena
  uji lokal hijau. Uji lokal B1 hijau untuk lapis memori saja, tetapi
  produksi membuktikan batasnya tidak berlaku (13 percobaan × 0 × 429).
  Selalu lakukan post-verify produksi yang mengukur AKHIRAT — bukan sekadar
  "endpoint masih 200".
- **B7 JANGAN dikerjakan ulang.** Sudah tuntas `ea05d42`. Jika ingin
  memeriksa ulang, jalankan `python tools/audit_sql_injection.py` (exit 0)
  dan `node tools/verify_b7_run.mjs` (HASIL: HIJAU) — itu cukup, jangan
  menulis ulang audit dari nol.
- **Pola verifikasi B7 bisa dipakai lagi** untuk task keamanan lain:
  ganti dependensi berbahaya dengan mock pencatat lewat ESM loader
  (`tools/sql_guard_loader.mjs`), lalu ukur apa yang benar-benar dikirim,
  bukan apa yang tertulis di sumber. Untuk B1 (rate limit) pola ini juga
  cocok: panggil handler 20x dan hitung respons 429.
- **`execute_code` DIBLOKIR di cron** (kebijakan: arbitrary local Python
  butuh persetujuan; cron tidak punya user). Pakai `terminal` + skrip di
  `tools/`, atau `search_files`. Jangan merencanakan langkah yang butuh
  `execute_code`.
- Untuk A3b: tambahkan dulu token ke `design-tokens.css`, baru ganti
  pemakaiannya. Jangan ganti hex ke token yang nilainya berbeda.
- Blok `:root` inline di `index.html` MASIH ADA dan menang atas
  `design-tokens.css` (link sengaja sebelum `<style>`). Menghapusnya
  mengubah 4 nilai radius/shadow (lihat debt #4) → butuh uji visual.
- **PENTING — jangan percaya `grep -c try` untuk A4**: 14/16 handler sudah
  punya `try`, jadi audit dangkal akan bilang "A4 hampir selesai". Yang
  rusak justru yang tidak terlihat: body JSON rusak dan preflight OPTIONS.
  Pakai `tools/probe_api.py` (lawan produksi) untuk mengukur kontrak, bukan
  menghitung kata kunci.
- `tools/probe_api.py` **TIDAK BISA dipakai apa adanya**: urllib
  (UA `Python-urllib/*`) diblokir Cloudflare → error 1010, semua respons
  403. Pakai `curl` (UA default) untuk probe produksi. Jika ingin memakai
  script itu lagi, set UA browser lewat header.
- Saat A3: hapus blok `:root` inline di index.html agar token
  design-tokens.css menang. Waspadai 4 tabrakan nilai (lihat tech debt #4).
- Sekarang ada 3 alat audit (sudah ter-commit): `audit_api_guard.py`
  (try/catch per handler), `audit_throw_sites.py` (buktikan handler tanpa
  try aman = nol throw site), `probe_api.py` (kontrak lawan produksi).
  `analyze_tokens.py` + `hexdiff.py` + `verify_a2.py` untuk A3.
- **Browser tool TERBLOKIR** di cron: Chrome minta persetujuan remote
  debugging manual. Verifikasi runtime harus lewat DOM/HTTP (cukup untuk
  A3/A4/A8; B1 rate-limit juga bisa di-HTTP).
- Saat A3: hapus blok `:root` inline di index.html agar token
  design-tokens.css menang. Waspadai 4 tabrakan nilai (lihat tech debt #4).
- Ingat: `@tidbcloud/serverless` `execute()` return `[]` untuk INSERT —
  pakai SELECT terpisah.
- Jangan ubah `name = "embun-laundry"` di `wrangler.toml`.
- Jangan sentuh `auth/login.html` dan `auth/register.html` (inline CSS stabil).

## Checklist tick terakhir (tick 4 — A2)

```
[x] Baca AGENT24.md + AGENT_STATE.md
[x] git pull --rebase origin main
[x] Baseline verifikasi hijau?
[x] Task terpilih dari backlog (A1)
[x] Rencana ≤10 baris
[x] Implementasi
[x] node --check semua JS → 0 error
[x] Struktur HTML valid
[x] Smoke test login + services
[x] Tidak ada hardcoded color BARU (40 hex = debt lama, tidak bertambah)
[x] A11y dasar
[x] Commit + bukti
[x] Push
[x] Post-verify produksi
[x] Update AGENT_STATE.md + AGENT_LOG.md
```

## Catatan verifikasi manual (2026-09-09 11:15)

- **B1 rate limit AKTIF dan bekerja benar.** Saat verifikasi manual, IP
  penguji sudah melewati batas 10 percobaan / 5 menit, sehingga
  `POST /api/auth/login` mengembalikan **429**
  `{"ok":false,"msg":"Terlalu banyak percobaan login. Coba lagi nanti."}`.
- **Ini BUKAN bug.** Jangan "memperbaiki" endpoint login saat melihat 429.
  Rate limit akan pulih sendiri setelah jendela 5 menit lewat.
- Endpoint non-auth tetap normal: `/api/services` → 200, `/` → 200.
- Saat memverifikasi login di tick berikutnya, **batasi percobaan** agar tidak
  memicu rate limit sendiri. Cukup 1–2 percobaan per tick.

## Ringkas tick 25 (B17) + penuntasan buku tick 24 (B16)

- **B16** `502d56a` (tick 24, crash sebelum merapikan dokumen) — batas
  validasi selaras lebar kolom TiDB. Diverifikasi ulang 156/156 dan
  terbukti di produksi. **SELESAI, jangan dikerjakan ulang.**
- **B17** `a8ca085` (tick 25) — `POST /api/pay` kini wajib sesi.
  **SELESAI, jangan dikerjakan ulang.** Periksa ulang dengan
  `node tools/verify_b17_run.mjs` (HASIL: HIJAU 19/19).
- `GET /api/pay` **TETAP publik dan sengaja demikian** — halaman
  pembayaran dibuka lewat tautan berkode dan B10 sudah menyensor
  telepon/alamat. Jangan "diperbaiki" menjadi 401.

## Ringkas tick 26 (B18) — jaring regresi untuk kelas defek B17

- **B18** `ab7026e` (tick 26) — audit kata kerja TULIS pada SEMUA modul.
  **Bukan perbaikan defek**: nol baris di `functions/` diubah. B17 lolos
  bertahun-tahun karena `verify_b10` mengimpor `pay.js` tetapi hanya menguji
  GET; B18 menutup polanya. **SELESAI, jangan dikerjakan ulang.**
- Hasil: **HIJAU 76/76**, nol jalur tulis terbuka. Periksa ulang dengan
  `node tools/verify_b18_run.mjs` (terdaftar di `run_all_verifiers.sh`,
  kini 17 verifier).
- Yang diukur adalah **SQL tulis yang benar-benar terkirim**, bukan status —
  401 yang dikembalikan SETELAH `db.execute()` tetap meninggalkan baris.
- **Registrasi diuji dengan asersi TERBALIK**: mendaftar adalah satu-satunya
  penulisan yang memang harus bisa tanpa sesi. Jangan "diperbaiki" jadi 401.
- Uji mutasi 5x: 1 MERAH 73/76, 2 HIJAU 76/76 (bukan celah — penjaga masih
  mendahului tulis), 3 MERAH 72/76, 4 MERAH 74/76, 5 MERAH 74/76.

### Pelajaran tick 26 (berlaku umum)

- **Mutasi yang HIJAU belum tentu berarti harness lemah.** Mutasi "tulis
  sebelum penjaga" pada `delivery.js` tetap HIJAU 76/76, dan itu BENAR:
  `delivery.js` punya penjaga `!user` di tingkat atas sehingga mutasi
  setempat tak bisa menghasilkan penulisan. Baru di `services.js` (GET
  publik, tanpa penjaga atas) pola B17 terbukti MERAH 72/76. **Sebelum
  menyimpulkan harness tak punya gigi, cek penjaga lapis lain di modul.**
- `audit_api_guard.py` mengembalikan exit 1 dengan 10 handler tanpa
  try/catch — **keadaan lama, bukan regresi**. Semuanya dispatcher
  (`onRequest`) / `health` / `me.js` yang tidak menyentuh DB, dan
  `audit_throw_sites.py` (exit 0) membuktikan nol throw site. Jangan
  "diperbaiki" tanpa bukti defek nyata.

### Pelajaran tick 25 (berlaku umum)

- **Uji keamanan yang hanya menyentuh GET buta terhadap celah TULIS.**
  `verify_b10` mengimpor `pay.js` tetapi hanya menguji GET — celah POST
  lolos bertahun-tahun. Bila sebuah modul punya dua kata kerja, uji keduanya.
- **401 yang dikembalikan SETELAH `db.execute()` tetap meninggalkan baris.**
  Maka `verify_b17` mengukur INSERT yang terkirim, bukan status; mutasi
  "guard dipindah setelah INSERT" terbukti MERAH. Wajib ada untuk setiap
  perbaikan autentikasi.
- **Bentuk objek `createSessionToken()`: `{role, full_name}`**, bukan
  `{user_role, user_name}` (yang terakhir adalah bentuk JWT hasilnya).
  Salah bentuk membuat staf menjadi "Customer" → uji MERAH karena
  kesalahan harness, atau HIJAU PALSU bila semua peran menjadi sama.
- **Kontrak field yang sering salah saat probing produksi:**
  login = `identity` (bukan `email`); `customers` POST = `full_name`
  (bukan `name`); `orders` list = GET tanpa `action`; metode bayar
  huruf KAPITAL (`CASH`, bukan `cash`).
- **Deploy kali ini butuh ~200 detik** (bukan ~90). Bila post-verify masih
  menunjukkan perilaku lama, ulangi sekali sebelum menyimpulkan gagal.
- `/tmp` TIDAK bisa ditulis di lingkungan ini — pakai `.tmp/` di project
  untuk menyimpan cookie/respons curl.
