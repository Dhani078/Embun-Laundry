# AGENT STATE

Terakhir update: 2026-09-16T11:42:00+08:00
Tick ke: 47
Model: kr/auto

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
| `/api/notifications` | 200 / 400 | Query order_code required, rate limited 30 req/5m |
| `/api/promos` | 200 | Filter q, active, id (?id=); CRUD staf; OPTIONS CORS |
| `/api/vouchers` | 200 / 401 | Staf query u.full_name, u.email; grant/bulk/delete; OPTIONS CORS |
| `/api/reports` | 200 / 403 | Staf KPI, chart grouping, daily; Customer 403; OPTIONS CORS |
| `/assets/design-tokens.css` | **200** | DULU 404 — sudah fix di tick 3 |
| `/assets/hero-canvas.js` | **200** | DULU 404 — sudah fix di tick 3 |
| login admin | OK | Sesi tertutup (kredensial default dicabut dari dokumentasi) |

## Task aktif

- ID: — (tidak ada; tick 47 selesai)
- Judul: —
- Fase: selesai
- Mulai: —

## Task selesai

- **D6** (Fase D) — Micro-interaction konsisten (hover/focus/active) (P3) —
  `a43dfb7` (tick 47)
  - **Sistem Micro-Interaction Aksesibel & Efek Ripple Ringan**:
    - Stylesheet `public/assets/style.css`:
      - Sistem universal `:focus-visible` high-contrast untuk navigasi keyboard (`2px solid var(--blue)` offset 2px), dan membersihkan outline klik mouse (`:focus:not(:focus-visible)`).
      - State `:focus-visible` spesifik pada `.btn`, `.btn-primary`, `.btn-icon`, `.tabbtn`, `.tab`, `.theme-toggle-btn`, `.input`, `select`, `textarea`, dan link navigasi `.nav a`.
      - State `:active` snappy micro-press (`transform: translateY(1px) scale(0.98)`) pada seluruh varian tombol dan link navigasi.
      - State `:hover` pada form input dengan transisi border halus (`var(--color-border-default)`) dan elevasi hover pada tombol.
      - State `:disabled` yang konsisten (`opacity: 0.55`, `cursor: not-allowed`, `pointer-events: none`).
      - Highlight baris tabel `.table tbody tr:hover` dengan warna token brand (`var(--blue-soft)`, `var(--blue-border)`).
      - Menghormati penuh aksesibilitas `@media (prefers-reduced-motion: reduce)` dengan menonaktifkan transform, scale, dan animasi bagi pengguna sensitif gerak.
    - Frontend SPA `public/app.js`:
      - Menambahkan delegator pointerdown ringan `App.initRipple()` yang terikat ke `.btn`, memicu gelombang ripple CSS 60fps tanpa library pihak ketiga (0 dependency).
    - Harness & Verifikasi:
      - Membuat `tools/verify_d6.mjs` dan `tools/verify_d6_run.mjs` (30/30 HIJAU).
      - Mendaftarkan `verify_d6_run.mjs` ke `tools/run_all_verifiers.sh` (40/40 verifier proyek HIJAU 100%, 0 regresi).
      - Uji mutasi: Merusak deklarasi `:active` tombol memicu kegagalan (MERAH, exit 1); pemulihan kembali 100% HIJAU (exit 0).

- **D1** (Fase D) — Terapkan design token ke seluruh dashboard (P3) —
  `312f774` (tick 46)
  - **Penerapan Design Token Global & Pembersihan Dead Code**:
    - `public/assets/style.css`:
      - Menjembatani seluruh variabel `:root` langsung ke token desain otoritatif di `design-tokens.css` (`--bg`, `--card`, `--line`, `--muted`, `--text`, `--blue`, `--green`, `--amber`, `--red`, `--shadow`, dll).
      - Menghapus duplicate dead code: blok redundant `.card` (~25 baris) dan duplicate `.table` (~60 baris) dibersihkan tuntas, meringankan bundle CSS.
      - Menstandarkan komponen inti (`.sidebar`, `.card`, `.table`, `.input`, `.btn-primary`) ke semantic token.
    - `public/app.js`:
      - Mengeliminasi 100% hardcoded inline card background (`background: #fff` / `#ffffff`) dan border (`#e2e8f0` / `#cbd5e1`), memastikan seluruh kartu di 8 view (`renderDashboard`, `renderPesanan`, `renderPelanggan`, `renderLayanan`, `renderDelivery`, `renderPromo`, `renderLaporan`, `renderProfile`) mengalirkan styling token secara otomatis dan responsif terhadap dark/light mode.
      - Memperbarui dialog popup modal (konfirmasi `_appConfirm`, bukti transfer `proofModal`, struk/invoice modal `invoiceModal`) ke token CSS.
      - Memperbarui SVG chart di `buildSvgChart` untuk menggunakan `var(--line)`, `var(--muted)`, dan inverted tooltip tokens.
    - Harness & Verifikasi:
      - Membuat `tools/verify_d1.mjs` dan `tools/verify_d1_run.mjs` (38/38 HIJAU).
      - Mendaftarkan `verify_d1_run.mjs` ke `tools/run_all_verifiers.sh` (39/39 verifier proyek HIJAU 100%, 0 regresi).
      - Uji mutasi: Merusak deklarasi token `:root --bg` memicu kegagalan (MERAH, exit 1); pemulihan kembali 100% HIJAU (exit 0).

- **D3 & D4** (Fase D) — Skeleton loading di semua tabel & Empty state bermakna (P3) —
  `1d5feaf` (tick 45)
  - **Skeleton Shimmer Loading & Empty States**:
    - Stylesheet `public/assets/style.css`:
      - Menambahkan kelas utilitas `.skeleton`, `.skeleton-text`, `.skeleton-title`, `.skeleton-badge`, `.skeleton-btn`, `.skeleton-card`, dan `.skeleton-table-wrap`.
      - Efek animasi gradien shimmer murni berbasis CSS (`@keyframes skeletonShimmer`) dengan warna adaptif otomatis pada mode terang dan mode gelap (`[data-theme="dark"]`, `html.dark`).
      - Menghormati aksesibilitas `prefers-reduced-motion` dengan mengganti animasi geser shimmer menjadi pulsasi opasitas statis lembut.
      - Menambahkan komponen `.empty-state` yang elegan (ikon, judul, deskripsi, dan tombol aksi).
    - Aplikasi SPA `public/app.js`:
      - Helper reusable: `App.renderSkeletonTable()`, `App.renderSkeletonCards()`, dan `App.renderEmptyState()`.
      - Menggantikan seluruh teks mentah "Memuat..." pada 7 fungsi render utama (`renderDashboard`, `renderPesanan`, `renderPelanggan`, `renderLayanan`, `renderDelivery`, `renderPromo`, `renderLaporan`, dan `renderProfile`).
      - Menyematkan render empty state terstruktur saat hasil query array bernilai kosong (`orders`, `customers`, `services`, `tasks`, `promos`).
    - Harness & Verifikasi:
      - Membuat `tools/verify_d3.mjs` dan `tools/verify_d3_run.mjs` (26/26 HIJAU).
      - Mendaftarkan `verify_d3_run.mjs` ke `tools/run_all_verifiers.sh` (38/38 verifier HIJAU, 0 regresi).
      - Pengujian mutasi: Merusak nama keyframe shimmer memicu kegagalan (MERAH, exit 1); pemulihan kembali 100% HIJAU (exit 0).

- **D2** (Fase D) — Dark mode toggle (localStorage, anti-FOUC script) (P3) —
  `f6d59dd` (tick 44)
  - **Dark Mode Modern (Linear/Vercel Dark Slate Aesthetic) & Persistensi**:
    - Desain & Token Sistem:
      - `public/assets/design-tokens.css`: Menambahkan rules `[data-theme="dark"], html.dark` dengan palet slate elegan (`#090d16` canvas, `#111827` elevated surface, `#1e293b` border subtle, `#f8fafc` text).
      - `public/assets/style.css`: Menambahkan dark variables, `.sidebar` diperbarui menggunakan `background: var(--card);` (menghapus hardcode putih), perbaikan warna nav, topbar, cards, inputs, dan tables di tema gelap.
      - Menambahkan styling tombol `.theme-toggle-btn` dengan efek hover dan transisi micro-interaction halus.
    - Anti-FOUC (Flash of Unstyled Content):
      - Menyematkan script sinkronus inline anti-FOUC di `<head>` sebelum CSS di seluruh file HTML (`dashboard.html`, `index.html`, `track.html`, `pay.html`).
      - Membaca preferensi dari `localStorage.getItem('theme')` dengan fallback cerdas ke `window.matchMedia('(prefers-color-scheme: dark)')`.
    - Komponen Tombol Toggle & Logika SPA:
      - `public/app.js`: Mengimplementasikan `App.initTheme()`, `App.applyTheme()`, `App.toggleTheme()`, dan `App.updateThemeIcons()`.
      - Sinkronisasi multi-tab real-time via event listener `storage`.
      - Tombol `#themeToggleBtn` di topbar Dashboard SPA, navigasi Landing Page, header Pelacakan (`track.html`), dan halaman Pembayaran (`pay.html`).
    - Harness & Verifikasi:
      - Membuat `tools/verify_d2.mjs` dan `tools/verify_d2_run.mjs` (30/30 HIJAU).
      - Mendaftarkan `verify_d2_run.mjs` ke `tools/run_all_verifiers.sh` (37/37 verifier HIJAU, 0 regresi).
      - Pengujian mutasi: Merusak key `localStorage` menyebabkan 3 kegagalan (MERAH, exit code 1); pemulihan kembali 100% HIJAU (exit code 0).

- **C4** (Fase C4) — Upload Bukti Pembayaran (Cloudflare R2 / base64 kecil) (P3) —
  `b3a4e0f` (tick 43)
  - **Upload & Verifikasi Bukti Transfer Pembayaran**:
    - Skema Database `db/migrations/0006_add_proof_image_to_payments.sql`: Menambahkan kolom `proof_image MEDIUMTEXT NULL` pada tabel `payments`.
    - Backend API `functions/api/pay.js`:
      - Memvalidasi secara ketat format bukti pembayaran: hanya mengizinkan data URI gambar sah (`image/jpeg`, `image/png`, `image/webp`).
      - Menolak dengan aman format berbahaya berpotensi Stored XSS seperti SVG (`data:image/svg+xml`), dokumen HTML, atau executable (status 400).
      - Membatasi ukuran muatan bukti (maksimal ~1.5MB base64).
      - Memasukkan `proof_image` via parameterized SQL query (`?`) untuk mencegah SQL injection.
      - Mengembalikan `proof_image` pada payload respons `POST /api/pay` dan query `GET /api/pay`.
    - Frontend Pelanggan `public/pay.html`:
      - Menggantikan alur dummy `alert()` lama dengan antarmuka pembayaran interaktif modern.
      - Seleksi metode pembayaran (QRIS, TRANSFER, DANA, GOPAY, OVO, CASH) beserta nomor rekening resmi & petunjuk transfer.
      - Dropzone interaktif untuk unggah foto bukti transfer dengan drag-and-drop, pratinjau thumbnail, tombol hapus, dan optimasi kompresi otomatis di sisi klien menggunakan HTML5 Canvas.
      - Pengiriman riil `POST /api/pay` dengan feedback status sukses dan rincian transaksi.
    - Frontend Staf `public/app.js`:
      - Menambahkan method `App.viewPaymentProof(orderCode)` dan dialog modal pratinjau bukti transfer (`proofModal`).
      - Tombol aksi `🖼️ Bukti` pada setiap baris pesanan di tabel `renderPesanan` untuk mempermudah verifikasi kasir.
      - Sanitasi XSS `esc()` pada nomor nota dan metode pembayaran.
    - Harness Pengujian:
      - Membuat `tools/verify_c4.mjs` + `tools/verify_c4_run.mjs` (29/29 HIJAU).
      - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_c4_run.mjs`.
    - Verifikasi Mutasi:
      - Mematikan validasi MIME gambar di `pay.js` tertangkap MERAH (exit code 1) pada pengujian format SVG. Dipulihkan kembali ke HIJAU 29/29.
      - Seluruh 36 verifier pada suite regresi 100% HIJAU (0 regresi).

- **C5 & E1 & D5** (Fase C & D & E) — Invoice PDF & Cetak Struk Kasir + Toast Notification & Optimasi Ringan Edge Caching (P3) —
  `a220f3a` + `52ea710` (tick 42)
  - **Invoice PDF & Cetak Struk Kasir Vector Native (Task C5)**:
    - Frontend SPA `public/app.js`: Menambahkan modul invoice `App.openInvoice(orderIdOrCode)`, `App.switchInvoiceMode(mode)`, dan `App.renderInvoiceModal(order, mode)` dengan dual mode (Struk 80mm thermal dan Invoice Formal A4).
    - Terintegrasi langsung dengan tombol "🧾 Invoice" pada tabel Pesanan (`renderPesanan`) dan tabel Recent Orders di Dashboard (`renderDashboard`).
    - Frontend Pelacakan Publik `public/track.html`: Menambahkan tombol "🧾 Cetak / Unduh Invoice" dan dialog modal invoice interaktif yang memungkinkan pelanggan mencetak nota langsung tanpa login.
    - Stylesheet `public/assets/style.css` & `public/track.html`: Aturan cetak vektor `@media print` lengkap, menyembunyikan elemen antarmuka (topbar, sidebar, modal overlay) dan memformat kertas cetak secara presisi (80mm untuk struk thermal dan 100%/190mm untuk invoice formal A4).
    - Sanitasi XSS: Seluruh data pelanggan (`customer_name`, `order_code`, `service_name`) dilindungi secara ketat melalui fungsi escaping (`esc()` / `escapeHtml()`).
    - Vektor QR Code Native: Menggunakan vector SVG inline murni (2KB) tanpa library QR pihak ketiga yang berat.
  - **Toast Notification & Dialog Modern (Task D5)**:
    - Menggantikan 34 kemunculan dialog pemblokir browser bawaan (`alert()` / `confirm()`) dengan sistem toast non-blocking `App.toast(msg, type)` dan konfirmasi modal `App.confirm(msg)`.
    - Animasi CSS smooth fade-in/fade-out dengan varian status (success, error, warning, info).
  - **Edge Caching & Bundle Optimization (Task E1 & Dead Code Removal)**:
    - Backend `functions/api/services.js`: Menyertakan header `Cache-Control: public, max-age=300, stale-while-revalidate=60` untuk katalog layanan publik pada permintaan GET.
    - Konfigurasi Edge `public/_headers`: Menambahkan caching browser & edge untuk direktori `/assets/*` (TTL 1 hari) dan `/img/*` (TTL 7 hari).
    - Zero-dependency PDF: Menghindari beban 500KB+ library PDF eksternal (jspdf/pdfmake) dengan memanfaatkan native browser vector print to PDF (`window.print()`).
    - Pembersihan duplikasi 7MB gambar: Menghapus salinan redundant `public/*.png` dan `public/assets/img/*.png` yang menduplikasi file kanonikal di `public/img/`, sementara `src/index.js` tetap merutekan fallback path secara mulus.
  - Harness Pengujian:
    - Membuat `tools/verify_c5.mjs` + `tools/verify_c5_run.mjs` (37/37 HIJAU) yang mencakup audit statik invoice, mode cetak, escapeHtml, toast, edge caching, kebersihan bundle, serta simulasi kalkulasi sisa saldo dan ketahanan XSS.
    - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_c5_run.mjs`.
  - Verifikasi Mutasi:
    - Mematikan deklarasi `openInvoice` menghasilkan status MERAH (exit 1). Dipulihkan kembali ke HIJAU 37/37.
    - Seluruh rangkaian pengujian (35 verifier) 100% HIJAU (0 regresi).

- **C8** (Fase C8) — Laporan Bulanan & Visualisasi Chart Interaktif (P2) —
  `e697d7f` (tick 41)
  - **Visualisasi laporan keuangan & kinerja interaktif**:
    - Backend `functions/api/reports.js`: Mengekspor `onRequestOptions` untuk pra-pemeriksaan CORS standar Worker, mempertahankan isolasi RBAC (403 untuk pelanggan), serta validasi ketat rentang tanggal (`_reportfilter.js`).
    - Router `src/index.js`: Mendaftarkan `/api/reports` di `optMap` preflight OPTIONS dan percabangan GET/OPTIONS.
    - Frontend `public/app.js`: Menggantikan tabel statik lama dengan antarmuka analitik eksekutif:
      - 4 KPI cards (Total Omset, Kas Terbayar, Piutang Belum Lunas, Total Order & Rata-rata Bobot).
      - Grafik Batang Bertumpuk Responsif (SVG native) yang memvisualisasikan pendapatan terbayar vs piutang per periode (bulan/minggu/hari) dengan grid nominal dan label waktu.
      - Interaktivitas hover tooltip informatif yang menampilkan rincian terbayar, piutang, dan total nominal per periode.
      - Kontrol filter rentang tanggal (`start`, `end`), pengelompokan (`group`: bulan, minggu, hari), preset cepat ("Bulan Ini", "30 Hari", "Tahun Ini", "Semua"), serta tombol cetak struk/laporan (`window.print()`).
      - Tabel rincian harian transaksi terformat rapi dengan status empty state bila tidak ada data.
    - Harness pengujian: `tools/verify_c8.mjs` + `tools/verify_c8_run.mjs` (33/33 HIJAU).
    - Uji mutasi: Mematikan proteksi `if (!isStaff)` tertangkap MERAH (31/33, exit 1). Dipulihkan kembali ke HIJAU 33/33.
    - Terdaftar di `tools/run_all_verifiers.sh`, seluruh 34 verifier 100% HIJAU (0 regresi).

- **C7** (Fase C7) — Manajemen Voucher & Promo - Admin (P2) —
  `e12c0f9` + `ad6d155` (tick 40)
  - **Pengelolaan CRUD promo & voucher staf terpadu**:
    - Backend `functions/api/promos.js`: Menambahkan dukungan filter `?id=...` parameterized, mendukung alias aksi `toggle_active` dan `toggle_promo`, serta mengekspor `onRequestOptions` untuk CORS preflight.
    - Backend `functions/api/vouchers.js`: Memperkaya query staf dengan `LEFT JOIN users u ON u.id = uv.user_id` (`u.full_name as user_name, u.email as user_email`), pencarian parameterized lintas nama/email, dan ekspor `onRequestOptions`.
    - Router `src/index.js`: Menambahkan `/api/promos` dan `/api/vouchers` ke `optMap` penanganan preflight OPTIONS.
    - Frontend `public/app.js`: Menambahkan modal/panel terbitkan voucher pengguna (`grantVoucherWrap`, `openGrantVoucherForm`, `grantVoucher`), daftar voucher dengan detail nama/email pelanggan, tombol cabut/hapus voucher (`deleteVoucher`), serta tombol "Salin Kode" dengan clipboard API pada kartu promo pelanggan.
    - Harness pengujian: `tools/verify_c7.mjs` + `tools/verify_c7_run.mjs` (39/39 HIJAU).
    - Uji mutasi: Mematikan validasi persen > 100 di `promos.js` menghasilkan status MERAH 38/39 (exit 1), dipulihkan kembali ke HIJAU 39/39.
    - Terdaftar di `tools/run_all_verifiers.sh`, seluruh 33 verifier 100% HIJAU (0 regresi).

- **C3** (Fase C3) — Notifikasi Real-Time Status Order via Polling (P2) —
  `c74f133` (tick 39)
  - **Integrasi notifikasi real-time terdistribusi**:
    - Skema database: `db/migrations/0005_create_notifications_table.sql` membuat tabel `notifications` (`id`, `order_code`, `message`, `status`, `created_at`).
    - Modul backend: Mengaktifkan `functions/api/notifications.js` (`GET /api/notifications?order_code=...`) dengan validasi input, limit 20 notifikasi terbaru, rate limiting 30 req/5m per IP, dan generic server error.
    - Router Worker: Menghubungkan `notificationsHandler` di `src/index.js` untuk `GET /api/notifications` dan OPTIONS preflight CORS di `optMap`.
    - Event Dispatch: Menambahkan trigger notifikasi otomatis di `functions/api/orders.js` saat pembuatan pesanan baru (`create_order`) dan pembaruan status (`move_status`), serta di `functions/api/pay.js` saat verifikasi pembayaran lunas (`dibayar`).
    - Frontend Tracking UI: Menambahkan timeline notifikasi interaktif dan polling otomatis (10 detik) di `public/track.html` dan modal pelacakan di `public/index.html`. Polling otomatis berhenti saat status pesanan mencapai terminal (`selesai`/`batal`) atau modal ditutup.
    - Backward compatibility: Menyesuaikan `tools/verify_fase0_5.mjs` agar menerima kode rute aktif.
    - Harness pengujian: `tools/verify_c3.mjs` + `tools/verify_c3_run.mjs` (35/35 HIJAU).
    - Uji mutasi: Mematikan validasi input di `notifications.js` tertangkap MERAH (28/35, exit 1). Dipulihkan kembali HIJAU 35/35.
    - Terdaftar di `tools/run_all_verifiers.sh`, kini 32 verifier (semua 100% HIJAU).

- **0.9** (Fase 0.9) — Pembatalan Sesi: `users.session_version` & Refresh Token (P0) —
  `bf92626` (tick 38)
  - **Penutupan celah sesi tak terbatas & tidak dapat dibatalkan (K7)**:
    - Skema database: `db/migrations/0004_add_session_version_to_users.sql` menambahkan `ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 1 AFTER role`.
    - Masa berlaku token dipersingkat dari 30 hari menjadi 7 hari pada `functions/_db.js`, `login.js`, dan `register.js`.
    - `getUserFromSession()` memvalidasi `session_version` terhadap DB dan menggagalkan token yang tidak cocok (fail-closed / revoked).
    - `POST /api/auth/logout` menaikkan `session_version` di DB untuk membatalkan token lama.
    - `POST /api/profile` action `change_password` menaikkan `session_version` di DB, membatalkan token lama di perangkat lain, dan menyetel token baru untuk sesi saat ini.
    - Endpoint baru `POST /api/auth/refresh` di `functions/api/auth/refresh.js` terdaftar di `src/index.js` untuk rotasi / perpanjangan token sesi.
    - `tools/verify_fase0_9.mjs` + `tools/verify_fase0_9_run.mjs`: Harness pengujian baru (30/30 HIJAU).
    - Uji mutasi: Menonaktifkan pengecekan versi sesi terbukti ditangkap MERAH (25/30, exit 1). Dipulihkan kembali HIJAU 30/30.
  - Terdaftar di `tools/run_all_verifiers.sh`, kini 31 verifier (semua HIJAU).

- **0.8** (Fase 0.8) — Cabut Fallback Plaintext & SHA-256 Tanpa Salt di `_password.js` (P0) —
  `4d6273d` (tick 37)
  `4d6273d` (tick 37)
  - **Menutup celah legacy auth bypass (K6)**:
    - Menghapus pengecekan plaintext `if (password === stored) return true;` di `functions/_password.js`.
    - Menghapus pengecekan SHA-256 tanpa salt `if (await sha256Hex(String(password)) === stored) return true;` di `functions/_password.js`.
    - Mempertahankan verifikasi PBKDF2 standar baru dan format transisi ber-salt (`dhani-salt`) untuk lazy upgrade saat login sah.
    - Menyesuaikan asersi `tools/verify_b8.mjs` agar memverifikasi penolakan plaintext dan SHA-256 tanpa salt.
    - `tools/verify_fase0_8.mjs` + `tools/verify_fase0_8_run.mjs`: Harness pengujian baru (16/16 HIJAU).
    - Uji mutasi: Menghidupkan kembali pengecekan plaintext terbukti ditangkap MERAH (11/16, exit 1). Dipulihkan kembali HIJAU 16/16.
  - Terdaftar di `tools/run_all_verifiers.sh`, kini 30 verifier (semua HIJAU).

- **0.7** (Fase 0.7) — Race-Safe `POST /api/pay` + `idempotency_key` (P0) —
  `5946446` (tick 36)
  - **Menutup celah race condition pembayaran & overpayment (K5)**:
    - Berkas migrasi `db/migrations/0003_add_idempotency_key_to_payments.sql`: menambahkan kolom `idempotency_key VARCHAR(64) NULL` dan indeks unik `uq_payments_idempotency_key`.
    - `functions/api/pay.js`:
      - Penanganan `idempotency_key`: jika kunci yang sama dikirimkan kembali, sistem langsung mengembalikan status transaksi sebelumnya tanpa menulis ulang pesanan atau pembayaran.
      - Atomic update `UPDATE orders SET paid_amount = paid_amount + ?, payment_status = ? WHERE id = ? AND paid_amount + ? <= total_amount`.
      - Penolakan fail-closed saat persaingan transaksi (evaluasi `affectedRows === 0 / rowsAffected === 0`).
      - Menyimpan `idempotency_key` di tabel `payments`.
    - `tools/verify_fase0_7.mjs` + `tools/verify_fase0_7_run.mjs`: Harness pengujian baru (19/19 HIJAU).
    - Uji mutasi: Menonaktifkan penjaga `affectedRows === 0` terbukti ditangkap MERAH (16/19, exit 1). Dipulihkan kembali HIJAU 19/19.
  - Terdaftar di `tools/run_all_verifiers.sh`, kini 29 verifier (semua HIJAU).

- **0.6** (Fase 0.6) — Ganti Dasar Kepemilikan dari Nama Jadi `user_id` di orders/pay (P0) —
  `f21a40b` (tick 35)
  - **Menutup celah IDOR fatal nama kembar di orders dan pay (K4)**:
    - Berkas migrasi `db/migrations/0002_add_user_id_to_orders.sql`: menambahkan kolom `user_id INT NULL`, indeks `idx_orders_user_id`, dan backfill data dari `users`.
    - `functions/api/orders.js`:
      - `GET /api/orders`: memfilter `o.user_id = ?` untuk pelanggan, dengan fallback aman untuk baris lawas unmigrated.
      - `create_order`: menyertakan `user_id` akun pembuat pesanan.
      - `delete_order`: memeriksa kesesuaian `order[0].user_id === user.id`.
    - `functions/api/pay.js`:
      - `GET /api/pay`: memeriksa `order.user_id === user.id` untuk sensor data pribadi (telepon/alamat).
      - `POST /api/pay`: memeriksa `order.user_id === user.id` sebelum memproses pembayaran.
    - `tools/verify_fase0_6.mjs` + `tools/verify_fase0_6_run.mjs`: Harness pengujian baru (22/22 HIJAU).
    - Uji mutasi: Mengembalikan pengecekan nama `order.customer_name === user.user_name` terbukti ditangkap MERAH (17/22, exit 1). Dipulihkan kembali HIJAU 22/22.
  - Terdaftar di `tools/run_all_verifiers.sh`, kini 28 verifier (semua HIJAU).

- **0.5** (Fase 0.5) — Audit & Remediasi Kode Rusak `functions/api/notifications.js` (P0) —
  `3d42d2d` (tick 34)
  - **Menutup celah fungsi rusak & kontrak salah di notifications.js (K3)**:
    - Impor salah `getDB` diganti menjadi `getDb`.
    - Impor salah `rateLimit` (yang tidak pernah diekspor oleh `_ratelimit.js`) diganti menjadi `clientKey, consume`.
    - Kondisi evaluasi rate limit `rlRes.allowed` diperbaiki menjadi `rlRes.ok`.
    - Validasi query diselaraskan dengan kontrak `validateOr400(query, spec)`.
    - Pembacaan kolom DB berbasis indeks array rapuh (`order[3]`, `row[0]`) diganti menjadi named object properties (`order.status`, `row.id`, dsb).
    - Mempertahankan isolasi routing di `src/index.js` (clean 404 sampai fitur C3 diaktifkan).
    - `tools/verify_fase0_5.mjs` + `tools/verify_fase0_5_run.mjs`: Harness pengujian baru (20/20 HIJAU).
    - Uji mutasi: Typo `getDB` dan pembacaan `order[3]` tertangkap MERAH (18/20, exit 1). Dipulihkan kembali HIJAU 20/20.
  - Terdaftar di `tools/run_all_verifiers.sh`, kini 27 verifier (semua HIJAU).

- **0.4** (Fase 0.4) — Pembersihan Sandi dari `tools/probe_*` & Direktori `.tmp/` (P0) —
  `123ee5d` (tick 33)
  - **Menutup celah penyimpanan sandi admin di repo (K12)**: `tools/probe_*.sh`, `probe_api.py`,
    `probe_b8_live.mjs`, `probe_hash.mjs`, `probe_schema.mjs`, dan folder `.tmp/` sebelumnya memuat sandi admin hardcoded.
  - Perubahan:
    - `tools/probe_*.sh`: Menggunakan variabel lingkungan `ADMIN_PASSWORD` dan `ADMIN_IDENTITY`, menolak jalan bila belum diset.
    - `tools/probe_api.py` & probe JS: Membaca kredensial dari `os.environ` / `process.env`.
    - `.tmp/`: Dibersihkan dari seluruh file scratch lama, dipastikan tidak pernah terlacak di git (`git ls-files .tmp/` kosong).
    - `tools/verify_fase0_4.mjs` + `tools/verify_fase0_4_run.mjs`: Harness pengujian baru (14/14 HIJAU).
    - Uji mutasi ganda: Mengembalikan sandi hardcoded ke skrip probe dan menghapus filter `.tmp/` dari gitignore terbukti ditangkap MERAH (13/14, exit 1).
  - Terdaftar di `tools/run_all_verifiers.sh`, kini 26 verifier (semua HIJAU).

- **0.3** (Fase 0.3) — Keluarkan `db/*.sql` yang Memuat Data Pribadi (PII) dari Git (P0) —
  `2c047ed` (tick 32)
  - **Menutup celah kebocoran data pribadi (K10)**: `db/embun_laundry.sql` dan `db/dhani_laundry.sql`
    sebelumnya terlacak di git dan memuat email nyata, no telepon, hash bcrypt, dan token reset password.
  - Perubahan:
    - `git rm --cached`: Menghapus pelacakan `db/embun_laundry.sql` dan `db/dhani_laundry.sql` dari git index.
    - `.gitignore`: Memperketat filter dengan `db/*.sql` dan whitelist eksplisit `!db/init.sql`.
    - `tools/verify_fase0_3.mjs` + `tools/verify_fase0_3_run.mjs`: Harness pengujian audit `git ls-files` dan `.gitignore` (8/8 HIJAU).
    - Uji mutasi ganda: Menghapus filter gitignore dan melacak kembali file dump terbukti ditangkap MERAH (5/8 dan 7/8, exit 1).
  - Terdaftar di `tools/run_all_verifiers.sh`, kini 24 verifier (semua HIJAU).

- **0.2** (Fase 0.2) — Pembersihan Kredensial Default dari Dokumentasi & Skrip Pembersihan Debug (P0) —
  `c8a2e85` (tick 31)
  - **Menutup celah publikasi akun default**: `README.md` dan `TIDB_SETUP.md` sebelumnya
    mempublikasikan pasangan email dan password plaintext aktif (`admin@gmail.com/admin123`,
    `staff@gmail.com/staff123`, `user@gmail.com/user123`).
  - Perubahan:
    - `README.md`: Menghapus tabel kredensial default bawaan. Menggantinya dengan dokumentasi tata kelola RBAC & pendaftaran tertutup.
    - `TIDB_SETUP.md`: Menghapus insert password plaintext dan menggantinya dengan template hash PBKDF2.
    - `db/migrations/0001_cleanup_debug_accounts.sql`: Menyiapkan skrip SQL untuk membersihkan baris debug `testhash` dan akun probe/test dari database produksi.
    - `tools/verify_fase0_2.mjs` + `tools/verify_fase0_2_run.mjs`: Harness pengujian baru (11/11 HIJAU).
    - Uji mutasi ganda: Mengembalikan sandi default ke `README.md` dan `TIDB_SETUP.md` terbukti ditangkap MERAH (10/11, exit 1).
  - Terdaftar di `tools/run_all_verifiers.sh`, kini 23 verifier (semua HIJAU).

- **A6 & B3** (Fase 0.1) — Pencabutan Secret dari `wrangler.toml` dan Persiapan Rotasi (P0) —
  `be2d2f2` (tick 30)
  - **Menutup celah kritis kebocoran kredensial produksi**: `wrangler.toml` sebelumnya
    memuat `TIDB_DATABASE_URL` lengkap (user root & password TiDB) serta `JWT_SECRET` plaintext.
  - Perubahan:
    - `wrangler.toml`: Baris `TIDB_DATABASE_URL` dan `JWT_SECRET` dicabut dari `[vars]`.
    - `.gitignore`: Menambahkan `.dev.vars`, `.dev.vars.*`, `.env*`, dan dump database sensitif (`db/*.sql`).
    - `.dev.vars.example`: Disediakan sebagai template pengembangan lokal aman tanpa secret riil.
    - `tools/verify_a6.mjs` + `tools/verify_a6_run.mjs`: Harness uji 16/16 HIJAU.
    - Uji mutasi: Memasukkan secret kembali ke `wrangler.toml` terbukti langsung ditangkap MERAH (15/16, exit 1).
  - Terdaftar di `tools/run_all_verifiers.sh`, kini 22 verifier (semua HIJAU).

- **C11** — sinkronisasi `paid_amount` & `payment_status` orders via `POST /api/pay` (P1) —
  `ecfe4b9` (tick 29)
  - **Menutup celah fungsional yang dicatat di tick 28**: `pay.js` sebelumnya
    hanya memasukkan baris `payments` dengan status `pending`, dan tidak pernah
    memperbarui `orders.paid_amount` maupun `orders.payment_status`. Akibatnya,
    status pembayaran pesanan di `/pay` dan `/track` selamanya "unpaid",
    dan laporan omzet/piutang tidak pernah sinkron.
  - Perubahan:
    - Status pembayaran langsung diset `paid` dengan timestamp `paid_at`.
    - Menghitung akumulasi `paid_amount` baru dan menentukan `payment_status`
      (`paid` jika >= total_amount, selain itu `partial`).
    - Query sisa tagihan (`outstanding`) disesuaikan agar hanya menghitung
      baris `pending` yang belum diproses sehingga tidak terjadi double-counting.
    - Menjalankan `UPDATE orders SET paid_amount = ?, payment_status = ? WHERE id = ?`.
  - Verifikasi:
    - BARU `tools/verify_c_pay_sync.mjs` + `verify_c_pay_sync_run.mjs` —
      13/13 HIJAU. Menguji pembayaran bertahap (partial -> paid) dan penolakan
      saat sudah lunas.
    - Terdaftar di `tools/run_all_verifiers.sh`, kini 21 verifier (semua HIJAU).

- **B19** — harga & diskon bukan hak pelanggan pada `create_order` (P1) —
  `3709f0f` (tick 27)
  - **Celah otorisasi nilai uang.** `price_per_kg` dan `discount` di
    `POST /api/orders` dipakai MENTAH dari body. Batasnya ada sejak B2/B16,
    tetapi batas itu hanya soal BENTUK, bukan HAK — tidak ada satu pun baris
    yang bertanya siapa pengirimnya.
  - **Terbukti di produksi** dengan akun Customer baru: `price_per_kg: 1` →
    3 kg tercatat Rp 3.000 (bukan 60.000); `discount: 100000000` →
    `total_amount` = 0. `total_amount` adalah dasar omzet di `/api/reports`
    dan `/api/dashboard`, dan piutang dihitung dari selisihnya dengan
    `paid_amount` — jadi dampaknya melampaui satu baris.
  - Perbaikan menyamakan keduanya dengan pola `status` yang sudah lama benar:
    `isStaff ? nilai : bawaan`. **Diskon voucher TETAP hidup** untuk pelanggan
    (ia datang dari `user_vouchers`, bukan dari body).
  - Periksa ulang dengan `node tools/verify_b19_run.mjs` — **HIJAU 24/24**
    (kode lama MERAH 10/22). Terdaftar di `run_all_verifiers.sh`, kini 18
    verifier. **SELESAI, jangan dikerjakan ulang.**
  - Uji mutasi 4x: harga dibuka MERAH 18/24, diskon dibuka MERAH 19/24,
    **staf pun tak bisa set harga MERAH 22/24**, **voucher ikut mati MERAH
    22/24**. Dua mutasi terakhir membuktikan harness menangkap FITUR YANG
    MATI, bukan cuma celah keamanan.

### Pelajaran tick 27 (berlaku umum)

- **Validasi bentuk yang rapi bisa menyembunyikan celah hak.** `create_order`
  sudah lolos B2, B16, dan B18 — tetapi tidak ada satu pun yang bertanya
  "bolehkah peran INI mengisi field INI". Pola pemeriksaannya: **cari field
  yang nilainya menentukan UANG atau HAK, lalu cek apakah ia dijaga oleh PERAN
  atau hanya oleh TIPE.** `status` terjaga, `price_per_kg`/`discount` tidak —
  padahal ketiganya satu baris bersebelahan.
- **Uji mutasi "pengetatan berlebihan" sama pentingnya dengan "celah dibuka".**
  Mutasi 3 dan 4 membuktikan harness juga menangkap fitur yang mati. Tanpa
  keduanya, "perbaikan" yang berlebihan akan tetap HIJAU.
- Kandidat berikutnya yang sejenis (field bernilai uang/hak yang hanya dijaga
  oleh tipe): `delivery.js` (`courier_id`, `status`) dan `promos.js` (`value`,
  `max_discount`) — keduanya `isStaff`-only di tingkat aksi, jadi kemungkinan
  besar bersih, tetapi belum pernah DIUKUR.

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

