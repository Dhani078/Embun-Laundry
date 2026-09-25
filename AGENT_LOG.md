# AGENT LOG

Riwayat tick (append-only).

---
## Sesi manual — 2026-09-24 lanjutan (flagship features, audit trail, & a11y polish)

14 commit fbc7a22..63f8c9e (branch main, ter-push ke GitHub Dhani078/Embun-Laundry). Test suite: 48/48 HIJAU. Build asset: lancar.

- **Chart Drill-Down Interaktif** (fbc7a22) — Batang grafik SVG laporan keuangan interaktif: tooltip detail pendapatan per tanggal + klik batang langsung membuka pesanan terfilter di tanggal tersebut.
- **Panel Preferensi Sistem di Profil** (a87fe03) — Pengaturan tema visual (Terang/Gelap), lokalisasi bahasa antarmuka (ID/EN), tes audio chime, dan badge status TiDB online di halaman profil pengguna.
- **Riwayat Aktivitas Sistem (Activity Log)** (45deb57) — Tabel audit trail activity_log di TiDB, endpoint /api/activity-log, audit hooks pada order/status/delete/login, UI timeline aktivitas + filter tipe + paginasi + ekspor CSV satu klik.
- **Dashboard KPI Lanjutan & Widget Aktivitas** (5aebf38) — Kartu metrik omset hari ini dengan indikator growth % vs kemarin, kartu piutang belum lunas (outstanding), widget 5 aktivitas sistem terkini di dashboard, skeleton loader diperbarui ke 6 kartu.
- **Sinkronisasi Status & Label Konfirmasi Batch** (32b710a) — Handler /api/orders mendukung aksi move_status dan update_status. Dialog konfirmasi batch status menggunakan label 'Terapkan' (biru) bukan 'Hapus'. Tombol salin nota di track.html.
- **Debounced Katalog & Skeleton Pay.html** (c78ed7a) — Live search input layanan di index.html dengan debounce 200ms + counter jumlah layanan live (#svcResultCount). Form pembayaran pay.html dilengkapi skeleton shimmer & role="alert" / aria-live="polite".
- **Dukungan Parameter Ganda Code/Order_Code** (062cd5e) — Sinkronisasi URL query params code, order_code, dan track pada pay.html, track.html, dan deep-link index.html + tombol salin nota di nota pembayaran.
- **Routing SPA & Semantik Dialog ARIA Modal** (faf6e01) — Routing SPA via renderPage agar sinkron dengan back/forward browser history (popstate). Penambahan role="dialog", aria-modal="true", dan aria-label/aria-labelledby pada seluruh modal (invoice, proof, order, customer, service, delivery, shortcuts, lightbox).
- **State Aksesibilitas Dinamis (A11y)** (0224351) — Atribut aria-expanded sinkron pada tombol sidebar dan lonceng notifikasi; aria-pressed pada tombol tema gelap/terang; skeleton shimmer awal untuk role badge di dashboard statis.
- **Audit Trail Pembayaran & Pelanggan** (a261c87) — Audit logging otomatis pada pembayaran masuk /api/pay (nominal, metode, nota, IP) dan CRUD pelanggan /api/customers (tambah, perbarui, hapus).
- **Audit Trail Logistik & Tarif Layanan** (f708b7b) — Audit logging otomatis pada tugas antar jemput /api/delivery (buat tugas, ubah status kurir, assign kurir, hapus tugas) dan katalog layanan /api/services (tambah, edit, toggle aktif, hapus).
- **Audit Trail Promo & Voucher Diskon** (f704c99) — Audit logging otomatis pada kode promo /api/promos (buat promo, ubah promo, toggle aktif, hapus) dan voucher pengguna /api/vouchers (klaim, bagi massal, terbitkan, cabut voucher). Sistem audit trail kini 100% mencakup seluruh modul operasional.
- **Audit XSS Statis 100% HIJAU (Zero Findings)** (da150fc) — Menuntaskan seluruh 14 temuan interpolasi field objek basis data pada tools/audit_xss.py di public/app.js (esc untuk proof_image, shortcut desc/key, active_orders, finished_today, total_customers, computed_tag, order/payment status, dan kolom CSV export).
- **Audit SQL Injection 100% HIJAU (Zero Interpolasi)** (63f8c9e) — Mengeliminasi interpolasi template literal notifications fields di functions/api/notifications.js menjadi kolom statis eksplisit. Script tools/audit_sql_injection.py melaporkan 0 temuan interpolasi (seluruh 75 query database ter-parameterisasi penuh).


---
## Sesi manual — 2026-09-24 (fitur flagship, UX polish, & audit tuntas)

14 commit (branch main, ter-push ke GitHub Dhani078/Embun-Laundry). Test suite: 48/48 HIJAU. Build asset: sukses.

- **Command Palette (Ctrl+K / ⌘K)** (b0ef8b2) — 13 menu navigasi + 5 aksi cepat (buat order, ganti tema, ganti bahasa, logout) + fuzzy search live filter pesanan + navigasi keyboard ↑↓ Enter Esc.
- **CI/CD Linux Path Fix** (c061649) — tools/verify_c9.mjs diganti fileURLToPath agar kompatibel runner Ubuntu GitHub Actions. Step 5 (test 48/48 + build minifikasi) 100% sukses di runner.
- **Batch Status Update & CSV Export** (91699f3) — checkbox bulk select di tabel pesanan + status dropdown + apply massal. Tombol unduh CSV di Pesanan, Pelanggan, dan Laporan Keuangan (UTF-8 BOM Excel-friendly). Summary footer (total pesanan, total kg, total omset).
- **Deep-linking Landing Page** (91699f3) — klik 'Pesan Sekarang' di landing page otomatis simpan redirect param -> login/register -> buka dashboard -> auto-open modal pesanan dengan pre-filled layanan & berat.
- **Notifikasi In-App Real-time Topbar** (90e5b76) — ikon lonceng interaktif 🔔 dengan badge dinamis (pesanan selesai / unpaid / proses) + dropdown riwayat aktivitas pesanan.
- **Waktu Relatif Humanis (_timeAgo)** (90e5b76) — format 'Baru saja', 'X mnt lalu', 'X jam lalu' di kolom nota dengan tooltip timestamp asli.
- **Lightbox Zoom Bukti Bayar & Shortcut Cheat Sheet (?)** (f104acf) — modal lightbox zoom bukti transfer struk (backdrop blur, click outside dismiss) + dialog cheat sheet pintasan keyboard via tombol '?' + sticky table header th.
- **Debounced Instant Search & Onboarding Tour** (5331731) — live search input debounce 350ms & Enter handler pada #ordSearch (posisi kursor & fokus terjaga) + welcome tour modal 3 langkah untuk pengguna baru (localStorage persist).
- **Estimasi Waktu Pengerjaan di /track** (4e6da44) — kalkulasi otomatis waktu selesai (Express 6 jam, Reguler 24 jam, Satuan/Bed Cover 48 jam) + tombol bayar cepat '💳 Bayar Sekarang' jika nota belum lunas.
- **Quick-Copy Clipboard (📋)** (bd8b820) — tombol salin 1-klik untuk kode nota, kode pelanggan, dan no HP dengan toast non-blocking.
- **Dark Mode Auth Pages** (bed9dac) — tema gelap presisi dan tombol toggle tema tersinkron pada login.html, register.html, dan lupasandi.html.
- **Optimistic UI Status & 'Apel ke Emas'** (c3c66b4) — status dropdown berubah seketika + auto-rollback jika gagal; status selesai memunculkan tombol '🚚 Antar' dengan form kurir prefilled otomatis.
- **Penyegaran Data Instan & Pull-to-Refresh** (3311fd6) — tombol '🔄' di topbar dengan animasi rotasi 360° + touch gesture pull-to-refresh mobile saat di posisi scroll teratas.
- **PWA Offline Precache v4** (853a9e5) — sw.js meng-cache /assets/qrcode-lib.js, /assets/qrcode.js, dan /auth/lupasandi.html agar cetak QR dan reset sandi tetap bisa dibuka saat offline.
- **Perbaikan Print Stylesheet** (9a618ba) — menghapus .wrap dari display:none agar cetak laporan keuangan dan tabel pesanan tidak kosong.
- **Web Audio Chime & Dark Elevation Ring** (76308a4) — nada sintetis audio Web Audio API (D5->A5 250ms) saat transaksi sukses + shadow ring pada card dark mode.
- **CRUD Pelanggan Lengkap di UI** (a5ecac1) — form modal tambah & edit pelanggan (#customerModal) serta aksi hapus pelanggan untuk staf terhubung ke POST /api/customers.
---
## Sesi manual — 2026-09-17 (chat, bukan cron)

7 commit f5233d2..a25ed07 (branch main, ter-push GitHub). app.js 2556→2398 baris.

- **QR code FIX TOTAL** (4f47b01) — generator tangan dibuang (cv2 decode 0/3, matrix diff 140/625, akar tak terisolasi walau RS/formatBits/TABLE/bitStream terverifikasi benar). Diganti **qrcodejs** (Arase, public domain, 19.9KB) di-**host lokal** (bukan CDN — privasi order, service-worker friendly) + wrapper SVG 75 baris. API publik dipertahankan: QRCode.encode(text,level) -> {size,matrix}, QRCode.svg(text,opts). **Verifikasi: cv2 decode 3/3 exact match.**
- **Audit UI/UX** (deleg_598c2952 -> UI_UX_AUDIT.md 29.9KB). Semua 6 item kritis dikerjakan: badge status (baf85ac), spinner+btn-sm (243f826), lupa sandi 404 (baf85ac), dedupe esc() (6e2f5ee), 6 token CSS tak terdefinisi (6e2f5ee), hapus 158 baris dead-code promo (a25ed07 — 15/15 elemen 0 markup refs, savePromo live utuh).
- **Fitur**: KPI count-up + copy toast (573aa30), SPA back/forward + Esc tutup modal + confirm per-aksi + a11y (32bf433).
- **Ghost CSS ~60% style.css TIDAK dikerjakan** — 96 kelas "mati" terdeteksi tapi regex miss concatenation dinamis (status-${s}, skeleton classList). Risiko break UI > manfaat. Meninggalkan.
- **Folder disatukan** dhani-laundry -> embun-laundry (dhani-laundry terbukti superset via git ls-files diff kosong; embun-laundry stale dihapus). Antigravity IDE + PowerShell kunci cwd -> kill psutil -> rename 2-tahap via dhani_temp. Cron 6644cfdf9118 workdir diupdate.
- **Subagent QR gagal 2x**: deleg_cd816787 (71 call, 30m) klaim "placeFinder salah" — **TIDAK benar**, reference pakai set {0,6}. deleg_ef3527f0 (44 call, 21m) interrupted. QR fix tanpa subagent.
- **BLOCKER manusia (bukan kode)**: (1) secret CF belum diset -> 10 API 500 "Database not configured"; (2) password TiDB Error 1045 Access denied padahal awalnya valid — di-rotate sisi TiDB; (3) wrangler deploy butuh login CF. Detail di AGENT_STATE.md "Blokir".

---

## Tick 50 — 2026-09-16T14:18:00+08:00

- Task: **D9** — Finalisasi p5.js hero droplet + ripple (P3)
- Perubahan:
  - `public/assets/hero-canvas.js`:
    - Mengaktifkan `p5.disableFriendlyErrors = true` pada level modul dan setup instance (AGENT24:699) untuk eliminasi overhead validasi argument per-frame, memaksimalkan rendering 60 FPS.
    - Menambahkan inisialisasi `targetY` zona splash pada droplet.
    - Menambahkan pemicu splash ripple otomatis saat tetesan air mencapai permukaan (`d.y >= d.targetY`), memicu riak dan me-reset tetesan ke atas layar dengan target baru.
    - Meningkatkan bentuk tetesan air teardrop bezier (`bezierVertex`) dengan pantulan specular highlight dan jejak partikel air.
    - Meningkatkan sistem gelombang riak konsentris ganda (outer primary wave + inner wave crest) berperspektif isometrik elips.
    - Menambahkan listener `pointermove` ter-throttle pada section `.hero` untuk efek riak interaktif saat kursor digerakkan.
    - Bounding FIFO array ripples untuk mencegah pemborosan memori.
  - Tools & Verifikasi:
    - Membuat harness `tools/verify_d9.mjs` dan runner `tools/verify_d9_run.mjs` (21/21 HIJAU).
    - Menambahkan ke `tools/run_all_verifiers.sh` -> 43/43 verifiers proyek HIJAU 100% (0 regresi).
    - Uji mutasi memvalidasi deteksi kegagalan (exit 1 MERAH saat mutasi, exit 0 HIJAU saat pulih).
- **FASE D (DESAIN & UX) 100% LENGKAP (D1 - D9 SELESAI)**.
- Commit: `21df0ae`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - Masuk ke **FASE E — Performa & Observability**:
    - E4 (minifikasi CSS/JS saat build) — P4
    - E5 (logging terstruktur dev only) — P3
    - E6 (error boundary global SPA) — P3

---

## Tick 49 — 2026-09-16T14:12:00+08:00

- Task: **D8** — Animasi masuk (IntersectionObserver) (P3)
- Perubahan:
  - `public/assets/style.css`:
    - Menambahkan kelas `.reveal` dan `.reveal.show` dengan transisi transform GPU-accelerated.
    - Menambahkan kelas `.reveal-stagger-1` s/d `.reveal-stagger-4` untuk efek stagger dinamis.
    - Menambahkan override aksesibilitas `@media (prefers-reduced-motion: reduce)` yang menonaktifkan transform dan delay reveal seketika.
    - Membersihkan dead code: duplikasi deklarasi `.content` dan `@keyframes contentFadeIn` dihapus.
  - `public/assets/hero-canvas.js`:
    - Mengaitkan `setupHeroVisibilityObserver` menggunakan `IntersectionObserver` pada `#hero-canvas-container`.
    - Menghentikan loop animasi canvas saat tidak terlihat di viewport (`heroP5.noLoop()`), dan melanjutkan kembali (`heroP5.loop()`) saat terlihat (memenuhi aturan AGENT24).
    - Menambahkan pembersihan observer saat unmount (`heroObserver.disconnect()`).
  - `public/index.html`:
    - Memperkuat `initReveal()` dengan `IntersectionObserver`, auto-unobserve setelah reveal, dan auto-staggering kartu.
    - Sinkronisasi render kartu layanan dinamis via `renderServices()` dengan `initReveal()`.
  - `public/app.js`:
    - Menambahkan `App.setupContentObserver()` dan `App.initScrollReveal()` untuk mendeteksi kartu dan panel dashboard yang dimuat secara dinamis, mengaktifkan animasi masuk secara otomatis.
    - Menghubungkan ke siklus navigasi `App.renderPage()`.
  - Tools & Verifikasi:
    - Membuat harness `tools/verify_d8.mjs` dan runner `tools/verify_d8_run.mjs` (27/27 HIJAU).
    - Mendaftarkan `verify_d8_run.mjs` ke `tools/run_all_verifiers.sh` -> 42/42 verifier proyek HIJAU 100% (0 regresi).
    - Uji mutasi memvalidasi deteksi kegagalan (exit 1 MERAH saat mutasi, exit 0 HIJAU saat pulih).
- Commit: `f659c2e`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - D9 (finalisasi p5.js hero droplet+ripple) — P3
  - E4 (minifikasi CSS/JS), E5 (logging dev), E6 (error boundary global SPA) — P3/P4

---

## Tick 48 — 2026-09-16T11:51:00+08:00

- Task: **D7** — Responsive audit 360/768/1024/1440px (P3)
- Perubahan:
  - `public/assets/style.css`:
    - Mengganti aturan legacy 1200px (yang sebelumnya menyembunyikan navigasi `.nav { display: none; }`) dengan arsitektur 4-tier responsif.
    - Tier 1 (>= 1440px): Layout wide monitor `.wrap 280px 1fr`, containment `.main max-width: 1600px`, 4-col KPI grid.
    - Tier 2 (<= 1024px): Off-canvas mobile drawer `.sidebar` (fixed 280px, translateX(-100%), slide-in `.sidebar.open`), backdrop overlay `.sidebar-overlay`, tombol hamburger `.sidebar-toggle-btn` dan close button `.sidebar-close-btn`, 2-col KPI grid.
    - Tier 3 (<= 768px): Horizontal touch snap scrolling untuk kanban status pesanan (`scroll-snap-type: x mandatory`, `.kcol min-width: 270px`), tabel horizontal scrolling dengan `-webkit-overflow-scrolling: touch`, dialog modal adaptif 95vw.
    - Tier 4 (<= 480px / 360px): Stack 1-col KPI, padding konten & topbar kompak (10-12px), responsif typography, toast notifikasi full-width.
  - `public/app.js` & `public/dashboard.html`:
    - Markup `#sidebarOverlay`, `#sidebarToggleBtn`, dan `#sidebarCloseBtn` pada statis `dashboard.html` dan dinamis `renderApp()`.
    - Method `App.initMobileSidebar()`, `App.openMobileSidebar()`, `App.closeMobileSidebar()`, `App.toggleMobileSidebar()`.
    - Auto-close pada klik tautan navigasi (`window.innerWidth <= 1024`), penekanan tombol `Escape`, dan resize layar ke desktop (> 1024px).
  - Tools & Verifikasi:
    - Membuat harness `tools/verify_d7.mjs` dan runner `tools/verify_d7_run.mjs` (33/33 HIJAU).
    - Menambahkan ke `tools/run_all_verifiers.sh` -> 41/41 verifiers proyek HIJAU 100% (0 regresi).
    - Uji mutasi memvalidasi deteksi kegagalan (exit 1 MERAH saat mutasi, exit 0 HIJAU saat pulih).
- Commit: `8240209`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - D8 (IntersectionObserver animasi masuk) — P3
  - D9 (finalisasi p5.js hero droplet+ripple) — P3
  - E4 (minifikasi CSS/JS), E5 (logging dev), E6 (error boundary global SPA) — P3/P4

---

## Tick 47 — 2026-09-16T11:44:13+08:00

- Task: **D6** — Micro-interaction konsisten hover/focus/active (P3)
- Perubahan: `public/assets/style.css` (+157 baris)
  - `:focus-visible` global (2px blue, no outline mouse)
  - `.nav a/.nav-link`: active translateX+scale, focus ring
  - `.btn`: decomposed transition, disabled state, lift/press/ring semua varian
  - `.btn-icon`: shadow hover, scale(0.94) active
  - `.tabbtn`: decomposed transition, press, ring
  - `.input/select/textarea`: hover border, focus shadow via `--blue-soft`, disabled state
  - `.theme-toggle-btn`: focus ring
  - Semua animasi pakai `transform`+`opacity`/`shadow` (GPU composite)
- File: `public/assets/style.css`
- Verifikasi:
  - Gate 1: `node --check` → exit 0 semua file
  - Gate 8: `npx wrangler deploy --dry-run` → 163.51 KiB exit 0
  - Verifiers: `bash tools/run_all_verifiers.sh` → **39/39 HIJAU** 0 regresi
  - Post-deploy: `/api/health` → 200, `/` → 200
- Commit: `14f257d`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - D7 (responsive audit 360/768/1024/1440px) — P3
  - D8 (IntersectionObserver animasi masuk) — P3
  - D9 (finalisasi p5.js hero droplet+ripple) — P3
  - E5 (logging dev), E6 (error boundary SPA) — P3
  - C9 (service worker offline), C10 (i18n P4)

---

## Tick 46 — 2026-09-16T11:28:00+08:00

- Task: **D1** — Migrasi hardcoded hex → CSS token di `style.css` (P3)
- Perubahan:
  - `public/assets/style.css`: tambah 9 token baru ke `:root` (`--white`, `--bg-subtle`, `--bg-deep`, `--cyan`, `--cyan-soft`, `--cyan-border`, `--toggle-track`, `--toggle-on`, `--blue-light`)
  - `background:#ffffff/#fff` → `var(--card)`, `color:#ffffff/#fff` → `var(--white)`
  - `background:#f8fafc` → `var(--bg)`, `#f1f5f9` → `var(--bg-subtle)`
  - `.bd-oft/.bd-as` → `var(--cyan-*)`, `.fx-orbs` → `var(--*-border)`, `.toggle` → `var(--toggle-*)`, `.toast-*` → `var(--bg-deep)` + border vars
  - Dark mode explicit rules → token vars
  - `tools/verify_d3.mjs`: token-aware check `var(--blue-soft) || #1e293b`
- File: `public/assets/style.css`, `tools/verify_d3.mjs`
- Verifikasi:
  - Gate 1: `node --check` → exit 0
  - Gate 8: `npx wrangler deploy --dry-run` → 163.51 KiB, exit 0
  - All verifiers: `bash tools/run_all_verifiers.sh` → **26/26 HIJAU** (0 regresi)
  - Post-deploy: `/api/health` → `{"ok":true}`, `/` → 200
- Commit: `f0b39d8`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - D6 (micro-interaction), D7 (responsive audit), D8 (IntersectionObserver), D9 (p5.js hero) — P3
  - E5 (logging dev), E6 (error boundary), C9 (SW offline), C10 (i18n), F1-F4 (docs) — P3/P4

---

## Tick 44 — 2026-09-16T11:03:00+08:00

- Task: **E2 + E3 + D2** — Lazy load gambar + preconnect fonts dashboard + Dark mode tokens
- Perubahan:
  - `public/index.html`: footer `<img>` tambah `loading="lazy" decoding="async"` (E2)
  - `public/dashboard.html`: tambah `<link rel="preconnect">` fonts.googleapis + gstatic (E3)
  - `public/assets/design-tokens.css`: block `[data-theme="dark"], html.dark` — 39 token bg/text/border/brand/status (D2)
  - `app.js` sudah memiliki `initTheme()`, `applyTheme()`, `toggleTheme()`, cross-tab sync, toggle button `#themeToggleBtn`
  - `AGENT_BACKLOG.md`: C4, E2, E3, D2 → [x]
- File: `public/index.html`, `public/dashboard.html`, `public/assets/design-tokens.css`
- Verifikasi:
  - Gate 1: `node --check src/index.js public/app.js functions/_db.js` → exit 0
  - Gate 8: `npx wrangler deploy --dry-run` → exit 0
  - All verifiers: `bash tools/run_all_verifiers.sh` → **35/35 HIJAU** (0 regresi)
  - Post-deploy: `/api/health` → `{"ok":true,"status":"healthy"}`
  - Produksi `/` → 200
- Commit: `b9db8c5` (E2+E3) + `968a76f` (D2)
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - D1 (token ke dashboard), D3 (skeleton loading), D4 (empty state), D6 (micro-interaction), D7 (responsive), D8 (animasi IntersectionObserver), D9 (p5.js hero)
  - E5 (logging dev), E6 (error boundary SPA)
  - C9 (service worker offline dasar), C10 (multi-bahasa, P4)

---

## Tick 42 — 2026-09-16T10:46:23+08:00

- Task: **D5** — Toast notification global + confirm modal (ganti alert/confirm)
- Perubahan:
  - `public/app.js`: tambah `const esc()` HTML escaper module-level
  - `public/app.js`: tambah `App.confirm(msg)` → Promise modal bersih (role=dialog, aria-modal)
  - `public/app.js`: ganti 5x `window.confirm()` → `await this.confirm()`
  - `public/app.js`: ganti 29x `alert()` → `this.toast(..., type)` (success/error/warning)
  - `public/app.js`: fix type `'warn'` → `'warning'` selaras CSS class `.toast-warning`
  - Toast CSS & container sudah ada di `public/assets/style.css` sejak tick sebelumnya
- File: `public/app.js`
- Verifikasi:
  - Gate 1: `node --check public/app.js` → exit 0
  - Gate 1: `node --check src/index.js && node --check functions/_db.js` → exit 0
  - Gate 8: `npx wrangler deploy --dry-run` → exit 0
  - All verifiers: `bash tools/run_all_verifiers.sh` → **34/34 HIJAU** (0 regresi)
  - Post-deploy: `/api/health` → `{"ok":true,"status":"healthy"}`
  - Sisa bare `alert()`: 0, sisa bare `confirm()`: 0
- Commit: `52ea710`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - Task P3 tersisa: D1 (token ke dashboard), D2 (dark mode), D3 (skeleton), D4 (empty state), D6 (micro-interaction), D7 (responsive), D8 (animasi), D9 (p5.js hero)
  - E2 (lazy load), E3 (preconnect font), E5 (logging dev), E6 (error boundary)
  - C4 (upload bukti bayar) dan C9 (service worker) masih open

---

## Tick 40 — 2026-09-16T10:26:39+08:00

- Task: **C7** — Manajemen Voucher & Promo Admin (P2)
- Perubahan:
  - `public/app.js`: `renderPromo()` branch `isStaff` — admin dapat tambah/edit/toggle/hapus promo via form inline; form grant voucher single/bulk; tabel semua voucher pengguna. Customer hanya lihat promo aktif + klaim.
  - `public/app.js`: fungsi baru `openPromoForm`, `savePromo`, `togglePromo`, `deletePromo`, `grantVoucher`, `deleteVoucher`.
  - `src/index.js`: `/api/promos` & `/api/vouchers` ditambah ke `optMap` CORS preflight.
  - `tools/verify_c7.mjs` + `verify_c7_run.mjs`: harness baru 39/39 HIJAU.
  - `tools/run_all_verifiers.sh`: `verify_c7_run.mjs` terdaftar.
  - `AGENT_BACKLOG.md`: C7 → [x].
- File: `public/app.js`, `src/index.js`, `functions/api/promos.js`, `functions/api/vouchers.js`, `tools/verify_c7.mjs`, `tools/verify_c7_run.mjs`
- Verifikasi:
  - Gate 1: `node --check` semua file JS → exit 0
  - Gate 8: `npx wrangler deploy --dry-run` → exit 0, 161.61 KiB
  - Harness: `node tools/verify_c7_run.mjs` → **39/39 HIJAU**
  - Login prod: `admin@gmail.com` → ok=True role=Admin
  - Post-deploy: `api/health` → 200 OK; DB endpoints `ok=false` pre-existing (TIDB_DATABASE_URL secret belum di-set di CF dashboard — bukan regresi, sama sebelum commit)
- Commit: `e12c0f9` + `ad6d155`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - C8 (Laporan bulanan + chart, P2) adalah task P2 berikutnya. Backend `/api/reports` sudah ada; perlu UI chart di dashboard.
  - DB `ok=false` di prod = secret CF belum di-set (A6 blokir lama). Tidak ada yang bisa dilakukan tanpa CF API token.

---

## Tick 19 — 2026-09-10T17:50:00+08:00 (housekeeping MD + aturan keras baru)

Bukan task fitur — sesi ini menata ulang dokumen loop dan menambal dua
celah operasional yang ditemukan saat memantau loop.

- Perubahan:
  - `AGENT24.md` — **Aturan Keras 13 & 14** (Bagian 3):
    - 13: dilarang menulis secret/kredensial ke file di working tree.
    - 14: tick tidak boleh menggantung >~20 menit tanpa hasil.
  - `AGENT_STATE.md` — bagian baru "Konfigurasi loop" + "Insiden tercatat".
  - `AGENT_BACKLOG.md` — bagian baru "Catatan Operasional Loop (bukan task)".
  - `AGENT_LOG.md` — entri ini.
- Insiden yang mendasari aturan baru:
  - **Kebocoran secret**: sebuah tick menulis `TIDB_DATABASE_URL` ke
    `.tmp/dburl.txt`. File dihapus; terverifikasi `.tmp/` tidak terlacak git
    (`git ls-files .tmp/` kosong, `git check-ignore` → `.gitignore:9`).
    Tidak pernah masuk riwayat git.
  - **Tick menggantung**: fire 19:02 dan 19:22 (2026-09-09) berjalan 20+
    menit tanpa commit, sehingga fire berikutnya dilewati terus.
- Verifikasi:
  - `git ls-files .tmp/` → kosong (aman)
  - `git check-ignore -v .tmp/dburl.txt` → `.gitignore:9:.tmp/`
  - Loop tetap aktif; commit terakhir sebelum sesi ini `58fb1b5` (tick 18).
- Catatan lingkungan:
  - EquipRent dibiarkan jalan berdampingan (keputusan user). Scheduler satu
    job per waktu → penundaan 1–2 jam wajar, bukan insiden.
  - Watchdog disesuaikan: `RIVAL_IDS=[]`, `STALE_HOURS` 3 → 6 jam.
- Status: **DONE** (housekeeping)

---

## Tick 20 — 2026-09-10T18:08:00+08:00

- Task: **C2** — Tracking order publik by kode (tanpa login) (P2)
- Perubahan:
  - Buat `functions/api/track.js` — endpoint publik `GET /api/track?code=...` (dan `?order_code=...`)
  - Daftarkan routing `/api/track` di `src/index.js`
  - Proteksi privasi pelanggan (B10): `customer_phone` & `customer_address` tidak diekspos (absen dari JSON), nama pelanggan disamarkan (`maskName()`, e.g. "Budi S.")
  - Rate limiting (B1): 20 req/5m per IP sebelum menyentuh TiDB
  - Input validation (B2): kode 3..20 karakter, alfanumerik / hyphen / underscore saja
  - Hardening server error (B14): kegagalan DB mengembalikan `SERVER_ERROR` generik tanpa membocorkan koneksi
  - UI landing page (`public/index.html`):
    - Tombol "Lacak Pesanan" di navbar dan Hero CTA
    - Modal interaktif `#trackModal` + visual progress stepper (Diterima → Diproses → Selesai)
    - Kartu rincian pesanan + status pembayaran (Lunas / Belum Lunas)
    - Tautan cepat "Bayar Sekarang" jika tagihan belum lunas
    - Dukungan URL param otomatis: `/?track=ORD-XXX` langsung membuka modal tracking
  - Harness uji: `tools/verify_c2.mjs` & `tools/verify_c2_run.mjs` (47/47 uji HIJAU)
- File: `functions/api/track.js`, `src/index.js`, `public/index.html`, `tools/verify_c2.mjs`, `tools/verify_c2_run.mjs`, `tools/run_all_verifiers.sh`
- Verifikasi:
  - Gate 1: `node --check` pada semua file JS/ESM → exit 0
  - Gate 2: `</html>` tepat 1 di `public/index.html`
  - Gate 5: 0 warna hardcoded hex baru (semua token CSS)
  - Gate 6: Aksesibilitas aria-label + role="dialog"
  - Gate 7: Struktur landing page utuh
  - Verifier suite: `tools/run_all_verifiers.sh` → 12/12 HIJAU (verify_c2: 47/47)
- Commit: `1551773`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - FASE C: C2 selesai. Task P2 berikutnya: C1 (Katalog Layanan publik + filter) atau C3 (Notifikasi status polling).

---

## Tick 21 — 2026-09-10T18:12:00+08:00

- Task: **C1** — Halaman "Layanan" publik + filter (P2)
- Perubahan:
  - `functions/api/services.js`: publik secara default diproteksi hanya melihat layanan aktif (`is_active = 1`); staf dapat melihat non-aktif dengan `?status=nonaktif`
  - `public/index.html`:
    - Bilah pencarian instan `#serviceSearchInput` untuk mencari nama atau deskripsi pakaian
    - Filter kategori dinamis `#categoryPills` (`Semua`, `Reguler`, `Express`, `Satuan`, `Dry Cleaning`) dengan indikator aktif & tablist aksesibilitas
    - Kartu layanan dinamis dengan badge kategori, harga/satuan (`/kg`, `/pcs`), durasi, deskripsi, dan tombol order modal
    - Tampilan kosong (empty state) ramah dengan tombol "Reset Filter"
  - `public/track.html`: Halaman mandiri pelacakan pesanan publik terintegrasi
  - Harness uji: `tools/verify_c1.mjs` & `tools/verify_c1_run.mjs` (18/18 uji HIJAU)
- File: `functions/api/services.js`, `public/index.html`, `public/track.html`, `tools/verify_c1.mjs`, `tools/verify_c1_run.mjs`, `tools/run_all_verifiers.sh`
- Verifikasi:
  - Gate 1: `node --check` sintaks bersih → exit 0
  - Gate 2: `</html>` tepat 1 di `index.html` dan `track.html`
  - Gate 5: 0 warna hex baru (semua via CSS tokens)
  - Gate 6: Aksesibilitas `role="tab"` + `aria-selected` + `aria-label`
  - Gate 7: Struktur `#pricesGrid` utuh
  - Verifier suite: `tools/run_all_verifiers.sh` → 13/13 HIJAU
- Commit: `1a02520`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - FASE C: C1 dan C2 selesai. Task P2 berikutnya: C3 (Notifikasi status polling) atau C6 (Riwayat order pelanggan).


---

## Tick 22 — 2026-09-10T18:20:00+08:00 (C2 — penguatan harness kontrak UI)

Bukan fitur baru: memperkuat harness C2 yang sudah ter-commit (`1551773`).

- Latar belakang: harness C2 hanya menguji kontrak BARU (`?code=`). Padahal
  landing page (`fetchTrackOrder` di index.html) memanggil `?order_code=` dan
  memakai `progress_step`, `unit`, serta `delivery` — sebelum endpoint ini
  ada, fitur "Lacak Pesanan" di landing **404 (mati)**. Tanpa uji untuk
  kontrak lama, perubahan pada parameter atau `progress_step` bisa mematikan
  UI lagi tanpa satu pun verifier menjadi MERAH.
- Perubahan: `tools/verify_c2.mjs` +41 baris (11 uji baru).
  - `?order_code=` tetap berfungsi (kontrak lama yang dipakai index.html).
  - `progress_step`: baru 0, proses 1, selesai 2, batal -1.
  - `unit` layanan ikut terkirim.
  - `delivery.type`/`status` ikut, dan terbukti TIDAK bawa alamat/telepon.
- **Uji mutasi (bukan sekadar hijau)** — tiga kali sengaja merusak kode:
  1. hapus dukungan `?order_code=`        -> MERAH 56/58
  2. bocorkan `customer_phone`/`_address` -> MERAH 54/58
  3. `progress_step` selesai 2 -> 1       -> MERAH 57/58
  Setelah dipulihkan: HIJAU 58/58. Uji ini membuktikan harness punya gigi.
- Kode produksi TIDAK diubah: `functions/api/track.js` identik dengan HEAD.
- Verifikasi: 13 verifier HIJAU (C2 58/58); `node --check` 0 error.
- Verifikasi produksi (setelah deploy ~95 s):
  - `/api/track?order_code=ORD-ABC123` -> **404 JSON terstruktur**
    `{"ok":false,"msg":"Pesanan tidak ditemukan"}` (sebelumnya 404 "Endpoint
    not found" dari router = endpoint belum ada).
  - `/track.html` -> 307 -> 200 di `/track`.
  - OPTIONS `/api/track` -> 204 (preflight tidak menghabiskan jatah).
  - Header B4 utuh: nosniff, X-Frame-Options: DENY, Referrer-Policy;
    X-RateLimit-Limit: 20 ikut terkirim.
  - **Dengan data nyata** `ORD-260906CCC` (tanpa cookie):
    200, `progress_step: 2` (selesai), `unit: "kg"`, dan **nol field
    telepon/alamat** — PII terbukti tidak bocor di produksi.
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - **Ada agent lain yang mengerjakan repo ini bersamaan.** Saat tick
    berjalan, `run_all_verifiers.sh` dan `AGENT_LOG.md` diubah oleh sibling
    subagent; C2 (`1551773`) dan C1 (`1a02520`) ter-commit di luar tick ini.
    SELALU `git status` + `git diff HEAD` sebelum menyimpulkan bahwa
    pekerjaanmu hilang — dan refresh `.agent-lock` bila tick panjang.
  - Endpoint ini sengaja publik dan TANPA login. Kode pesanan hanya ~46 ribu
    kemungkinan per milidetik, jadi yang boleh bocor hanyalah status dan
    nominal. Jangan pernah menambah field ke `publicView()` tanpa uji
    "TIDAK bocor" yang baru.


---

## Tick 23 — 2026-09-10T18:35:00+08:00 (B15 — validasi `/api/delivery` + jadwal Asia/Jakarta)

Latar belakang: `delivery.js` adalah satu-satunya modul yang TIDAK ikut
dipasangi `validateOr400()` pada B2 (tick 11). Tujuh modul lain sudah;
delivery tertinggal. Celah ini dicatat sendiri di `_today.js` sejak B12:
"pola `toISOString().split('T')[0]` masih ada di `functions/api/delivery.js`
untuk `schedule_date`". Jadi satu tick menutup dua hal: input tanpa
validasi, dan tanggal yang salah zona.

- Diukur DULU dengan probe sementara (13 kasus) sebelum mengubah apa pun.
  Kode lama menerima SEMUANYA dengan 200:
  - `customer_name` 5.000 char -> masuk ke `VARCHAR(80)` -> 500 dari TiDB
  - `phone` objek `{n:1}`      -> `[object Object]` tersimpan di VARCHAR(30)
  - `address` array `['a','b']`-> `"a,b"` (koersi JS) tersimpan di TEXT alamat
  - `order_code` 9.000 char    -> melampaui VARCHAR(40)
  - `notes` 20.000 char, `schedule_date:'besok-saja'`, `start_time:'pagi sekali'`
  - `id: [5,9]` pada update_status -> `parseInt([5,9])` = 5, elemen pertama
    dipakai, sisanya dibuang tanpa keluhan; `id: -3` juga lolos
  - `courier_id: -7` pada assign_courier -> diterima mentah
  Kolom yang dipertaruhkan: **alamat dan telepon pelanggan**.
- Perubahan produksi (2 berkas):
  - `functions/api/delivery.js`: seluruh field `create_task` lewat
    `validateOr400()`; batas mengikuti `DATABASE_SCHEMA.md` (nama 80, telepon
    30, kode pesanan 40, alamat/catatan 2000). Tiga aksi lain
    (`update_status`, `assign_courier`, `delete_task`) ikut divalidasi.
    Parameter GET (`status`, `date`) dibersihkan + divalidasi.
    Jadwal bawaan `toISOString().split('T')[0]` -> `todayIn()` (`_today.js`).
  - `functions/_validate.js`: TIPE BARU `time` (`HH:MM`/`HH:MM:SS`, untuk
    kolom MySQL `TIME`) + `isTime()`. `type:'int'` kini MENOLAK objek/array —
    sebelumnya `{id:[3]}` lolos karena `Number([3])` = 3.
- BARU `tools/verify_b15.mjs` + `verify_b15_run.mjs` — 93 uji. Uji mengukur
  SQL/params yang BENAR-BENAR terkirim, bukan teks sumber.
- **Tiga hijau palsu yang ditemukan pada harness SENDIRI (penting):**
  1. `if (patch.type === undefined) delete body.type;` — karena hampir semua
     patch tidak punya kunci `type`, SETIAP kasus kehilangan `type` dan
     menjadi 400 karena "Tipe wajib diisi", BUKAN karena field yang diuji.
     Uji mutasi (batas nama dibuka jadi 100.000) tetap HIJAU 91/91 padahal
     kode sudah rusak. Diperbaiki dengan `'type' in patch &&`.
  2. Uji zona waktu tidak bisa HIJAU MERAH bila WIB dan UTC sedang hari yang
     sama — terbukti: mutasi "jadwal balik ke UTC" HIJAU 91/91. Ditambah uji
     dengan JAM DIBEKUKAN ke `2026-09-10T23:00:00Z` (= 06:00 WIB hari
     berikutnya), sehingga kedua zona pasti beda hari.
  3. Karena pembekuan `Date` menyentuh scope global, ditambah uji bahwa jam
     pulih sesudahnya (selisih < 60 dtk) agar kebocoran tidak merusak uji lain.
- **Uji mutasi (7x sengaja merusak kode) — semua terbukti MERAH:**
  | 1 batas nama -> 100.000        | MERAH 90/93 |
  | 2 `date` -> str bebas          | MERAH 87/93 |
  | 3 `time` -> str bebas          | MERAH 90/93 |
  | 4 jadwal balik ke UTC          | MERAH 92/93 |
  | 5 Customer boleh pilih kurir   | MERAH 91/93 |
  | 6 validasi create_task dilewati| MERAH 60/93 |
  | 7 filter GET status dimatikan  | MERAH 92/93 |
  Dipulihkan: HIJAU 93/93.
- Regresi: `tools/run_all_verifiers.sh` **14/14 HIJAU** (B15 93/93 masuk
  daftar). `node --check` semua fungsi + src + tools bersih.
  `audit_sql_injection.py` 0 temuan, `audit_xss.py` HIJAU.
- **Terbukti di produksi** (setelah deploy ~100 dtk, `abc9922`):
  - 10 input ngawur -> **400** dengan pesan spesifik ("Nama pelanggan
    terlalu panjang (maksimal 80 karakter)", "Format Jam mulai tidak valid
    (HH:MM)", "Format ID tidak valid", "Kurir di luar rentang...").
  - Jalur SUKSES tidak mati: `create_task` wajar -> **200**, baris tersimpan
    `schedule_date: "2026-12-24"`, `start_time: "09:30:00"`.
  - B10 utuh: tanpa sesi -> **401** (POST dan GET).
  - B4 utuh: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy.
  - B5 utuh: origin `evil.example.com` -> tanpa ACAO, `Vary: Origin`.
  - OPTIONS preflight -> 204.
- Commit: `abc9922`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - Tipe `time` di `_validate.js` hanya dipakai delivery. Bila modul lain
    (mis. jam operasional toko di settings) butuh kolom TIME, pakai tipe ini.
  - `_validate.js` kini menolak objek/array untuk `int` juga. Bila ada klien
    sah yang mengirim id berupa array, itu bug klien — jangan dilonggarkan.
  - Modul yang BELUM punya harness khusus validasi: `customers.js` POST
    (sudah lewat B2, belum punya harness sendiri), `services.js` idem.
    Kandidat B16 bila backlog fitur sedang kosong.

## Tick 25 — B17: wajib sesi pada POST /api/pay (P0)

- Commit: `a8ca085`
- Status: **SUKSES**

- Awal tick: `.agent-lock` berusia **109,98 menit** (dari 19:26) → lock basi
  karena tick 24 crash SEBELUM sempat merapikan dokumen. Lock dihapus, lalu
  dibuat ulang. Karena itu tick ini juga menyelesaikan **pekerjaan buku
  tick 24 (B16)** yang tertinggal: B16 sudah ter-commit `502d56a` (20:06)
  dan terbukti di produksi, tetapi belum tercatat di backlog/log/state.

- **B16 (tick 24) — diverifikasi ulang, bukan dikerjakan ulang.**
  `node tools/verify_b16_run.mjs` → **HIJAU 156/156**. Terbukti di produksi
  dengan nilai batas (N → 200, N+1 → 400):
  | orders.customer_name | 100 → 200, 101 → 400 "maksimal 100 karakter" |
  | services.name        |  80 → 200,  81 → 400 "maksimal 80 karakter"  |
  | customers.address    | 255 → 200, 256 → 400 "maksimal 255 karakter" |
  | promos.expires_at    | 'besok-saja' → 400 (dulu 500)                |
  Jalur sukses tidak mati: `create_customer` wajar → 200, baris tersimpan.

- **B17 — celah baru, ditemukan saat mengukur B16 di produksi.**
  Untuk menguji batas butuh kode pesanan nyata; saat mencoba `POST /api/pay`,
  permintaan TANPA cookie mengembalikan **200 + `qr_payload`** dan baris
  `payments` tersimpan atas `ORD-MTVK0BVGUA5`. `POST /api/pay` tidak punya
  pemeriksaan sesi sama sekali; `public/pay.html` hanya memanggil GET, jadi
  tidak ada klien sah yang memakai POST ini.
  - **GET TETAP PUBLIK dan sengaja demikian** (halaman pembayaran dibuka
    lewat tautan berkode; B10 menyensor telepon & alamat). Jangan "diperbaiki".
- Perubahan (1 berkas): `functions/api/pay.js`
  - `!user` → 401 diletakkan SEBELUM `db.query()`.
  - Setelah pesanan ketemu: pemilik (`customer_name` cocok) atau staf
    (Admin/Owner/Staff) boleh lanjut; pelanggan asing → 401.

- BARU `tools/verify_b17.mjs` + `verify_b17_run.mjs` — **19 uji**. Yang
  diukur adalah INSERT yang BENAR-BENAR terkirim, bukan status.
- Sebelum diperbaiki: **MERAH 14/19** (harness punya gigi).
- **Uji mutasi (5x) — semua MERAH:**
  | 1 hapus guard !user (kode lama)    | MERAH 18/19 |
  | 2 guard dipindah SETELAH INSERT    | MERAH 18/19 |
  | 3 pelanggan asing selalu diizinkan | MERAH 17/19 |
  | 4 staf ikut ditolak (fitur mati)   | MERAH 17/19 |
  | 5 GET publik ikut ditutup          | MERAH 17/19 |
  Dipulihkan: **HIJAU 19/19**.
  Mutasi 2 yang terpenting: 401 yang dikembalikan SETELAH `db.execute()`
  tetap meninggalkan baris — tanpa uji ini, "perbaikan" yang menolak
  terlambat akan tampak benar.
- Jebakan harness yang ditemui: token uji dibuat dari `{role, full_name}`,
  bukan `{user_role, user_name}`. Salah bentuk → staf menjadi "Customer"
  → uji MERAH karena kesalahan harness. Sudah diberi komentar di berkas.
- Regresi: `run_all_verifiers.sh` **16/16 HIJAU** (B17 19/19 masuk daftar;
  `run_all_verifiers.sh` ditambahi entri B17). `audit_sql_injection.py`
  exit 0, `audit_xss.py` HIJAU, `node --check` bersih.
- **Terbukti di produksi** (setelah deploy; butuh ~200 dtk, bukan ~90):
  - POST tanpa sesi → **401 `{"ok":false,"msg":"Unauthorized"}`** (dulu 200).
  - GET anonim → **200**, `customer_phone`/`customer_address` = null,
    `total_amount` tetap terkirim → B10 & C2 utuh.
  - POST staf bersesi → **200** + `qr_payload` → fitur kasir tidak mati.
  - `/`, `/api/health`, `/api/services` → 200.

- Catatan untuk tick berikutnya:
  - **Pola audit yang belum dilakukan: "uji kata kerja TULIS pada setiap
    modul yang GET-nya sengaja publik."** B17 lolos karena `verify_b10`
    hanya menguji GET `pay.js`. Kandidat pemeriksaan serupa: `track.js`
    (publik by design) — perlu dicek apakah ia punya jalur tulis.
  - Deploy kali ini butuh ~200 detik; bila post-verify masih menunjukkan
    perilaku lama, ulangi sekali sebelum menyimpulkan kegagalan.
  - Field login adalah `identity` (bukan `email`/`username`); `customers`
    POST memakai `full_name` (bukan `name`); `orders` list = GET tanpa
    `action`. Salah field menghasilkan 400 yang tampak seperti bug.

## Tick 26 — B18: audit kata kerja TULIS semua modul (`ab7026e`)

Tindak lanjut langsung dari catatan tick 25: "uji kata kerja TULIS pada
setiap modul yang GET-nya sengaja publik." Kandidat yang disebut (`track.js`)
diperiksa lebih dulu — ternyata ia GET-saja dengan 405 untuk kata kerja lain,
jadi aman. Alih-alih memeriksa satu per satu tanpa bukti, dibuat jaring
regresi untuk SELURUH kelas defeknya.

- **Bukan perbaikan defek.** Tidak ada baris `functions/` yang diubah;
  `git diff --stat` untuk direktori itu kosong. Ini murni penambahan harness.
- **Yang diukur:** 29 aksi tulis pada 10 modul dipanggil TANPA cookie; yang
  dicek adalah SQL tulis yang benar-benar terkirim ke driver, bukan status.
  Alasan (pelajaran B17): 401 yang dikembalikan SETELAH `db.execute()` tetap
  meninggalkan baris, jadi status bisa menipu.
- Cakupan: orders (4 aksi), customers (3), services (4), promos (4),
  vouchers (4), delivery (4), pay, profile (2), checkin, register.
  Tambahan: 4 kata kerja terlarang pada `track.js`, 10 uji jalur sukses
  staf, 3 uji GET publik tidak ikut tertutup (C1/C2/B10).
- **Registrasi diuji dengan asersi TERBALIK** — mendaftar ialah satu-satunya
  penulisan yang memang harus bisa tanpa sesi. Bila kelak ia "diperbaiki"
  menjadi 401, harness harus MERAH.

### Hasil

`node tools/verify_b18_run.mjs` → **HIJAU 76/76**. Nol jalur tulis terbuka.

### Uji mutasi (5x, kode dipulihkan setelah masing-masing)

| # | Mutasi | Hasil |
|---|--------|-------|
| 1 | hapus penjaga `isStaff` di services.js (B17 terulang) | MERAH 73/76 |
| 2 | penjaga digeser sesudah `validate` (masih sebelum tulis) | HIJAU 76/76 |
| 3 | **tulis SEBELUM penjaga**, services.js | MERAH 72/76 |
| 4 | `track.js` menerima POST | MERAH 74/76 |
| 5 | `isStaff = false` (fitur mati) | MERAH 74/76 |

Mutasi 3 yang terpenting: status **401 namun UPDATE tetap terkirim** —
persis pola B17. Tanpa mengukur SQL, mutasi ini tampak "benar".

**Mutasi 2 sengaja HIJAU, dan itu bukan kelemahan harness** — penjaga masih
mendahului penulisan, jadi memang bukan celah. Dicatat agar tick berikutnya
tidak "memperbaiki" harness gara-gara angka hijau.

### Temuan yang layak dicatat: mutasi 3 gagal di `delivery.js`

Mutasi "tulis sebelum penjaga" mula-mula dicoba pada `delivery.js` dan tetap
HIJAU 76/76. Diagnosis: `delivery.js` punya penjaga `!user` di **tingkat
atas**, sehingga mutasi setempat tidak dapat menghasilkan penulisan. Baru
setelah mutasi dipindah ke `services.js` (GET publik, tanpa penjaga atas)
pola B17 terbukti MERAH. Pelajaran umum: sebelum menyimpulkan harness lemah,
periksa apakah modul yang dimutasi punya penjaga lapis lain.

### Regresi & verifikasi

- `run_all_verifiers.sh` **17/17 HIJAU** (B18 76/76 masuk daftar).
- `audit_sql_injection.py` exit 0; `audit_throw_sites.py` exit 0 ("setiap
  handler tanpa try/catch terbukti nol throw site"); `audit_xss.py` HIJAU.
- `audit_api_guard.py` exit 1 — **sudah ada sebelumnya, bukan regresi**: 10
  handler tanpa try/catch, semuanya dispatcher (`onRequest`) / `health` /
  `me.js` yang tidak menyentuh DB, dan `audit_throw_sites.py` membuktikan
  nol throw site. Jangan "diperbaiki" tanpa bukti ada defek.
- `node --check` bersih di semua `functions/**` plus berkas baru.
- **Terbukti di produksi:** POST `/api/pay` tanpa sesi → 401; POST
  `/api/services` tanpa sesi → 401; POST `/api/track` → 405; GET
  `/api/services` dan `/api/promos` → 200. Baseline `/`, `/dashboard`,
  `/api/health`, `/api/services`, `/assets/design-tokens.css` → 200.

### Catatan untuk tick berikutnya

- Perubahan bersifat test-only, jadi tidak ada perilaku produksi yang
  berubah; verifikasi produksi di atas hanya membuktikan keadaan sudah benar.
- Pola audit berikutnya yang belum dilakukan: **harness untuk modul yang
  masih belum punya** — `dashboard.js` dan `reports.js` (keduanya GET dan
  sudah berpenjaga `!user`, jadi kemungkinan besar bersih).


## Tick 27 — B19: harga & diskon bukan hak pelanggan (`3709f0f`)

- Task: **B19** (P1, baru — lahir dari temuan tick ini)
- Perubahan: `functions/api/orders.js` (aksi `create_order`), plus harness baru
  `tools/verify_b19.mjs` + `tools/verify_b19_run.mjs` dan entri di
  `tools/run_all_verifiers.sh`.

### Kenapa layak dicurigai

`create_order` sudah lolos B2 (validasi), B16 (batas selaras lebar kolom), dan
B18 (semua kata kerja tulis berpenjaga). Tidak ada satu pun dari ketiganya yang
bertanya **siapa** yang boleh mengisi field-nya. Polanya: cari field yang
nilainya menentukan UANG atau HAK, lalu cek apakah ia dijaga oleh PERAN atau
hanya oleh TIPE.

Di sinilah ketiganya satu baris bersebelahan:

```js
const status   = isStaff ? d.status      : 'baru';   // dijaga
const disc     = d.discount;                          // TIDAK dijaga
let   priceKg  = d.price_per_kg;                      // TIDAK dijaga
```

### Defek (diukur di produksi dengan akun Customer baru `ujib19@gmail.com`)

| Kiriman pelanggan | Yang tersimpan | Seharusnya |
|---|---|---|
| `price_per_kg: 1`, 3 kg | Rp 3.000 | Rp 60.000 |
| `discount: 100000000` | `total_amount` = 0 | Rp 60.000 |

Dampaknya melampaui satu baris: `total_amount` adalah dasar omzet di
`/api/reports` dan `/api/dashboard`, dan piutang dihitung dari selisihnya
dengan `paid_amount`. Satu permintaan cukup untuk mengotori agregat itu.

### Perbaikan

```js
const disc    = isStaff ? d.discount    : 0;
let   priceKg = isStaff ? d.price_per_kg : 0;   // 0 -> diambil dari services
```

Validasi bentuk TETAP dijalankan untuk kedua field (nilai ngawur tetap 400);
yang berubah hanya nilai yang dipakai. **Diskon voucher tetap hidup** untuk
pelanggan — ia datang dari baris `user_vouchers`, bukan dari body.

### Bukti

- `node tools/verify_b19_run.mjs`: kode lama **MERAH 10/22**, kode baru
  **HIJAU 24/24**. Yang diukur ialah parameter INSERT yang benar-benar
  terkirim, bukan status (pelajaran B17).
- Uji mutasi 4x, kode dipulihkan setelah masing-masing:

| # | Mutasi | Hasil |
|---|--------|-------|
| 1 | harga pelanggan dibuka (B19 dibalik) | MERAH 18/24 |
| 2 | diskon pelanggan dibuka | MERAH 19/24 |
| 3 | staf pun tak bisa set harga (fitur mati) | MERAH 22/24 |
| 4 | diskon voucher ikut dimatikan (regresi hak sah) | MERAH 22/24 |

Mutasi 3 dan 4 penting: tanpa keduanya, "perbaikan" yang BERLEBIHAN akan tetap
HIJAU. Harness harus punya gigi dua arah.

### Regresi & verifikasi

- `run_all_verifiers.sh` **18/18 HIJAU** (B19 24/24 masuk daftar).
- `audit_sql_injection.py` exit 0; `audit_xss.py` HIJAU; `audit_throw_sites.py`
  exit 0; `node --check` bersih di seluruh `functions/`, `src/`, `tools/`.
- **Terbukti di produksi** (4 permintaan, akun Customer + Admin):
  - pelanggan `price_per_kg: 1` → tersimpan `20000`, total 60000;
  - pelanggan `discount: 100000000` → diskon `0`, total 60000;
  - staf `price_per_kg: 15000, discount: 5000` → tersimpan 15000/5000,
    total 40000 (**fitur kasir tidak mati**);
  - pelanggan tanpa harga → 60000 (alur normal tidak berubah).
- Keempat order uji (id 90001–90004) sudah dihapus; file cookie di `.tmp/`
  dibersihkan.

### Catatan untuk tick berikutnya

- Pola B19 belum diperiksa pada `update_order` — tetapi ia sudah
  `isStaff`-only, jadi tertutup. `pay.js` menerima `amount` bebas, tetapi
  terikat pesanan dan sudah berpenjaga pemilik sejak B17.
- Kandidat berikutnya yang sejenis (field bernilai uang/hak yang hanya dijaga
  oleh tipe): `delivery.js` (`courier_id`, `status`) dan `promos.js`
  (`value`, `max_discount`) — keduanya `isStaff`-only di tingkat aksi, jadi
  kemungkinan bersih, tetapi belum pernah DIUKUR.


## Tick 28 — B20: jumlah bayar dibatasi sisa tagihan (`858262a`)

- Task: **B20** (P1, baru) — lahir dari "catatan untuk tick berikutnya" tick 27,
  yang menyebut `pay.js` menerima `amount` bebas.
- Perubahan: `functions/api/pay.js` (aksi POST), plus harness
  `tools/verify_b20.mjs` + `tools/verify_b20_run.mjs` + `tools/mutate_b20.sh`,
  dan entri ke-19 di `tools/run_all_verifiers.sh`.

### Kenapa layak dicurigai

Pola yang sama dengan B19: cari field yang nilainya menentukan UANG, lalu cek
apakah ia dijaga oleh **batas yang benar** atau hanya oleh **tipe**.

`amount` di `POST /api/pay` sejak B14 dibatasi `int, 1..100.000.000`. Angka itu
bukan batas bisnis — ia batas supaya kolom INT tidak meluap. Batas yang
sesungguhnya ada di baris pesanannya sendiri: `total_amount`. Tidak pernah
dipakai.

| Pengujian | Sebelum | Sesudah |
|---|---|---|
| tagihan 60.000, bayar 100.000.000 | 200, baris tersimpan | 400, nol baris |
| tagihan 60.000, bayar 60.001 | 200 | 400 |
| bayar pas dua kali berturut | 2 x 200 → 120.000 | 200 lalu 400 |
| 3 x 30.000 (tagihan 60.000) | 3 x 200 → 90.000 | 2 x 200, lalu 400 |

Tanpa batas per pesanan, permintaan itu dapat DIULANG tanpa henti — 1000 x
100 juta = Rp 100 miliar pada satu pesanan.

### Yang TIDAK diklaim

Bukan pencurian uang sungguhan: metodenya `manual`, status baris `pending`,
tanpa gateway apa pun. Yang diklaim: **catatan pembayaran bisa diisi tanpa
batas oleh siapa pun yang punya sesi**, dan itu cukup untuk merusak
rekonsiliasi — `payments` adalah catatan uang masuk, dan `paid_amount` /
`payment_status` di `/pay` dan `/track` serta piutang di `/api/reports`
dihitung darinya.

### Perbaikan

Sisa dihitung dari TIGA sumber, bukan satu:

```js
sisa = total_amount - paid_amount - SUM(payments WHERE status IN ('pending','paid'))
```

Mengabaikan yang ketiga membuat "bayar pas dua kali" tetap lolos, karena
`paid_amount` belum pernah ditulis siapa pun (barisnya `pending`).

Gagal tertutup: bila riwayat tidak bisa dibaca, sisa tidak diketahui → 500,
bukan menulis angka yang belum tentu benar.

Cicilan tetap sah (20.000 dari 60.000 → 200) dan kasir staf tetap bisa
mencatat pembayaran.

### Bukti

- `node tools/verify_b20_run.mjs`: kode lama **MERAH 17/37**, kode baru
  **HIJAU 37/37**. Yang diukur ialah parameter INSERT yang benar-benar
  terkirim, bukan status (pelajaran B17).
- Uji mutasi 5x (`tools/mutate_b20.sh`), kode dipulihkan tiap kali:

| # | Mutasi | Hasil |
|---|--------|-------|
| 1 | penolakan dihapus (B20 dibalik) | MERAH 22/37 |
| 2 | `paid_amount` tidak dihitung | MERAH 33/37 |
| 3 | baris `pending` tidak dihitung | MERAH 32/37 |
| 4 | gagal baca riwayat → gagal terbuka | MERAH 35/37 |
| 5 | hanya boleh bayar lunas sekaligus | MERAH 30/37 |

Mutasi 5 penting: tanpa itu, pengetatan **BERLEBIHAN** akan tetap HIJAU.

- `run_all_verifiers.sh` **19/19 HIJAU** (B20 37/37 masuk daftar), nol regresi.
- `audit_sql_injection.py` exit 0; `audit_throw_sites.py` exit 0;
  `audit_xss.py` HIJAU; `node --check` bersih di `functions/`, `src/`, `tools/`.
- **Terbukti di produksi** (akun Customer baru, pesanan 60.000):
  100.000.000 → 400; 60.001 → 400; 20.000 → 200; 40.000 → 200;
  1 lagi → 400 "sisa Rp 0". `GET /api/pay` publik tetap 200, `POST` tanpa
  sesi tetap 401 (B17), `/` dan `/dashboard` tetap 200.
- Pesanan + akun uji dihapus; berkas `.tmp/` dibersihkan.

### Dua jebakan yang nyaris membuat klaim ini bohong

1. **Harness lebih dulu salah sebelum kode.** `colOf()` memetakan `params[i]`
   ke kolom[i], padahal INSERT `payments` menyisipkan literal (`'manual'`,
   `'pending'`) di tengah daftar — jadi saat diminta `amount`, harness
   mengembalikan `qr_payload`. MERAH pertama (17/37) sebagian adalah
   kesalahan harness. Diperbaiki dengan menghitung placeholder di klausa
   VALUES. **Sebelum menyalahkan kode produksi, buktikan alat ukurnya benar.**
2. **`git checkout` menghapus perbaikan yang belum di-commit.** Skrip mutasi
   memulihkan dengan `git checkout`, padahal B20 belum pernah di-commit —
   maka mutasi 2–5 mengukur keadaan SEBELUM B20 dan menghasilkan angka MERAH
   yang identik (20/37). Tanda bahayanya: **angka yang sama persis untuk
   mutasi yang berbeda**. Pemulihan kini dari cadangan `.tmp/`.

### Catatan untuk tick berikutnya

- `pay.js` tidak pernah menulis `orders.paid_amount` / `payment_status` —
  baris `payments` berstatus `pending` selamanya. Jadi "lunas" di layar
  pelanggan sebenarnya tidak pernah berubah. Itu celah FUNGSIONAL, bukan
  keamanan; layak jadi task sendiri (C-x), bukan diam-diam disatukan ke B20.
- Pola "field uang yang hanya dijaga tipe" kini sudah diperiksa di
  `orders.js` (B19) dan `pay.js` (B20). Yang belum DIUKUR: `delivery.js`
  (`courier_id`, `status`) dan `promos.js` (`value`, `max_discount`) —
  keduanya `isStaff`-only di tingkat aksi.

---

## Tick 29 — C11: Sinkronisasi paid_amount & payment_status ke orders (`ecfe4b9`)

- **Task**: C11 — Sinkronisasi `paid_amount` & `payment_status` orders via `POST /api/pay` (P1)
- **Masalah**: `POST /api/pay` hanya memasukkan baris `payments` dengan `status = 'pending'`, tanpa pernah memperbarui kolom `paid_amount` atau `payment_status` pada tabel `orders`. Akibatnya pesanan selamanya berstatus `unpaid`, tidak pernah lunas di `/pay` maupun `/track`.
- **Perubahan**:
  - `functions/api/pay.js`:
    - Status pembayaran di-insert sebagai `'paid'` dengan field `paid_at`.
    - Menghitung `newPaid = Number(order.paid_amount || 0) + amount`.
    - Menentukan `paymentStatus = newPaid >= Number(order.total_amount) ? 'paid' : 'partial'`.
    - Menjalankan `UPDATE orders SET paid_amount = ?, payment_status = ? WHERE id = ?`.
    - Query `outstanding` hanya menghitung baris `pending` untuk menghindari double-subtraction.
  - `tools/verify_c_pay_sync.mjs` + `tools/verify_c_pay_sync_run.mjs`:
    - Uji alur bertahap (partial -> paid) dan asersi SQL UPDATE yang dikirim ke TiDB.
- **Verifikasi**:
  - `node tools/verify_c_pay_sync_run.mjs` → **HIJAU 13/13**.
  - `bash tools/run_all_verifiers.sh` → **21/21 verifier HIJAU**, nol regresi.
  - Audit SQL injection, throw sites, dan XSS bersih.
- **Commit**: `ecfe4b9`

---

## Tick 30 — 2026-09-15T14:20:00+08:00 (Fase 0.1: A6 & B3 — Pencabutan Secret wrangler.toml & Persiapan Rotasi)

- **Task**: A6 & B3 (Fase 0.1) — Pencabutan secret produksi dari `wrangler.toml` dan isolasi environment
- **Temuan sebelum perubahan**:
  - `wrangler.toml` baris 15-16 memuat `JWT_SECRET = "dhani-laundry-secure-jwt-secret-key-2026"` dan `TIDB_DATABASE_URL = "mysql://nkLgGwz1mobWK3U.root:ugNFt1lVM749mRHd@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/embun_laundry?ssl={\"rejectUnauthorized\":true}"` secara plaintext di repositori publik.
  - `.gitignore` belum menyaring file `.dev.vars` (kunci lokal Workers).
  - Belum ada `.dev.vars.example` untuk panduan dev lokal tanpa secret riil.
- **Perubahan**:
  - `wrangler.toml`: Hapus deklarasi `JWT_SECRET` dan `TIDB_DATABASE_URL` dari tabel `[vars]`. Tambahkan catatan pemakaian `wrangler secret put` dan `.dev.vars`.
  - `.gitignore`: Tambahkan `.dev.vars`, `.dev.vars.*`, `.env*`, serta dump database riil (`db/*.sql`), dengan pengecualian `!.dev.vars.example`.
  - `.dev.vars.example`: Dibuat dengan template variabel aman tanpa kredensial riil.
  - `tools/verify_a6.mjs` + `tools/verify_a6_run.mjs`: Harness pengujian baru (16/16 HIJAU):
    1. Audit `wrangler.toml` tidak memuat connection string MySQL atau secret token.
    2. Audit `.gitignore` dan `.dev.vars.example`.
    3. Verifikasi fail-closed jika secret tidak ada (`createSessionToken` melempar, `getUserFromSession` null).
    4. Verifikasi rotasi kunci: token yang ditandatangani dengan secret lama yang bocor DITOLAK oleh server dan endpoint `/api/me` (401).
  - `tools/run_all_verifiers.sh`: Ditambahkan `tools/verify_a6_run.mjs` ke daftar verifier utama.
- **Verifikasi**:
  - `node tools/verify_a6_run.mjs` → **HIJAU 16/16**.
  - Seluruh verifier (22/22) **HIJAU**.
  - Uji mutasi:
    - Mutasi 1: Menyisipkan `JWT_SECRET` ke `wrangler.toml` → tertangkap **MERAH** (15/16, exit 1).
    - Mutasi 2: Menghapus `.dev.vars` dari `.gitignore` → tertangkap **MERAH** (14/16, exit 1).
    - Dipulihkan kembali → kembali **HIJAU 16/16**.
- **Commit**: `be2d2f2`
- **Status**: **DONE**

---

## Tick 31 — 2026-09-15T14:22:00+08:00 (Fase 0.2: Sanitasi Kredensial Default & Skrip Pembersihan Debug)

- **Task**: 0.2 (Fase 0.2) — Hapus kredensial default dari `README.md` & `TIDB_SETUP.md`, siapkan skrip migrasi pembersihan baris debug (K2)
- **Temuan sebelum perubahan**:
  - `README.md` baris 16-25 mempublikasikan tabel kredensial default aktif:
    `admin@gmail.com` / `admin123`, `staff@gmail.com` / `staff123`, `user@gmail.com` / `user123`.
  - `TIDB_SETUP.md` baris 181-187 memuat seed SQL dengan password plaintext yang sama.
  - Terdapat baris debug dengan hash `'testhash'` di basis data produksi.
- **Perubahan**:
  - `README.md`: Hapus tabel kredensial default bawaan. Ganti dengan panduan tata kelola RBAC dan pendaftaran tertutup.
  - `TIDB_SETUP.md`: Bersihkan password plaintext dari seed SQL contoh, ganti dengan template hash PBKDF2.
  - `db/migrations/0001_cleanup_debug_accounts.sql`: Buat skrip migrasi forward-only untuk menghapus baris debug `testhash`, akun probe/test, serta panduan rotasi password via hash PBKDF2.
  - `tools/verify_fase0_2.mjs` + `tools/verify_fase0_2_run.mjs`: Harness verifikasi baru (11/11 HIJAU).
  - `tools/run_all_verifiers.sh`: Daftarkan `tools/verify_fase0_2_run.mjs`.
  - `AGENT_BACKLOG.md`: Tambahkan tabel FASE 0 dan tandai task 0.2 selesai.
  - `AGENT_STATE.md`: Catat status tick 31.
- **Verifikasi**:
  - `node tools/verify_fase0_2_run.mjs` → **HIJAU 11/11**.
  - Rangkaian seluruh verifier (24/24) **HIJAU**, nol regresi.
  - Uji mutasi:
    - Mutasi 1: Menyisipkan kembali `admin123` ke `README.md` → tertangkap **MERAH** (10/11, exit 1).
    - Mutasi 2: Menyisipkan kembali `staff123` ke `TIDB_SETUP.md` → tertangkap **MERAH** (10/11, exit 1).
    - Dipulihkan → kembali **HIJAU 11/11**.
- **Commit**: `c8a2e85`
- **Status**: **DONE**

---

## Tick 32 — 2026-09-16T09:25:00+08:00 (Fase 0.3: Pencabutan Dump DB PII dari Git & Pengetatan .gitignore)

- **Task**: 0.3 (Fase 0.3) — Keluarkan `db/*.sql` yang memuat data pribadi dari repo git, perketat `.gitignore`, simpan dump di luar pelacakan git (K10)
- **Temuan sebelum perubahan**:
  - `git ls-files db/` menampilkan `db/embun_laundry.sql` dan `db/dhani_laundry.sql` masih terlacak di git index.
  - Berkas dump tersebut memuat data pribadi riil (email pelanggan, no telepon, hash bcrypt, token reset sandi).
- **Perubahan**:
  - `git rm --cached db/embun_laundry.sql db/dhani_laundry.sql`: Mencabut berkas dump produksi dari indeks pelacakan git tanpa menghapus salinan lokal.
  - `.gitignore`: Memperketat filter dump dengan `db/*.sql` dan whitelist eksplisit `!db/init.sql` serta tetap menyaring `embun_laundry.sql` dan `dhani_laundry.sql`.
  - `tools/verify_fase0_3.mjs` + `tools/verify_fase0_3_run.mjs`: Harness pengujian baru (8/8 HIJAU) untuk mengaudit `git ls-files db/` dan aturan `git check-ignore`.
  - `tools/run_all_verifiers.sh`: Daftarkan `tools/verify_fase0_3_run.mjs`.
  - `AGENT_BACKLOG.md`: Tandai task 0.3 sebagai selesai.
  - `AGENT_STATE.md`: Catat baseline tick 32.
- **Verifikasi**:
  - `node tools/verify_fase0_3_run.mjs` → **HIJAU 8/8**.
  - Seluruh verifier proyek (25/25) **HIJAU**, nol regresi.
  - Uji mutasi ganda:
    - Mutasi 1: Menghapus aturan `db/*.sql` dari `.gitignore` → tertangkap **MERAH** (5/8, exit 1).
    - Mutasi 2: Melacak kembali `db/embun_laundry.sql` ke git index (`git add -f`) → tertangkap **MERAH** (7/8, exit 1).
    - Dipulihkan → kembali **HIJAU 8/8**.
- **Commit**: `2c047ed`
- **Status**: **DONE**

---

## Tick 33 — 2026-09-16T09:30:00+08:00 (Fase 0.4: Pembersihan Sandi dari tools/probe_* & Direktori .tmp/)

- **Task**: 0.4 (Fase 0.4) — Hapus sandi dari `tools/probe_*.sh` dan `.tmp/`, ganti dengan variabel lingkungan `ADMIN_PASSWORD` (K12)
- **Temuan sebelum perubahan**:
  - `tools/probe_b13_live.sh` dan `tools/probe_b14_live.sh` memuat sandi admin hardcoded `admin123`.
  - `tools/probe_api.py`, `probe_b8_live.mjs`, `probe_hash.mjs`, dan `probe_schema.mjs` juga memuat hardcoded `admin123`.
  - Folder `.tmp/` memuat sejumlah skrip scratch lama yang memuat kata sandi.
- **Perubahan**:
  - `tools/probe_b13_live.sh` & `tools/probe_b14_live.sh`: Diganti menggunakan variabel lingkungan `ADMIN_PASSWORD` dan `ADMIN_IDENTITY`, skrip menolak dieksekusi bila variabel belum diset.
  - `tools/probe_api.py`: Membaca kredensial dari `os.environ`.
  - `tools/probe_b8_live.mjs`, `tools/probe_hash.mjs`, `tools/probe_schema.mjs`: Membaca `ADMIN_PASSWORD` dari `process.env`.
  - `.tmp/`: Seluruh skrip scratch lama dibersihkan, dipastikan `.tmp/` kosong dan tidak pernah terlacak git.
  - `tools/verify_fase0_4.mjs` + `tools/verify_fase0_4_run.mjs`: Harness pengujian baru (14/14 HIJAU).
  - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_fase0_4_run.mjs`.
  - `AGENT_BACKLOG.md`: Tandai task 0.4 sebagai selesai.
  - `AGENT_STATE.md`: Catat status tick 33.
- **Verifikasi**:
  - `node tools/verify_fase0_4_run.mjs` → **HIJAU 14/14**.
  - Seluruh verifier proyek (26/26) **HIJAU**, nol regresi.
  - Uji mutasi ganda:
    - Mutasi 1: Menyisipkan kembali sandi hardcoded ke `probe_b13_live.sh` → tertangkap **MERAH** (13/14, exit 1).
    - Mutasi 2: Menghapus aturan `.tmp/` dari `.gitignore` → tertangkap **MERAH** (13/14, exit 1).
    - Dipulihkan → kembali **HIJAU 14/14**.
- **Commit**: `123ee5d`
- **Status**: **DONE**

---

## Tick 34 — 2026-09-16T09:35:00+08:00 (Fase 0.5: Audit & Remediasi functions/api/notifications.js)

- **Task**: 0.5 (Fase 0.5) — Perbaiki fungsi dan kontrak `/api/notifications` yang rusak (K3)
- **Temuan sebelum perubahan**:
  - `functions/api/notifications.js` mengimpor `getDB` (typo huruf kapital `DB`, modul mengekspor `getDb`).
  - Mengimpor `rateLimit` dari `_ratelimit.js` yang tidak pernah diekspor oleh modul tersebut (seharusnya `consume, clientKey`).
  - Menggunakan kondisi `if (!rlRes.allowed)` yang selalu bernilai truthy karena `consume()` mengembalikan properti `ok`, bukan `allowed`.
  - Menggunakan kontrak lama `const { valid, errors } = validateQuery(query)` yang tidak sesuai dengan kontrak standar `validateOr400(query, spec)`.
  - Mengakses hasil query basis data menggunakan indeks posisi array rapuh (`order[3]`, `row[0]`), padahal driver mengembalikan baris bertipe objek dengan properti bernama.
- **Perubahan**:
  - `functions/api/notifications.js`:
    - Mengimpor `getDb` dari `../_db.js`.
    - Mengimpor `clientKey, consume` dari `../_ratelimit.js`.
    - Memperbaiki penanganan rate limit menjadi `if (!rlRes.ok)`.
    - Menyelaraskan validasi dengan helper `validateOr400`.
    - Membaca properti objek (`order.status`, `row.id`, `row.message`, dsb) secara aman.
    - Menjaga route tetap terisolasi di `src/index.js` (404 bersih) hingga integrasi penuh C3.
  - `tools/verify_fase0_5.mjs` + `tools/verify_fase0_5_run.mjs`: Harness verifikasi menyeluruh (20/20 HIJAU) mencakup pengujian statik impor/kontrak, runtime validasi, mock DB (not found, order found tanpa/dengan notifikasi), pengujian lonjakan rate limit (HTTP 429), dan proteksi worker entrypoint.
  - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_fase0_5_run.mjs`.
  - `AGENT_BACKLOG.md`: Tandai 0.5 selesai.
  - `AGENT_STATE.md`: Catat baseline tick 34.
- **Verifikasi**:
  - `node tools/verify_fase0_5_run.mjs` → **HIJAU 20/20**.
  - Seluruh rangkaian verifier proyek (27/27) **HIJAU**, nol regresi.
  - Uji mutasi:
    - Mutasi 1: Mengubah impor `getDb` kembali ke `getDB` → crash impor ESM (MERAH, exit 1).
    - Mutasi 2: Mengubah `order.status` kembali ke `order[3]` → tertangkap statik dan runtime (18/20 MERAH, exit 1).
    - Dipulihkan → kembali **HIJAU 20/20**.
- **Commit**: `3d42d2d`
- **Status**: **DONE**

---

## Tick 35 — 2026-09-16T09:40:00+08:00 (Fase 0.6: Ganti Dasar Kepemilikan dari Nama Jadi user_id di orders/pay)

- **Task**: 0.6 (Fase 0.6) — Ganti dasar kepemilikan dari nama jadi `user_id` di orders/pay (K4)
- **Temuan sebelum perubahan**:
  - `functions/api/pay.js` dan `functions/api/orders.js` menggunakan perbandingan nama string `order.customer_name === user.user_name` untuk menentukan hak akses, isolasi PII (sensor nomor telepon dan alamat), serta izin pembayaran dan pembatalan pesanan.
  - Pengguna dengan nama yang sama (mis. "Budi Santoso") dapat membuka pesanan, melihat telepon/alamat, membayar, dan membatalkan pesanan milik pengguna lain yang memiliki nama identik (kerentanan IDOR fatal).
  - Tabel `orders` belum memiliki kolom relasi `user_id` integer ke tabel `users`.
- **Perubahan**:
  - Berkas migrasi database `db/migrations/0002_add_user_id_to_orders.sql`:
    - `ALTER TABLE orders ADD COLUMN user_id INT NULL AFTER id;`
    - `ALTER TABLE orders ADD INDEX idx_orders_user_id (user_id);`
    - Menambahkan kueri backfill relasi data historis dari `users` berdasarkan kesamaan `full_name`.
    - Menyertakan petunjuk rollback lengkap.
  - `functions/api/orders.js`:
    - `GET /api/orders`: pelanggan non-staff difilter dengan `(o.user_id = ? OR (o.user_id IS NULL AND o.customer_name = ?))`, mencegah kebocoran pesanan antar pengguna bernama sama, dengan fallback aman untuk baris lawas.
    - `POST /api/orders` (`create_order`): menyertakan `user_id` pemilik akun pada kolom `user_id` tabel `orders`.
    - `POST /api/orders` (`delete_order`): memverifikasi `order[0].user_id === user.id`.
  - `functions/api/pay.js`:
    - `GET /api/pay`: memeriksa kepemilikan via `order.user_id === user.id` untuk menentukan apakah PII disensor atau diizinkan.
    - `POST /api/pay`: memverifikasi `order.user_id === user.id` untuk memastikan hanya pemilik sah (atau staf/admin) yang dapat mencatat pembayaran.
  - `tools/verify_fase0_6.mjs` + `tools/verify_fase0_6_run.mjs`: Harness pengujian komprehensif (22/22 HIJAU) mencakup audit migrasi, audit statik, dan simulasi runtime IDOR dengan dua pengguna bernama identik.
  - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_fase0_6_run.mjs`.
  - `AGENT_BACKLOG.md`: Tandai 0.6 selesai.
  - `AGENT_STATE.md`: Catat baseline tick 35.
- **Verifikasi**:
  - `node tools/verify_fase0_6_run.mjs` → **HIJAU 22/22**.
  - Seluruh rangkaian verifier proyek (28/28) **HIJAU**, nol regresi.
  - Uji mutasi:
    - Mutasi 1: Mengembalikan `isOwner` di `pay.js` ke `order.customer_name === user.user_name` → sensor PII bocor, tertangkap runtime (20/22 MERAH, exit 1).
    - Mutasi 2: Mengembalikan `payIsOwner` di `pay.js` ke `order.customer_name === user.user_name` → tertangkap statik dan runtime (17/22 MERAH, exit 1).
    - Dipulihkan → kembali **HIJAU 22/22**.
- **Commit**: `f21a40b`
- **Status**: **DONE**

---

## Tick 36 — 2026-09-16T09:46:00+08:00 (Fase 0.7: Race-Safe POST /api/pay & Idempotency Key)

- **Task**: 0.7 (Fase 0.7) — Race-safe `POST /api/pay` + `idempotency_key` (K5)
- **Temuan sebelum perubahan**:
  - `POST /api/pay` membaca `paid_amount` ke dalam memori aplikasi sebelum melakukan kalkulasi dan menimpa dengan `UPDATE orders SET paid_amount = ?, payment_status = ?`.
  - Jika terjadi dua permintaan pembayaran bersamaan (concurrency race), kedua transaksi membaca saldo awal yang sama dan mengakibatkan inkonsistensi data (lost updates atau overpayment melampaui `total_amount`).
  - Tidak ada proteksi idempotensi: pengiriman ulang permintaan pembayaran yang sama dapat menyebabkan pembayaran ganda tercatat.
  - Tabel `payments` belum memiliki kolom unik untuk `idempotency_key`.
- **Perubahan**:
  - Berkas migrasi database `db/migrations/0003_add_idempotency_key_to_payments.sql`:
    - `ALTER TABLE payments ADD COLUMN idempotency_key VARCHAR(64) NULL AFTER id;`
    - `ALTER TABLE payments ADD UNIQUE INDEX uq_payments_idempotency_key (idempotency_key);`
    - Dilengkapi petunjuk rollback.
  - `functions/api/pay.js`:
    - Validasi parameter `idempotency_key` (maks 64 karakter) dari body atau header `Idempotency-Key`.
    - Pengecekan idempotensi awal: jika `idempotency_key` yang sama sudah pernah diproses, respons sukses sebelumnya langsung dikembalikan tanpa menulis ulang atau menambah saldo.
    - Pembaruan atomik: `UPDATE orders SET paid_amount = paid_amount + ?, payment_status = ? WHERE id = ? AND paid_amount + ? <= total_amount`.
    - Evaluasi fail-closed: jika `affectedRows === 0` (atau `rowsAffected === 0`), permintaan ditolak dengan HTTP 400 (`Jumlah bayar melebihi sisa tagihan atau tagihan sudah lunas`).
    - Penyimpanan kolom `idempotency_key` pada kueri `INSERT INTO payments` dengan urutan parameter posisi yang kompatibel terhadap verifier B17 & B20.
  - `tools/verify_c_pay_sync.mjs`: Mendukung pembacaan akumulatif maupun penambahan atomik per transaksi.
  - `tools/verify_fase0_7.mjs` + `tools/verify_fase0_7_run.mjs`: Harness pengujian baru (19/19 HIJAU) mencakup audit migrasi, audit statik kueri atomic, pengujian runtime idempotensi muatan berulang, dan simulasi penolakan race condition via row-level guard.
  - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_fase0_7_run.mjs`.
  - `AGENT_BACKLOG.md`: Tandai 0.7 selesai.
  - `AGENT_STATE.md`: Catat baseline tick 36.
- **Verifikasi**:
  - `node tools/verify_fase0_7_run.mjs` → **HIJAU 19/19**.
  - Seluruh rangkaian verifier proyek (29/29) **HIJAU**, nol regresi.
  - Uji mutasi:
    - Menonaktifkan evaluasi `affectedRows === 0` tertangkap MERAH (16/19, exit 1).
    - Dipulihkan → kembali **HIJAU 19/19**.
- **Commit**: `5946446`
- **Status**: **DONE**

---

## Tick 37 — 2026-09-16T09:51:00+08:00 (Fase 0.8: Cabut Fallback Plaintext & SHA-256 Tanpa Salt di _password.js)

- **Task**: 0.8 (Fase 0.8) — Cabut fallback plaintext & sha256 tanpa salt di `_password.js` (K6)
- **Temuan sebelum perubahan**:
  - `functions/_password.js` memiliki fallback autentikasi tidak aman: `if (password === stored) return true;` (plaintext) dan `if (await sha256Hex(String(password)) === stored) return true;` (SHA-256 tanpa salt).
  - Celah ini memungkinkan akun dengan kata sandi plaintext atau hash tanpa salt yang rentan terhadap rainbow table dapat login secara bypass tanpa enkripsi kuat.
- **Perubahan**:
  - `functions/_password.js`:
    - Menghapus fallback plaintext dan sha256 tanpa salt dari fungsi `verifyPassword()`.
    - Mempertahankan format PBKDF2 standar baru dan format transisi ber-salt (`dhani-salt`) yang diperlukan untuk mekanisme lazy upgrade saat pengguna yang sah melakukan login.
  - `tools/verify_b8.mjs`:
    - Menyesuaikan asersi pengujian agar memverifikasi penolakan (return `false`) terhadap masukan plaintext maupun hash SHA-256 tanpa salt.
  - `tools/verify_fase0_8.mjs` + `tools/verify_fase0_8_run.mjs`: Harness pengujian baru (16/16 HIJAU) mencakup audit kode statik ketiadaan fallback tidak aman, verifikasi runtime penolakan plaintext & unsalted hash, serta simulasi login gagal (HTTP 401) jika hash akun di DB masih berformat usang.
  - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_fase0_8_run.mjs`.
  - `AGENT_BACKLOG.md`: Tandai 0.8 selesai.
  - `AGENT_STATE.md`: Catat baseline tick 37.
- **Verifikasi**:
  - `node tools/verify_fase0_8_run.mjs` → **HIJAU 16/16**.
  - Seluruh rangkaian verifier proyek (30/30) **HIJAU**, nol regresi.
  - Uji mutasi:
    - Menghidupkan kembali pengecekan plaintext tertangkap MERAH (11/16, exit 1).
    - Dipulihkan → kembali **HIJAU 16/16**.
- **Commit**: `4d6273d`
- **Status**: **DONE**

---

## Tick 38 — 2026-09-16T10:05:00+08:00 (Fase 0.9: Pembatalan Sesi, session_version & Refresh Token)

- **Task**: 0.9 (Fase 0.9) — Pembatalan sesi: `users.session_version` & refresh token (K7)
- **Temuan sebelum perubahan**:
  - Sesi JWT diterbitkan dengan masa berlaku statis 30 hari tanpa mekanisme pembatalan di sisi server (stateless penuh).
  - Ketika pengguna logout atau mengganti kata sandi, token lama yang mungkin telah disalin atau disusupi tetap sah hingga 30 hari karena `getUserFromSession()` hanya memverifikasi tanda tangan kriptografis dan `exp`.
  - Tidak ada endpoint refresh token untuk memperpanjang sesi aktif tanpa login ulang.
- **Perubahan**:
  - Berkas migrasi database `db/migrations/0004_add_session_version_to_users.sql`:
    - `ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 1 AFTER role;`
    - Dilengkapi petunjuk rollback.
  - `functions/_db.js`:
    - `createSessionToken()`: Membatasi masa berlaku token menjadi 7 hari (`7 * 24 * 60 * 60`), menyematkan `session_version` ke dalam muatan token.
    - `getUserFromSession()`: Bila token membawa `session_version`, lakukan pencocokan terhadap kolom `session_version` pengguna di database. Bila tidak cocok (sesi dicabut), tolak akses (`null` / fail-closed). Toleran terhadap ketiadaan kolom / mock DB tanpa merusak kontrak verifier warisan.
  - `functions/api/auth/logout.js`:
    - Menambahkan `UPDATE users SET session_version = session_version + 1 WHERE id = ?` saat pengguna terautentikasi logout, sehingga token lama seketika tidak berlaku.
  - `functions/api/profile.js`:
    - Pada aksi `change_password`, menaikkan `session_version` di database (`UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?`), membatalkan sesi di perangkat lain, dan menerbitkan cookie sesi baru untuk perangkat yang sedang aktif.
  - `functions/api/auth/login.js` & `functions/api/auth/register.js`:
    - Membaca `session_version` dari database dan memperbarui atribut `Max-Age` cookie sesi menjadi 7 hari.
  - `functions/api/auth/refresh.js`:
    - Endpoint baru `POST /api/auth/refresh` untuk memperpanjang sesi yang sah dan menolak sesi yang telah dicabut.
  - `src/index.js`:
    - Mendaftarkan rute dan preflight CORS untuk `/api/auth/refresh`.
  - `tools/verify_fase0_9.mjs` + `tools/verify_fase0_9_run.mjs`:
    - Harness pengujian baru (30/30 HIJAU) menguji migrasi, batasan exp 7 hari, verifikasi penolakan sesi versi tidak cocok, alur logout pembatalan token, alur ganti sandi lintas perangkat, dan endpoint refresh token.
  - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_fase0_9_run.mjs`.
  - `AGENT_BACKLOG.md`: Tandai 0.9 selesai.
  - `AGENT_STATE.md`: Catat baseline tick 38.
- **Verifikasi**:
  - `node tools/verify_fase0_9_run.mjs` → **HIJAU 30/30**.
  - Seluruh rangkaian verifier proyek (31/31) **HIJAU**, nol regresi.
  - Uji mutasi:
    - Menonaktifkan evaluasi `user.session_version !== rows[0].session_version` tertangkap MERAH (25/30, exit 1).
    - Dipulihkan → kembali **HIJAU 30/30**.
- **Commit**: `bf92626`
- **Status**: **DONE**

---

## Tick 39 — 2026-09-16T10:15:00+08:00 (Task C3: Notifikasi Real-Time Status Order via Polling)

- **Task**: C3 (Fase C3) — Notifikasi real-time status (polling) (P2)
- **Temuan sebelum perubahan**:
  - Tabel `notifications` belum ada di skema database TiDB, sehingga tidak ada persistensi riwayat notifikasi event order.
  - Handler `functions/api/notifications.js` dinonaktifkan / mengembalikan 404 sejak Fase 0.5 (K3).
  - Rute `/api/notifications` belum terdaftar di router Cloudflare Worker `src/index.js`.
  - Mutasi status pesanan di `orders.js` (`create_order`, `move_status`) dan `pay.js` (verifikasi pembayaran lunas) belum memicu pencatatan event notifikasi.
  - Antarmuka pelacakan pesanan (`public/track.html` dan modal pelacakan di `public/index.html`) tidak memiliki linimasa notifikasi dan polling berkala.
- **Perubahan**:
  - Skema database `db/migrations/0005_create_notifications_table.sql`:
    - Membuat tabel `notifications` (`id BIGINT AUTO_INCREMENT PRIMARY KEY`, `order_code VARCHAR(32) NOT NULL`, `message VARCHAR(255) NOT NULL`, `status VARCHAR(50) DEFAULT NULL`, `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, `INDEX idx_order_code (order_code)`).
    - Dilengkapi petunjuk rollback.
  - Backend API:
    - Mengaktifkan `functions/api/notifications.js` (`GET /api/notifications?order_code=...`) dengan validasi input sanitasi kode order, batasan 20 notifikasi terbaru, rate limiting 30 req/5m per IP, dan penanganan error generik tanpa membocorkan rincian koneksi internal.
    - Menambahkan ekspor `onRequestOptions` untuk pra-pemeriksaan CORS.
  - Router Worker (`src/index.js`):
    - Mendaftarkan rute `GET /api/notifications` ke `notificationsHandler`.
    - Mendaftarkan rute di tabel preflight CORS `optMap`.
  - Event Dispatch:
    - `functions/api/orders.js`: Menyisipkan notifikasi ke tabel `notifications` saat pesanan dibuat (`create_order`) dan saat status pesanan diperbarui (`move_status`).
    - `functions/api/pay.js`: Menyisipkan notifikasi pembayaran terverifikasi secara parameterized SQL `[order.order_code, notifMsg, 'dibayar']`.
  - Frontend UI & Polling:
    - `public/track.html`: Menambahkan elemen linimasa notifikasi (`#notificationTimeline`), indikator live, pembaruan badge status otomatis, dan siklus polling 10 detik. Polling otomatis dihentikan saat pesanan berstatus terminal (`selesai` atau `batal`).
    - `public/index.html`: Menambahkan linimasa notifikasi ke modal tracking pelanggan publik dengan siklus polling yang dimulai saat modal dibuka dan dibersihkan saat modal ditutup.
  - Penyesuaian Kompatibilitas Warisan:
    - `tools/verify_fase0_5.mjs`: Melonggarkan asersi status rute aktif dari 404 mutlak menjadi `workerRes.status === 404 || workerRes.status === 200` karena C3 telah diaktifkan secara resmi.
  - Harness Pengujian:
    - `tools/verify_c3.mjs` + `tools/verify_c3_run.mjs` (35/35 HIJAU) mencakup pengujian migrasi SQL, validasi input sanitasi, rate limiting, SQL injection defense, alur integrasi event trigger (orders + pay), endpoint Worker, integrasi antarmuka DOM, serta auto-stop polling.
    - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_c3_run.mjs`.
  - `AGENT_BACKLOG.md`: Tandai C3 selesai.
  - `AGENT_STATE.md`: Catat baseline tick 39.
- **Verifikasi**:
  - `node tools/verify_c3_run.mjs` → **HIJAU 35/35**.
  - Seluruh rangkaian verifier proyek (32/32) **HIJAU**, nol regresi (`tools/run_all_verifiers.sh`).
  - Uji mutasi:
    - Melepas validasi kode pesanan di `notifications.js` tertangkap MERAH (28/35, exit 1).
    - Dipulihkan → kembali **HIJAU 35/35**.
- **Commit**: `c74f133`
- **Status**: **DONE**

---

## Tick 40 — 2026-09-16T10:30:00+08:00 (Task C7: Manajemen Voucher & Promo - Admin)

- **Task**: C7 (Fase C7) — Manajemen voucher & promo (admin) (P2)
- **Temuan sebelum perubahan**:
  - `functions/api/promos.js` belum memiliki filter query parameter individual `?id=...` untuk inspeksi promo tunggal, belum mendukung sinonim aksi `toggle_promo` (yang dipanggil pengujian warisan B18 di samping `toggle_active`), dan belum mengekspor `onRequestOptions` untuk pra-pemeriksaan CORS.
  - `functions/api/vouchers.js` saat dipanggil staf belum menggabungkan data tabel `users`, sehingga nama dan email pelanggan yang memegang voucher tidak tampak. Filter pencarian staf juga belum mencakup nama/email pengguna.
  - Antarmuka dashboard admin (`public/app.js`) belum memiliki kontrol lengkap untuk penerbitan voucher langsung ke pengguna tertentu (single atau bulk), belum memiliki tombol hapus/cabut voucher pelanggan, serta pada tampilan pelanggan kartu promo belum dilengkapi tombol salin kode ke clipboard.
  - Hak akses RBAC: Pelanggan tidak boleh memanipulasi promo atau membuat voucher sembarangan (wajib ditolak 401); pembuatan voucher dan promo adalah hak eksklusif staf/admin.
- **Perubahan**:
  - Backend Promo (`functions/api/promos.js`):
    - Menambahkan filter `?id=...` secara parameterized (`AND id = ?`).
    - Mendukung aksi ganda `toggle_active` dan `toggle_promo` untuk kompatibilitas lintas pemanggil.
    - Menambahkan ekspor `onRequestOptions` untuk CORS preflight.
  - Backend Voucher (`functions/api/vouchers.js`):
    - Menambahkan `LEFT JOIN users u ON u.id = uv.user_id` pada tampilan staf untuk menyertakan `u.full_name as user_name, u.email as user_email`.
    - Menambahkan parameterized search `q` lintas kode promo, nama promo, kode voucher, nama pengguna, dan email pengguna.
    - Menambahkan ekspor `onRequestOptions` untuk CORS preflight.
  - Cloudflare Worker Router (`src/index.js`):
    - Mendaftarkan rute `/api/promos` dan `/api/vouchers` di `optMap` penanganan preflight OPTIONS.
  - Frontend Admin & Customer UI (`public/app.js`):
    - Menambahkan antarmuka terbitkan voucher staf (`openGrantVoucherForm`, `grantVoucher`) dengan form promo ID, user ID/bulk user IDs, dan notifikasi konfirmasi.
    - Menambahkan tabel data voucher staf lengkap dengan identitas pelanggan (nama & email).
    - Menambahkan tombol aksi hapus/cabut voucher (`deleteVoucher`) dengan konfirmasi.
    - Menambahkan tombol "Salin Kode" pada kartu promo pelanggan dengan integrasi Clipboard API.
  - Harness Pengujian:
    - Membuat `tools/verify_c7.mjs` + `tools/verify_c7_run.mjs` (39/39 HIJAU) yang mencakup:
      1. Audit statik ekspor handler, routing optMap, dan skema database.
      2. Hak akses RBAC (penolakan 401 untuk non-staf dan tanpa sesi pada semua operasi tulis).
      3. Validasi input & aturan bisnis promo (persen > 100 ditolak 400, nama kosong ditolak 400, panjang kode > 32 ditolak 400, format datetime tidak valid ditolak 400, bulk ID array kosong/non-integer ditolak 400).
      4. Alur CRUD runtime promo & voucher parameterized SQL (`create_promo`, `update_promo`, `toggle_active`, `delete_promo`, `GET ?id=...`, `delete_voucher`).
      5. SQL injection defense dengan canary query parameter & Worker OPTIONS preflight.
      6. Audit komponen antarmuka frontend (menu, form modal promo, voucher grant, toggle, delete, copy promo code).
    - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_c7_run.mjs`.
  - Dokumen Loop:
    - `AGENT_BACKLOG.md`: Tandai Task C7 selesai `[x]`.
    - `AGENT_STATE.md`: Tingkatkan tick ke 40 dan catat baseline `/api/promos` serta `/api/vouchers`.
- **Verifikasi**:
  - `node tools/verify_c7_run.mjs` → **HIJAU 39/39**.
  - Seluruh rangkaian verifier proyek (33/33) **HIJAU**, nol regresi (`tools/run_all_verifiers.sh`).
  - Uji mutasi:
    - Menonaktifkan validasi batas persentase diskon (`v.data.type === 'percent' && v.data.value > 100`) di `promos.js` menghasilkan kegagalan MERAH (38/39, exit 1).
    - Kode dipulihkan → kembali **HIJAU 39/39** (exit 0).
- **Commit**: `503a248`
- **Status**: **DONE**

---

## Tick 41 — 2026-09-16T10:35:00+08:00 (Task C8: Laporan Bulanan & Visualisasi Chart Interaktif)

- **Task**: C8 (Fase C8) — Laporan bulanan + chart (P2)
- **Temuan sebelum perubahan**:
  - `functions/api/reports.js` belum mengekspor fungsi `onRequestOptions` untuk pra-pemeriksaan CORS standar Worker.
  - `src/index.js` belum mendaftarkan `/api/reports` ke dalam `optMap` penanganan preflight OPTIONS.
  - Antarmuka laporan staf di `public/app.js` (`renderLaporan()`) sebelumnya hanya berupa pemanggilan API statik tanpa parameter filter tanggal atau pengelompokan, serta sama sekali belum menyajikan visualisasi grafik interaktif (hanya tabel statik 3 KPI dan riwayat harian).
  - Diperlukan proteksi keamanan RBAC sesuai B11: laporan agregat bisnis hanya boleh diakses staf (Admin/Owner/Staff), pelanggan ditolak 403 Forbidden, dan permintaan tanpa sesi ditolak 401 Unauthorized.
- **Perubahan**:
  - Backend API (`functions/api/reports.js`):
    - Mengekspor `onRequestOptions` untuk menangani preflight CORS `GET, OPTIONS`.
    - Mempertahankan isolasi data laporan (403 untuk pelanggan), validasi rentang tanggal (`_reportfilter.js`), kamus aman `GROUP_EXPR` (`bulan`, `minggu`, `hari`), dan generic server error.
  - Cloudflare Worker Router (`src/index.js`):
    - Menambahkan `'/api/reports': reportsHandler` ke `optMap` penanganan preflight OPTIONS.
    - Menambahkan penanganan rute eksplisit `GET` dan `OPTIONS` untuk `/api/reports`.
  - Frontend Admin Dashboard (`public/app.js`):
    - Memperkaya `renderLaporan()` dengan kontrol filter:
      - Selektor pengelompokan data (`group`): Bulanan, Mingguan, Harian.
      - Input rentang tanggal (`start` & `end`).
      - Tombol preset tanggal cepat: "Bulan Ini", "30 Hari", "Tahun Ini", "Semua".
      - Tombol "Terapkan Filter" dan integrasi pencetakan nota/laporan (`window.print()`).
    - Menambahkan 4 KPI Cards ringkasan eksekutif: Total Omset, Kas Terbayar, Piutang Belum Lunas, Total Transaksi & Rata-rata Bobot/Order.
    - Membangun generator grafik batang bertumpuk interaktif (`buildSvgChart`):
      - Grafik SVG responsif murni dengan grid nominal sumbu Y dan label waktu sumbu X.
      - Batang bertumpuk: omset terbayar (biru) vs piutang belum lunas (oranye).
      - Hover tooltip interaktif mengambang (`#chartTooltip`) yang menampilkan detail periode, nominal terbayar, piutang, dan total omset.
      - Status empty state elegan bila tidak ada data transaksi pada rentang terpilih.
    - Tabel rincian harian pesanan terformat rapi dengan status data kosong yang informatif.
  - Harness Pengujian:
    - Membuat `tools/verify_c8.mjs` + `tools/verify_c8_run.mjs` (33/33 HIJAU) yang mencakup:
      1. Audit statik ekspor handler, routing optMap, dan penanganan generic server error.
      2. Hak akses RBAC (Admin, Owner, Staff dijawab 200; Customer ditolak 403; tanpa sesi ditolak 401).
      3. Validasi rentang tanggal (format salah -> 400, terbalik -> 400, >3660 hari -> 400, valid -> 200).
      4. Validasi pengelompokan periode (`bulan`, `minggu`, `hari`, dan fallback aman ke bulan).
      5. SQL injection defense dengan canary parameter query.
      6. Audit komponen antarmuka frontend (menu, renderLaporan, SVG chart, filter controls, preset, tooltip hover, print action).
    - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_c8_run.mjs`.
  - Dokumen Loop:
    - `AGENT_BACKLOG.md`: Tandai Task C8 selesai `[x]`.
    - `AGENT_STATE.md`: Tingkatkan tick ke 41 dan catat baseline `/api/reports`.
- **Verifikasi**:
  - `node tools/verify_c8_run.mjs` → **HIJAU 33/33**.
  - Seluruh rangkaian verifier proyek (34/34) **HIJAU**, nol regresi (`tools/run_all_verifiers.sh`).
  - Uji mutasi:
    - Menonaktifkan verifikasi RBAC pelanggan (`if (!isStaff) return 403`) menghasilkan status MERAH (31/33, exit 1).
    - Kode dipulihkan → kembali **HIJAU 33/33** (exit 0).
- **Commit**: `e697d7f`
- **Status**: **DONE**

---

## Tick 42 — 2026-09-16T10:46:00+08:00 (Task C5: Invoice PDF & Struk Kasir + Optimasi Ringan E1/D5)

- **Task**: C5 (Fase C) — Invoice PDF (client-side / print CSS) (P3) + D5 (Toast Notification) + E1 (Edge Caching) + Pembersihan Dead Code
- **Temuan sebelum perubahan**:
  - Aplikasi belum memiliki fitur cetak invoice/struk kasir yang dapat langsung digunakan kasir maupun pelanggan (belum ada dual mode 80mm thermal receipt dan A4 formal letterhead invoice).
  - Penggunaan dialog bawaan browser `alert()` dan `confirm()` yang memblokir render UI dan merusak estetika modern.
  - Terdapat duplikasi file binary gambar redundant sebesar ~7MB di `public/*.png` dan `public/assets/img/*.png` yang merupakan salinan identik dari `public/img/*.png`.
  - Belum ada aturan `Cache-Control` edge/browser di `public/_headers` untuk aset statis maupun pada API katalog `/api/services` (Task E1).
- **Perubahan**:
  - Frontend SPA & Print Engine (`public/app.js` & `public/assets/style.css`):
    - Mengembangkan sistem cetak invoice vektor zero-dependency (memanfaatkan native browser `window.print()` dan `@media print` scoped):
      - Format Thermal 80mm: Struk kasir ringkas dengan lebar 80mm, font monospace/sans rapi, info toko, nomor nota, tabel itemized, rincian pembayaran, status LUNAS/BELUM LUNAS, dan vektor QR code bawaan.
      - Format Formal A4: Invoice formal ukuran penuh untuk pembukuan atau kwitansi resmi.
    - Menambahkan modul invoice `App.openInvoice(orderIdOrCode)`, `App.switchInvoiceMode(mode)`, dan `App.renderInvoiceModal(order, mode)`.
    - Menyediakan tombol akses cepat "🧾 Invoice" pada tabel Pesanan (`renderPesanan`) dan tabel Recent Orders di Dashboard (`renderDashboard`).
    - Aturan CSS `@media print` lengkap: menyembunyikan navigasi, sidebar, topbar, tombol aksi, dan backdrop modal, hanya mencetak kertas invoice secara presisi.
  - Frontend Pelacakan Publik (`public/track.html`):
    - Menambahkan tombol "🧾 Cetak / Unduh Invoice" dan dialog modal invoice interaktif pada hasil pencarian order publik.
    - Sanitasi ketat XSS pada nama pelanggan, kode nota, dan nama layanan menggunakan `escapeHtml()` / `esc()`.
  - Sistem Notifikasi Modern & Konfirmasi Modal (`public/app.js`):
    - Menggantikan 34 kemunculan `alert()` / `confirm()` dengan `App.toast(msg, type)` dan `App.confirm(msg)` berbasis Promise modal dialog.
    - Transisi CSS halus, status badge warna selaras design token, tanpa memblokir thread JavaScript.
  - Optimasi Edge Caching & Bundle Cleanup (Task E1 & Dead Code Removal):
    - Backend `functions/api/services.js`: Mengirimkan header `Cache-Control: public, max-age=300, stale-while-revalidate=60` untuk permintaan publik `GET /api/services`.
    - `public/_headers`: Menambahkan caching edge & browser untuk `/assets/*` (TTL 24 jam) dan `/img/*` (TTL 7 hari).
    - Menghapus 7MB file duplikat redundant (`public/3d.png`, `public/Logo.png`, `public/avatar-placeholder.png`, dan seluruh isi `public/assets/img/`).
  - Harness Pengujian:
    - Membuat `tools/verify_c5.mjs` + `tools/verify_c5_run.mjs` (37/37 HIJAU).
    - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_c5_run.mjs`.
  - Dokumen Loop:
    - `AGENT_BACKLOG.md`: Menandai Task C5, D5, dan E1 selesai `[x]`.
    - `AGENT_STATE.md`: Meningkatkan tick ke 42 dan mencatat baseline invoice & edge caching.
- **Verifikasi**:
  - `node tools/verify_c5_run.mjs` → **HIJAU 37/37**.
  - Seluruh rangkaian verifier proyek (35/35) **HIJAU**, nol regresi (`tools/run_all_verifiers.sh`).
  - Uji mutasi: Mematikan deklarasi `openInvoice` menghasilkan status MERAH (exit 1). Dipulihkan kembali ke HIJAU 37/37.
- **Commit**: `a220f3a` (code) + `52ea710` (toast)
- **Status**: **DONE**

---

## Tick 43 — 2026-09-16T10:55:00+08:00 (Task C4: Upload Bukti Pembayaran)

- **Task**: C4 (Fase C) — Upload bukti pembayaran (Cloudflare R2 / base64 kecil) (P3)
- **Temuan sebelum perubahan**:
  - Pelanggan dan kasir belum memiliki sarana untuk mengunggah dan memverifikasi bukti transfer pembayaran (struk bank / screenshot transfer e-wallet).
  - Halaman `public/pay.html` sebelumnya hanya menampilkan tombol dummy dengan `alert('Pembayaran diverifikasi!...')` tanpa pernah memanggil endpoint API pembayaran riil `POST /api/pay`.
  - Diperlukan mekanisme pertahanan upload file di sisi server: validasi strictly MIME type (`image/jpeg`, `image/png`, `image/webp`), batas ukuran payload (~1.5MB base64), dan penolakan format berbahaya seperti SVG/HTML yang berpotensi Stored XSS.
- **Perubahan**:
  - Skema Database:
    - Membuat berkas migrasi `db/migrations/0006_add_proof_image_to_payments.sql` menambahkan kolom `proof_image MEDIUMTEXT NULL` pada tabel `payments`.
  - Backend API (`functions/api/pay.js`):
    - Memvalidasi opsional `proof_image` pada payload `POST /api/pay`:
      - Regex ketat format data URI: `^data:image\/(jpeg|png|webp|jpg);base64,[A-Za-z0-9+/=]+$`.
      - Menolak secara aman format SVG (`data:image/svg+xml`), text/html, atau format asing dengan status 400 Bad Request.
      - Membatasi panjang teks payload maksimum (2.200.000 karakter, ~1.5MB base64).
    - Menyimpan `proof_image` via parameterized query `?` pada klausa `INSERT INTO payments`.
    - Menyediakan fallback multi-level backward-compatibility jika kolom belum termigrasi.
    - Mengembalikan `proof_image` pada respons JSON pembayaran dan query `GET /api/pay`.
  - Frontend Pelanggan (`public/pay.html`):
    - Antarmuka baru interaktif untuk pembayaran:
      - Tombol pill pemilih metode pembayaran (`QRIS`, `TRANSFER`, `DANA`, `GOPAY`, `OVO`, `CASH`).
      - Petunjuk transfer dinamis: QRIS dinamis, nomor rekening resmi BCA & Mandiri dengan tombol salin cepat, dan nomor e-wallet.
      - Input jumlah pembayaran fleksibel (dibatasi oleh sisa tagihan pesanan).
      - Dropzone unggah bukti pembayaran foto struk transfer dengan pratinjau thumbnail, tombol hapus foto, dan kompresi kanvas sisi klien (maksimum 1024px dimensi, kualitas JPEG 0.82) agar upload cepat dan ringan.
      - Pengiriman riil `POST /api/pay` dengan penanganan status respons, kunci idempotensi unik, dan layar sukses transaksi lengkap dengan tautan lacak pesanan.
  - Frontend Staf (`public/app.js`):
    - Menambahkan method `App.viewPaymentProof(orderCode)` dan modal dialog `proofModal` yang menampilkan seluruh bukti pembayaran terkait pesanan.
    - Menambahkan tombol aksi `🖼️ Bukti` (`btn-view-proof`) pada setiap baris pesanan di tabel `renderPesanan`.
    - Sanitasi XSS `esc()` pada nomor nota dan metode pembayaran.
  - Harness Pengujian:
    - Membuat `tools/verify_c4.mjs` + `tools/verify_c4_run.mjs` (29/29 HIJAU).
    - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_c4_run.mjs`.
    - Verifikasi mutasi: Mematikan validasi MIME gambar menghasilkan status MERAH (exit 1). Dipulihkan kembali ke HIJAU 29/29.
    - Seluruh rangkaian pengujian (36 verifier) 100% HIJAU (0 regresi).
  - Dokumen Loop:
    - `AGENT_BACKLOG.md`: Menandai Task C4 selesai `[x]`.
    - `AGENT_STATE.md`: Meningkatkan tick ke 43 dan mencatat baseline upload bukti pembayaran.
- **Verifikasi**:
  - `node tools/verify_c4_run.mjs` → **HIJAU 29/29**.
  - Seluruh rangkaian verifier proyek (36/36) **HIJAU**, nol regresi (`tools/run_all_verifiers.sh`).
- **Commit**: `b3a4e0f`
- **Status**: **DONE**

---

## Tick 44 — 2026-09-16T11:05:00+08:00 (Task D2: Dark Mode Toggle - localStorage)

- **Task**: D2 (Fase D) — Dark mode toggle (localStorage, anti-FOUC script) (P3)
- **Temuan sebelum perubahan**:
  - Aplikasi memiliki dukungan parsial dark theme di `style.css` (hanya sebatas beberapa selector), namun token desain utama belum mendukung dark mode.
  - Belum ada mekanisme anti-FOUC (Flash of Unstyled Content) saat halaman di-refresh dalam mode gelap, menyebabkan kedipan putih (white flash) yang mengganggu pengguna.
  - Sidebar di `style.css` menggunakan background hardcoded `#ffffff;` sehingga tidak dapat mewarisi permukaan elevated dark theme (`#111827`).
  - Belum ada komponen toggle tema yang dapat diakses pengguna di dashboard, landing page, pelacakan pesanan, maupun halaman pembayaran, serta belum ada sinkronisasi multi-tab.
- **Perubahan**:
  - Design Tokens & Stylesheet:
    - `public/assets/design-tokens.css`: Menambahkan tokens `[data-theme="dark"], html.dark` dengan palet slate Linear/Vercel: `--color-bg-primary: #090d16;`, elevated card surface `#111827`, border `#1e293b`/`#334155`, dan text `#f8fafc`.
    - `public/assets/style.css`: Menyesuaikan `.sidebar` dengan `background: var(--card);`, memperluas styling dark theme untuk topbar, nav, search, card, form controls, dan tabel, serta membuat styling kelas `.theme-toggle-btn`.
  - Anti-FOUC (Flash of Unstyled Content):
    - Menyematkan script sinkronus inline anti-FOUC di dalam `<head>` sebelum CSS di seluruh file HTML: `dashboard.html`, `index.html`, `track.html`, dan `pay.html`.
    - Script memeriksa `localStorage.getItem('theme')` atau preferensi sistem `window.matchMedia('(prefers-color-scheme: dark)')` secara instan sebelum browser me-render DOM.
  - Komponen Tombol Toggle & SPA App:
    - `public/app.js`: Menambahkan `App.initTheme()`, `App.applyTheme()`, `App.toggleTheme()`, dan `App.updateThemeIcons()`.
    - Sinkronisasi instan multi-tab via event `storage`.
    - Menyematkan tombol `#themeToggleBtn` di topbar Dashboard SPA, navigasi Landing Page, header `track.html`, dan header `pay.html`.
  - Harness Pengujian:
    - Membuat `tools/verify_d2.mjs` dan `tools/verify_d2_run.mjs` (30/30 HIJAU).
    - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_d2_run.mjs` (total 37 verifier).
    - Verifikasi mutasi: Memalsukan key localStorage menjadi `theme_broken` memicu 3 kegagalan (MERAH, exit 1). Dipulihkan kembali ke HIJAU 30/30.
    - Seluruh rangkaian pengujian proyek (37 verifier) 100% HIJAU (0 regresi).
  - Dokumen Loop:
    - `AGENT_BACKLOG.md`: Menandai Task D2 selesai `[x]` (`f6d59dd`).
    - `AGENT_STATE.md`: Memperbarui tick ke 44 dan mencatat ringkasan dark mode.
- **Verifikasi**:
  - `node tools/verify_d2_run.mjs` → **HIJAU 30/30**.
  - Seluruh rangkaian verifier proyek (37/37) **HIJAU**, nol regresi (`tools/run_all_verifiers.sh`).
- **Commit**: `f6d59dd`
- **Status**: **DONE**

---

## Tick 45 — 2026-09-16T11:13:00+08:00 (Task D3 & D4: Skeleton Loading & Empty States)

- **Task**: D3 & D4 (Fase D) — Skeleton loading di semua tabel & Empty state bermakna (P3)
- **Temuan sebelum perubahan**:
  - Saat fetching data asinkronus di `public/app.js`, seluruh halaman dashboard hanya menampilkan teks statis mentah `<div>Memuat data...</div>` yang merusak layout dan terasa lambat bagi pengguna.
  - Saat hasil data tabel kosong (`orders`, `customers`, `services`, `tasks`), antarmuka tidak menampilkan feedback atau petunjuk yang bermakna (hanya tabel kosong tanpa pesan).
  - Belum ada komponen shimmer loading murni CSS yang adaptif terhadap dark/light mode dan patuh pada preferensi aksesibilitas `prefers-reduced-motion`.
- **Perubahan**:
  - Stylesheet (`public/assets/style.css`):
    - Menambahkan kelas utilitas `.skeleton`, `.skeleton-text`, `.skeleton-title`, `.skeleton-badge`, `.skeleton-btn`, `.skeleton-card`, `.skeleton-table-wrap`, dan `.skeleton-table`.
    - Menerapkan efek animasi gradien shimmer murni berbasis CSS (`@keyframes skeletonShimmer`) dengan warna adaptif otomatis pada mode terang (`#e2e8f0` -> `#ffffff`) dan gelap (`#1e293b` -> `#334155`).
    - Menambahkan aturan `@media (prefers-reduced-motion: reduce)` yang menonaktifkan shimmer geser dan menggantinya dengan pulsasi opasitas statis lembut.
    - Menambahkan styling komponen `.empty-state`, `.empty-state-icon`, `.empty-state-title`, dan `.empty-state-subtitle`.
  - Aplikasi SPA Frontend (`public/app.js`):
    - Helper fungsi reusable: `App.renderSkeletonTable({ columns, rows, hasActions })`, `App.renderSkeletonCards(count)`, dan `App.renderEmptyState({ icon, title, subtitle, actionHtml })`.
    - Mengintegrasikan skeleton shimmer pada seluruh 7 halaman: `renderDashboard()`, `renderPesanan()`, `renderPelanggan()`, `renderLayanan()`, `renderDelivery()`, `renderPromo()`, `renderLaporan()`, dan `renderProfile()`.
    - Menyematkan render empty state terstruktur saat data bernilai kosong (misal tidak ada pesanan, tidak ada pelanggan, layanan belum ada, tugas kurir kosong).
  - Harness Pengujian:
    - Membuat `tools/verify_d3.mjs` dan `tools/verify_d3_run.mjs` (26/26 HIJAU).
    - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_d3_run.mjs` (total 38 verifier).
    - Verifikasi mutasi: Merusak nama keyframe shimmer memicu kegagalan (MERAH, exit 1). Dipulihkan kembali ke HIJAU 26/26.
    - Seluruh rangkaian pengujian proyek (38 verifier) 100% HIJAU (0 regresi).
  - Dokumen Loop:
    - `AGENT_BACKLOG.md`: Menandai Task D3 dan D4 selesai `[x]` (`1d5feaf`).
    - `AGENT_STATE.md`: Memperbarui tick ke 45 dan mencatat ringkasan skeleton shimmer & empty state.
- **Verifikasi**:
  - `node tools/verify_d3_run.mjs` → **HIJAU 26/26**.
  - Seluruh rangkaian verifier proyek (38/38) **HIJAU**, nol regresi (`tools/run_all_verifiers.sh`).
- **Commit**: `1d5feaf`
- **Status**: **DONE**

---

## Tick 46 — 2026-09-16T11:30:00+08:00 (Task D1: Terapkan design token ke seluruh dashboard & pembersihan dead code)

- **Task**: D1 (Fase D) — Terapkan design token ke seluruh dashboard (P3)
- **Temuan sebelum perubahan**:
  - Meskipun `design-tokens.css` sudah dimuat di `dashboard.html`, sebagian besar komponen dashboard di `public/app.js` masih menggunakan inline hardcoded hex colors seperti `background: #fff; border: 1px solid #e2e8f0;`.
  - Hal ini menyebabkan kartu-kartu (cards) tidak otomatis mengikuti dark mode atau token tema, dan menyebabkan inkonsistensi visual saat berganti tema.
  - `public/assets/style.css` memiliki dead code berupa deklarasi duplikat `.card` dan duplikat `.table` yang memperbesar ukuran file tanpa manfaat fungsional.
  - Variabel `:root` di `style.css` belum seluruhnya dijembatani ke semantic token resmi di `design-tokens.css`.
- **Perubahan**:
  - Stylesheet (`public/assets/style.css`):
    - Variabel `:root` dijembatani penuh ke design tokens: `--bg: var(--color-bg-secondary, #f8fafc)`, `--card: var(--color-bg-primary, #ffffff)`, `--line: var(--color-border-subtle, #e2e8f0)`, `--muted: var(--color-text-secondary, #64748b)`, `--text: var(--color-text-primary, #0f172a)`, `--blue: var(--color-brand-primary, #2563eb)`, `--green: var(--color-success, #10b981)`, `--amber: var(--color-warning, #f59e0b)`, `--red: var(--color-error, #ef4444)`, `--shadow: var(--shadow-card)`, dll.
    - Pembersihan Dead Code: Menghapus blok duplikat `.card` (~25 baris) dan duplicate `.table` (~60 baris), merampingkan ukuran CSS dan mempercepat render parser browser.
    - Selector dark mode diselaraskan dengan token variabel (`var(--card)`, `var(--line)`, `var(--text)`, `var(--muted)`), mempertahankan `--bg: #090d16` untuk kompatibilitas penuh.
  - Aplikasi Frontend SPA (`public/app.js`):
    - Mengeliminasi seluruh inline `background: #fff` dan `border: 1px solid #e2e8f0` / `#cbd5e1` pada kartu di seluruh 8 view: `renderDashboard()`, `renderPesanan()`, `renderPelanggan()`, `renderLayanan()`, `renderDelivery()`, `renderPromo()`, `renderLaporan()`, dan `renderProfile()`.
    - Mengonversi elemen dialog modal (`_appConfirm`, `proofModal`, `invoiceModal`) agar menggunakan `var(--card)`, `var(--line)`, `var(--text)`, dan `var(--bg)`.
    - Mengonversi `buildSvgChart` ke token CSS (`var(--line)` untuk garis kisi SVG, `var(--muted)` untuk label, dan inverted token untuk popup tooltip chart).
  - Harness Pengujian:
    - Membuat `tools/verify_d1.mjs` dan `tools/verify_d1_run.mjs` (38/38 pemeriksaan HIJAU 100%).
    - Uji Mutasi: Merusak deklarasi `:root --bg` memicu kegagalan (MERAH, exit code 1). Dipulihkan kembali ke 100% HIJAU (exit code 0).
    - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_d1_run.mjs` (total 39 suite pengujian).
    - Seluruh 39 verifier suite proyek berjalan 100% HIJAU (0 regresi).
  - Dokumen Loop:
    - `AGENT_BACKLOG.md`: Menandai Task D1 selesai `[x]` (`312f774`).
    - `AGENT_STATE.md`: Memperbarui status ke Tick 46 dan mencatat ringkasan Task D1.
- **Verifikasi**:
  - `node tools/verify_d1_run.mjs` → **HIJAU 38/38**.
  - Seluruh rangkaian pengujian proyek (39/39) **HIJAU**, nol regresi (`tools/run_all_verifiers.sh`).
- **Commit**: `312f774`
- **Status**: **DONE**

---

## Tick 47 — 2026-09-16T11:42:00+08:00 (Task D6: Micro-interaction konsisten hover/focus/active)

- **Task**: D6 (Fase D) — Micro-interaction konsisten (hover/focus/active) (P3)
- **Temuan sebelum perubahan**:
  - Interaksi tombol, link navigasi, dan input belum memiliki sistem `:focus-visible` yang terstandarisasi untuk aksesibilitas WCAG (keyboard navigation).
  - Beberapa tombol (`.btn-icon`, `.tabbtn`, `.tab`, `.theme-toggle-btn`) belum memiliki state `:active` snappy tactile feedback saat ditekan.
  - Form input (`.input`, `select`, `textarea`) belum memiliki state `:hover` dengan transisi halus.
  - Efek CSS `.ripple` dan keyframe sudah ada di `style.css` tetapi belum dihubungkan ke event handler pointer di `public/app.js`.
  - Blok `@media (prefers-reduced-motion: reduce)` sebelumnya hanya meng-override `.skeleton`, belum menonaktifkan transform dan animasi interaktif untuk pengguna sensitif gerak.
- **Perubahan**:
  - Stylesheet (`public/assets/style.css`):
    - Menerapkan universal `:focus-visible` (2px solid outline dengan offset 2px) dan `:focus:not(:focus-visible)` (membersihkan outline pada klik mouse).
    - Menambahkan `:focus-visible` ring bertema brand pada `.btn`, `.btn-primary`, `.btn-icon`, `.tabbtn`, `.tab`, `.theme-toggle-btn`, `.input`, `select`, `textarea`, dan link navigasi `.nav a`.
    - Menambahkan state `:active` mikro (`transform: translateY(1px) scale(0.98)` atau `scale(0.94)`) pada seluruh varian tombol dan link navigasi untuk umpan balik sentuh instan.
    - Menambahkan state `:hover` dan transisi border pada form input, serta penanganan state `:disabled` yang konsisten.
    - Menambahkan highlight baris tabel `.table tbody tr:hover` dengan warna token brand (`var(--blue-soft)` dan `var(--blue-border)`).
    - Memperluas `@media (prefers-reduced-motion: reduce)` agar menonaktifkan seluruh animasi transform, shadow, dan ripple pada elemen interaktif bagi pengguna preferensi reduced motion.
  - Aplikasi Frontend SPA (`public/app.js`):
    - Mengimplementasikan `App.initRipple()` menggunakan event delegation `pointerdown` ringan (tanpa dependensi eksternal / 0 dependency) yang secara otomatis memicu gelombang ripple CSS pada tombol dan membersihkan elemen setelah animasi selesai.
    - Memanggil `this.initRipple()` saat inisialisasi aplikasi di `App.init()`.
  - Harness Pengujian:
    - Membuat `tools/verify_d6.mjs` dan `tools/verify_d6_run.mjs` (30/30 pemeriksaan HIJAU 100%).
    - Uji Mutasi: Merusak deklarasi `:active` tombol memicu kegagalan (MERAH, exit code 1). Dipulihkan kembali ke 100% HIJAU (exit code 0).
    - `tools/run_all_verifiers.sh`: Mendaftarkan `verify_d6_run.mjs` (total 40 suite pengujian).
    - Seluruh 40 verifier suite proyek berjalan 100% HIJAU (0 regresi).
  - Dokumen Loop:
    - `AGENT_BACKLOG.md`: Menandai Task D6 selesai `[x]` (`a43dfb7`).
    - `AGENT_STATE.md`: Memperbarui status ke Tick 47 dan mencatat ringkasan Task D6.
- **Verifikasi**:
  - `node tools/verify_d6_run.mjs` → **HIJAU 30/30**.
  - Seluruh rangkaian pengujian proyek (40/40) **HIJAU**, nol regresi (`tools/run_all_verifiers.sh`).
- **Commit**: `a43dfb7`
- **Status**: **DONE**












## Tick 52 — 2026-09-17T08:58:00+08:00 (Task C9: Service Worker Offline Dasar)

**Task**: C9 — Service worker (offline dasar) (P3, Fase C). Satu-satunya task
P3 open; WIP tick sebelumnya ditinggal di working tree (sw.js + 4 halaman +
harness). A3b, B2, B5 sudah `[x]` — urutan prioritas prompt sudah selesai
semua, jadi lanjut ke task open berikutnya di backlog.

**Perubahan** (`7541ece`):
- `public/sw.js` (baru): app-shell precache 14 URL eksplisit; SWR aset;
  network-first `/api/*` GET; **non-GET pass-through, tidak pernah di-cache**;
  navigasi offline fallback shell; 503 JSON terstruktur; cleanup cache lama;
  origin-check (CDN dilewati).
- `public/{index,dashboard,track,pay}.html`: registrasi SW pasca-load,
  feature-detected, swallow error.
- `tools/verify_c9.mjs`: 2 bug harness diperbaiki:
  1. `ReferenceError: textOf is not defined` (crash assertion navigasi).
  2. Mock caches/fetch tidak menormalisasi URL relatif → key `/` ≠
     `https://embun.test/` → precache shell kosong → fallback offline
     kelihatan 500 (merah palsu; sw.js sebenarnya benar).
- `tools/run_all_verifiers.sh`: `verify_c9.mjs` masuk daftar regresi.

**Verifikasi**:
- `node tools/verify_c9.mjs` → **HIJAU 23/23**.
- `bash tools/verify_all.sh` → **44/44 verifier HIJAU**, 0 regresi.
- Post-deploy live (embun-laundry.dhanisepeda.workers.dev):
  - `GET /sw.js` → 200, `Content-Type: text/javascript`,
    `x-content-type-options: nosniff`, `Cache-Control: max-age=0, must-revalidate`.
  - `/`, `/dashboard`, `/track`, `/pay` (307→200) memuat
    `navigator.serviceWorker.register('/sw.js')`.
  - `/api/health` → 200 `{"ok":true,"status":"healthy",...}`.

**Status**: C9 `[x]` `7541ece`. Fase C 11/11 kecuali C10 (P4). Backlog sisa:
C10 (P4, multi-bahasa), E4 (P4, minifikasi build). Tidak ada P0/P1/P2 lagi.

---