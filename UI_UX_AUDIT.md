# AUDIT UI/UX MENYELURUH — EMBUN LAUNDRY (Frontend `public/`)

**Tanggal:** 2026-09-17 · **Scope:** `public/index.html`, `public/dashboard.html`, `public/app.js`, `public/pay.html`, `public/track.html`, `public/auth/*.html`, `public/assets/{design-tokens.css, style.css, escape.js, hero-canvas.js}`, `public/sw.js`
**Mode:** Audit saja — **tidak ada satu baris pun diubah.**
**Severity:** 🔴 Kritis (fungsi/keamanan rusak) · 🟠 Besar (UX rusak secara nyata) · 🟡 Sedang · 🔵 Kecil (pemolesan)

**Ringkasan eksekutif:** Fondasi UI kuat (design-token, dark mode, skeleton, empty state, toast, SW, print CSS, a11y dasar). Namun ada **2 bug status-badge yang merusak tampilan di semua halaman dashboard**, **ratusan baris dead-code promo**, **~7 token CSS tak terdefinisi**, **2 dead link**, serta **konsistensi ARIA yang longgar**.

---

## 1. KEKURANGAN (diprioritaskan berdasarkan severity)

### 🔴 Kritis

**K1. Badge status pesanan tidak pernah mendapat warna — class CSS tidak ada**
- Lokasi: `public/app.js:1299`, `1428`, `1649` → `<span class="badge status-${esc(o.status)}">` · `public/assets/style.css` (definisi `.status-baru/.status-proses/.status-selesai/.status-batal` **tidak ada**)
- Bukti: `grep -n "\.status-baru|\.status-proses|\.status-selesai|\.status-batal" assets/style.css` → **0 hasil**.
- Dampak: SEMUA badge status di Dashboard, Pesanan, dan Delivery render sebagai badge transparan tak terwarnai — indikator status paling penting di app laundry tampak identik satu sama lain. `.bd-*` yang ada (mis. `.bd-green`, `.bd-blue`) juga tidak pernah dipakai oleh app.js.
- Severity: Kritis. **Ini bug tampilan paling terlihat di seluruh dashboard.**

**K2. Dua definisi `esc()` yang saling membayangi**
- Lokasi: `public/app.js:2` (`const esc = s => …`) vs `public/assets/escape.js:51` (`function esc(value)`)
- Dampak: `escape.js` dimuat **setelah** `app.js` di `dashboard.html:108-109` (escape.js menimpa `window.esc` global, tapi app.js memakai binding `const` modulnya sendiri). Hasil: dua implementasi berbeda untuk tujuan yang sama — tepat anti-pattern yang `escape.js`-komentar coba cegah ("tidak ada tiga salinan yang bisa menyimpang"). Jika salah satu berubah (mis. escape literal `\``), bug sulit ditelusuri. Catatan: regex `escape.js` (`/[&<>"']/`) berbeda secara fungsional dari versi `app.js` untuk karakter non-ASCII; keduanya aman untuk konteks yang ada, tapi duplikat.
- Severity: Kritis (pemeliharaan + potensi perbedaan perilaku diam-diam). Hapus satu.

**K3. `window.onload` diduplikasi — init mungkin dieksekusi dua kali**
- Lokasi: `public/app.js:2505` (`window.onload = () => App.init();`) + `public/dashboard.html:112-116` (`window.onload = () => { if (window.App…) App.init(); }`)
- Dampak: `app.js` menetapkan `window.onload`, lalu `dashboard.html` **menimpanya**. Karena `<script src="/app.js">` berjalan sebelum inline script dashboard, handler kedua menggantikan handler pertama — `App.init()` akhirnya berjalan sekali. Namun urutan rapuh: jika dashboard.html di-cache/lama dimuat ulang, init bisa ganda atau lompat. Guard anti-double-init hanya pada `_rippleInitialized`/`_sidebarInitialized`, bukan pada `init()` sendiri. Juga, jika `App.init()` melempar sebelum selesai (mis. `checkAuth` gagal sinkron), UI terhenti tanpa umpan balik.
- Severity: Kritis (rapuh, diam-diam).

**K4. Dead link "Lupa Password?" → 404**
- Lokasi: `public/auth/login.html:208` → `<a class="link" href="lupasandi.html">`
- Bukti: `ls public/auth/` → hanya `login.html`, `register.html`. Tidak ada `lupasandi.html`.
- Dampak: Pelanggan/kasir yang lupa sandi mengklik tautan resmi → halaman 404. Ini satu-satunya jalur pemulihan akun — dead end fungsional.
- Severity: Kritis.

---

### 🟠 Besar

**B1. ~230 baris dead-code handler untuk elemen yang tidak pernah dirender**
- Lokasi: `public/app.js:873-1007` (handler `openNewPromoModal`, `closePromoModalBtn`, `btn-edit-promo`, `btn-del-promo`, `btn-toggle-promo`, `openGrantVoucherModal`, `closeGrantVoucherModalBtn`, `btn-del-voucher`, `tabBtnPromos`, `tabBtnVouchers`, `btnSearchPromo`) dan `public/app.js:1101-1186` (`submit` untuk `promoForm` & `grantVoucherForm`).
- Bukti: HTML promo di `app.js:1686-1904` tidak memuat `id="promoForm"`, `promoId`, `promoCode`, `promoModal`, `grantVoucherModal`, `tabBtnPromos`, `promoSearchInput`. Versi inline (`openPromoForm/savePromo/grantVoucher` di `app.js:1910-2091`) telah menggantinya. Handler lama ini tidak pernah membakar kecuali markup lama somehow dirender.
- Dampak: ~230 baris kode yang tidak dapat dicapai. `document.getElementById('…')` dalam handler ini mengembalikan `null` dan diam-diam no-op (beberapa diawali `try{}catch{}` kosong di `app.js:909`). Membuat debugging alur promo sangat membingungkan.
- Severity: Besar (pemeliharaan). Hapus atau jadikan no-op eksplisit.

**B2. Class CSS tak terpakai — ratusan baris ghost CSS**
- Lokasi: `public/assets/style.css` — class didefinisi, tidak pernah dipakai di HTML/JS: `.kanban`, `.kcol`, `.kcard`, `.kdrop`, `.kpis`, `.kpi`, `.blob`, `.b-*`, `.confetti`, `.fx-orbs`, `.user-menu`, `.avatar-img`, `.tabbtn`, `.panels`, `.search`, `.user`, `.sb-foot`, `.footer-space`, `.item`, `.grid2`, `.controls`, `.chart`, `.cards`, `.sheet` (versi modal style.css), `.modal` (versi style.css — index.html punya `.modal` inline sendiri), `.toggle`/`.knob` (versi pill — konflik nama dengan `.toggle` password-toggle di register.html!), `.bd-*` (kebanyakan), `.wiggle`, `.list`, `.voucher`.
- Bukti: `grep -c "kanban|kcard|confetti|fx-orbs|user-menu|avatar-img|tabbtn|kpis" app.js index.html pay.html track.html` → 0 untuk hampir semua.
- Dampak: style.css 47KB/2036 baris padat ~60% CSS mati. Memperlambat parse + membingungkan siapa pun yang mengedit CSS. Juga **konflik nama**: `.toggle` didefinisikan dua makna (pill switch di style.css:1556 vs password eye-toggle di register.html:120) — untuk saat ini mereka berada di dokumen berbeda, tapi ini bom waktu.
- Severity: Besar.

**B3. Token CSS tak terdefinisi — beberapa elemen tidak terlihat / tanpa warna**
- Lokasi & token hilang:
  | Token | Pakai di | Dampak |
  |---|---|---|
  | `var(--primary)` | `index.html:1644` (`#modalPollInd` "● Live") | warna inherit — tak terwarnai |
  | `var(--color-primary)` | `track.html:385` (`#poll-indicator`) | sama |
  | `var(--bg-surface)` | `index.html:1486` (item notifikasi) | background transparan |
  | `var(--border-color)` | `index.html:1641` | border hilang |
  | `var(--text-small)` | `track.html:465,469` | `font-size` invalid → ukuran default |
  | `var(--color-surface-subtle)` | `track.html:469` | background hilang |
- Bukti: `grep -n "…--primary:|--bg-surface:|--border-color:|--text-small:|--color-surface-subtle:|--bg-surface-subtle:" assets/design-tokens.css assets/style.css` → **NO DEFS**.
- Severity: Besar (visual terlihat pada notifikasi tracking & indikator polling live).

**B4. Hardcoded warna di pay.html & track.html — melanggar aturan "tidak ada hardcoded color"**
- Lokasi: `public/pay.html` (19 tempat, mis. `#2563eb`, `#f8fafc`, `#cbd5e1`, `#0f172a` di lapisan sukses), `public/track.html` (17 tempat pada inline invoice modal), `public/auth/login.html` (3), `public/auth/register.html` (3), `public/index.html` (5).
- Dampak: invoice & pay page tidak mengikuti token → di dark mode, lapisan sukses/kartu invoice tetap putih kontras (invoice sengaja, tapi area UI umum pay.html tidak). Komentar `track.html:10` sendiri menyatakan "tidak ada hardcoded color" tapi kemudian melanggar di invoice modal — inkonsisten.
- Severity: Besar (dark mode rusak parsial).

**B5. Halaman auth tanpa dark mode**
- Lokasi: `public/auth/login.html`, `public/auth/register.html` — tidak ada bootstrap tema, tidak ada `data-theme`, tidak ada `themeToggleBtn`.
- Dampak: Pelanggan yang sudah memilih dark mode (sinkron lintas tab via `storage event` di `app.js:28`) mendarat di halaman login/register putih menyilaukan. Inkonsistensi premium feel.
- Severity: Besar.

**B6. Login.html: efek ripple tanpa CSS ripple**
- Lokasi: `public/auth/login.html:238-250` — JS membuat `<span class="ripple">`, tapi blok `<style>` login.html **tidak memiliki aturan `.ripple`** (register.html punya di baris 166).
- Dampak: Lingkaran ripple tak terlihat; user melihat riak "bocor" saat klik tombol login. Register OK, login rusak — inkonsisten.
- Severity: Besar (pemolesan, tapi terlihat jelas).

**B7. `.btn-sm` tidak ada di style.css, tapi dipakai di app.js**
- Lokasi: `public/app.js:380,384,391,394` (`class="btn btn-sm"`) · `public/assets/style.css` → 0 definisi `.btn-sm`.
- Dampak: Tombol toolbar invoice (Struk/A4/Cetak) hanya menyerap padding `.btn` dasar (10px 18px) — terlalu besar untuk toolbar modal, terutama pada mobile.
- Severity: Sedang→Besar (modal invoice terasa kasar).

**B8. Global `error` boundary menghancurkan UI pada kesalahan kecil**
- Lokasi: `public/app.js:2508-2518` (`window.addEventListener('error', …) → App.renderError(msg)`)
- Dampak: Setiap JS error takterka tangkap (mis. ekstensi browser, error analytics pihak ketiga, atau kesalahan kecil di handler non-fatal) langsung mengganti seluruh `#mainContent` dengan layar error merah — termasuk saat user sedang mengisi form (input hilang). Tidak ada rate-limit / filter. `renderError` pun tombol "Coba Lagi" memanggil `App.renderPage(App.currentPage)` — bagus, tapi tidak me-reset state error.
- Severity: Besar (resiko UX nyata).

**B9. Ganti status pesanan tanpa konfirmasi, tanpa loading, tanpa toast**
- Lokasi: `public/app.js:1011-1020` (`change` → `status-select`)
- Dampak: Staf mengubah dropdown status → POST dikirim, **tidak ada indikator loading, tidak ada toast sukses/gagal, tidak ada rollback saat gagal**. Jika network gagal, dropdown tetap menunjukkan status baru tapi DB tidak terupdate — divergen secara diam-diam. Bandingkan dengan hapus pesanan (`app.js:860-870`) yang juga tanpa toast pasca-sukses.
- Severity: Besar (data integrity perception).

**B10. Quick-order modal di landing: tombol "Lanjutkan" tidak membawa konteks**
- Lokasi: `public/index.html:1406-1415` (`btnGo`)
- Dampak: User pilih layanan + berat + promo aktif → klik "Lanjutkan" → hanya `window.location = '/dashboard.html'` (atau `/auth/register.html` jika belum login). **Pilihan layanan/berat/promo hilang.** Dashboard harusnya membuka form pesanan dengan prefilled. Saat ini Quick Order adalah wizard dengan langkah tunggal yang membuang inputnya sendiri.
- Severity: Besar (broken funnel conversion).

**B11. `btn-copy-code` handler ada, tapi markup pakai inline `onclick`**
- Lokasi: handler `app.js:997-1007` (class `.btn-copy-code`) tidak pernah dipakai; markup voucher (`app.js:1865,1895`) memakai `onclick="navigator.clipboard.writeText(...)"` inline.
- Dampak: Dead handler lagi. Juga inline `onclick` dengan interpolasi string adalah pola yang lebih rapuh dari event-delegation.
- Severity: Sedang.

---

### 🟡 Sedang

**S1. Halaman dashboard statis (`dashboard.html`) vs render ulang app.js (`renderApp`) — sinkronisasi dua sumber**
- `dashboard.html` berisi sidebar/topbar statis (nav berisi "Pelanggan", "Pickup & Delivery", "Laporan" untuk semua role) — tapi `App.renderApp()` (`app.js:731-803`) membangun versi yang benar secara role-aware (`isStaff` gate). Saat `checkAuth` sukses, seluruh `<body>` diganti → versi statis hanya tampil selama transit "Memuat…". Ini desain yang OK, tapi duplikasi 70 baris markup sidebar rawan drift.
- Severity: Sedang.

**S2. ARIA longgar pada komponen interaktif**
- `aria-pressed` / `aria-expanded` **digunakan 0 kali** di seluruh `public/` (hasil grep: 0). Padahal ada toggle tema, toggle sidebar mobile, toggle promo (`btnPromo`), toggle mode invoice (thermal/A4), tab kategori (`role="tablist"` ada di index.html:1029 tapi tidak ada `aria-selected` sinkronisasi keyboard, meskipun `aria-selected` diatur via JS — sudah benar untuk pills; tab panah keyboard tidak ditangani).
- Modal `confirm()` (`app.js:292-316`) tidak menangkap fokus / tidak trap focus. Modal invoice (`invoiceModal`, `proofModal`) tidak punya `aria-modal`/`role="dialog"`; tombol ✕-nya tidak punya `aria-label` (hanya karakter "✕" pada `app.js:394`).
- `track.html` label stepper aria-hidden OK.
- Severity: Sedang (a11y).

**S3. Stepper tracking: label vs jumlah langkah tidak cocok**
- `public/track.html:362-364` label = `Diterima / Dicuci / Selesai` (3), `steps` = 3 bar (`s1..s3`), tapi logika (`track.html:483-486`, `531-534`) memetakan **status** `['baru','proses','selesai']` ke indeks 0/1/2 → "Dicuci" menyala saat status = "proses". Ambiguitas: apakah "Dicuci" = proses? Sedangkan stepper modal di index.html (`track-step`) pakai 3 langkah dengan label eksplisit + garis. Dua representasi berbeda untuk hal yang sama.
- Severity: Sedang.

**S4. `App.confirm()` tombol "Hapus" merah untuk semua aksi**
- `app.js:307`: tombol konfirmasi selalu berlabel "Hapus" dan berwarna merah, bahkan saat dipakai untuk cabut voucher (`deleteVoucher` → "Cabut voucher ini?"). Aksi non-destruktif terlihat destruktif.
- Severity: Sedang.

**S5. Pemilihan bahasa/halaman: `route()` memakai `window.location.pathname` tapi nav tidak pernah memanggil `navigate()`**
- `app.js:559-574`: `navigate(path)` pushState + route; tapi nav-link handler (`app.js:808-821`) hanya `renderPage(page)` tanpa pushState. Jadi **back/forward browser tidak bekerja di SPA** — tombol kembali browser melompat ke halaman luar, bukan ke page dashboard sebelumnya. `popstate` listener ada tapi tidak pernah terpicu dari dalam app.
- Severity: Sedang (broken SPA navigation).

**S6. Esc key hanya menutup sidebar; tidak menutup modal**
- `app.js:117-121` Escape hanya `closeMobileSidebar()`. `orderModal`, `promoFormWrap`, `grantVoucherWrap`, `invoiceModal`, `proofModal` tidak bisa ditutup dengan Esc (kecuali index.html yang punya handler Esc sendiri untuk orderModal/trackModal).
- Severity: Sedang.

**S7. `roleBadge`/`userName` statis "Customer"/"Memuat..." di dashboard.html statis**
- `dashboard.html:90,96` — placeholder tidak pernah diupdate oleh app.js sebelum `renderApp` (OK sebagai fallback), tapi jika `checkAuth` lambat (jaringan buruk), user melihat badge "Customer" salah untuk admin.
- Severity: Kecil.

**S8. Tabel skeleton header pesanan pakai `columns: 7` tapi kolom header sebenarnya 7 — OK; namun skeleton delivery pakai 7 kolom dengan `hasActions: false` padahal tabel asli tidak punya kolom aksi → jumlah kolom tepat, tapi tabel pelanggan 7 kolom vs header 7 — **konsisten**. Tidak ada bug; dicatat sebagai diverifikasi OK.

**S9. `pay.html` tidak ada skeleton kartu; memakai spinner teks tunggal** — ringan, dapat ditingkatkan ke skeleton. `pay.html` juga tidak ada `aria-live` pada `#payAlert` (umpan balik error tidak dianumlasikan untuk screen reader).
- Severity: Kecil.

**S10. `index.html` search service: tidak ada debounce + tidak ada indikator jumlah hasil**
- `index.html:1313`: `input` event langsung re-render grid. OK untuk volume kecil, tapi tidak ada "X layanan ditemukan" / empty-count feedback (empty state sudah ada di `1254-1263` — bagus).
- Severity: Kecil.

**S11. `track.html` — `#r-status` initial kosak + class tak terlihat**
- Sebelum lacak, `<span id="r-status" class="status-pill">` kosong; `#result` tersembunyi — benar. Tapi `status-pill` tidak terlihat saat kosong. Bukan bug.
- Catatan: `track.html:385` memakai token tak terdefinisi (lihat B3).

**S12. `sw.js` precache menyertakan `/dashboard` (rute SPA yang mungkin 404 pada server legacy PHP)**
- `sw.js:21-36`: `/dashboard` dan `/track` diasumsikan ada sebagai rute; jika worker lama belum melayani ini, precache gagal diam-diam (sudah di try/catch — aman). Hanya catatan.
- Severity: Kecil.

---

### 🔵 Kecil / pemolesan

- **P1** `app.js:2505` — `window.onload` tanpa guard `typeof window.App`.
- **P2** `dashboard.html:90` badge peran default "Customer" menyesatkan; `dashboard.html:96` "Memuat..." tidak punya skeleton topbar.
- **P3** `index.html:990-992` — dua CTA ("Pesan Sekarang" & "Lihat Harga") keduanya men-scroll ke `#harga` — tombol "Pesan Sekarang" harusnya membuka modal/order.
- **P4** `app.js:1286` — empty state dashboard menaruh `<button onclick="App.renderPesanan()">` di dalam `<td colspan=7>`; padding tabel dapat memdistorsi empty-state.
- **P5** `style.css:239 & 529` — `.h1` didefinisikan dua kali (identik). Hapus salah satu.
- **P6** `app.js:874-882` — `form.reset()` pada `promoForm` yang tidak ada → `form` null → TypeError diam-diam di dalam handler klik (no-op karena target null — aman tapi berisik).
- **P7** `pay.html:93` — tombol "Kembali ke Beranda" hardcoded `#f8fafc` (dark mode rusak, lihat B4).
- **P8** `auth/register.html:229-231` — "Syarat & Ketentuan" & "Kebijakan Privasi" pakai `alert()` placeholder. Tautan palsu = dead UI.
- **P9** `track.html:218` — `@keyframes spin` didefinisikan lokal; `pay.html:87` memakai kelas `.spinner` juga tanpa keyframes-nya sendiri (pay.html mengandalkan `animation: spin` — **tidak ada `@keyframes spin` di pay.html** → spinner di pay.html **tidak berputar**). 🔴 sebenarnya ini bug Besar; ditemukan saat verifikasi: `grep -rn "@keyframes spin"` → hanya track.html.
  → **Promosikan ke 🟠 Besar: spinner pay.html (`pay.html:87,260`) animasi tidak jalan.**
- **P10** `index.html:1267` — `const isPop = s.is_popular || idx === 0;` → selalu kartus pertama yang "populer" meski tidak ditandai; dapat menyesatkan.
- **P11** `app.js:204` — delay reveal `(idx % 4)*60ms` OK; tapi observer tidak re-init untuk elemen yang dirender ulang (disconnect + recreate ada di `initScrollReveal` — benar).
- **P12** Font: `design-tokens.css` mendeklarasikan `--font-sans: 'Inter', 'Plus Jakarta Sans'…` tapi `index.html:50` hanya memuat **Outfit + Plus Jakarta Sans** (tidak ada Inter). Token merujuk font yang tidak dimuat. Login/register memuat Inter. **Konsistensi font rusak.**
- **P13** `style.css:1400-1410` komentar "TASK D3" vs konten skeleton — dokumentasi token akurat, tidak ada bug.
- **P14** `dashboard.html:96` — `#userName` statis "Memuat..."; lebih baik skeleton bar mini.

---

## 2. KELEBIHAN (apa yang sudah benar)

✅ **Design-token system matang** (`design-tokens.css`): skala warna 50-950, tipografi fluida `clamp()`, spacing 4px, radius, shadow stack Vercel-style, z-index scale, breakpoint, **dark mode token override penuh** (`data-theme="dark"`), `prefers-reduced-motion` terhormat (durasi animasi → 0.01ms, skeleton pulse fallback, ripple disabled).

✅ **Skeleton loading nyata** (`style.css:1403-1488`): shimmer gradient, varian `skeleton-text/title/badge/btn/card/table`, dipakai konsisten di semua page renderer (`renderSkeletonTable`, `renderSkeletonCards`) dengan `aria-busy` + `aria-label`. Level: production-grade.

✅ **Empty state helper** (`app.js:262-271`): ikon + judul + subjudul + action HTML — dipakai di Dashboard, Pesanan (filter-aware!), Pelanggan, Layanan, Delivery. Subjudul pintar: berbeda saat filter aktif vs kosong.

✅ **Toast system** (`app.js:273-290` + `style.css:1854-1909`): 4 tipe, slide-in, auto-dismiss 3.2s, `z-index` 99999, responsif penuh (<=480px full-width). Dipakai di mana-mana.

✅ **Error boundary ganda**: render level (`renderError`, `app.js:1192-1200`, dengan tombol "Coba Lagi" + `catch` di `renderPage`) + window-level (`error`/`unhandledrejection`). Setiap page renderer punya try/catch sendiri.

✅ **HTML escaping disiplin** (`escape.js`): komentar menjelaskan ancaman stored-XSS dengan jelas; `esc()` dipakai nyaris di setiap injeksi API di `app.js` (verifikasi: `esc(o.order_code)`, `esc(p.code)`, dll — ~200 pemakaian).

✅ **Aksesibilitas dasar**: `:focus-visible` outline global (`style.css:48-55`), `aria-label` pada icon button (sidebar toggle, close, theme), `aria-label` pada tombol aksi promo/voucher, `aria-live="polite"` di `#result` track.html, `aria-describedby="hint"` pada input track, `aria-hidden` pada dekorasi (hero canvas, stepper).

✅ **Responsive ber-tier**: desktop lebar (>=1440) / tablet & off-canvas drawer (<=1024) / mobile snap-kanban (<=768) / small mobile 360-480px. Sidebar drawer dengan overlay + body scroll-lock + Esc + resize-close. Scroll-snap kanban di mobile.

✅ **Service worker**: precache app-shell eksplisit, SWR untuk aset, network-first untuk API GET, **POST/PUT/DELETE tidak pernah di-cache** (mencegah pembayaran ganda — komentar sw.js:86-88), fallback 503 JSON terstruktur, pembersihan cache versi lama. Komentar `ponytail:` jelas tentang kapan harus naik ke IndexedDB.

✅ **Print CSS** (`style.css:1969-2010` + `track.html:273-304`): `@page margin`, hide chrome, invoice thermal 80mm vs A4 mode, `no-print` class.

✅ **Invoice modal dual-mode** (thermal 80mm / A4 formal) dengan QR placeholder, kedaluwarsa-konteks, status pembayaran lunas/belum — dipakai baik di app.js maupun track.html.

✅ **Micro-interactions**: ripple pada `.btn`/`.tab`/`.tabbtn`, sheen loop pada primary, confetti & blob classes (mati, tapi siap), tilt parallax hero dengan `requestAnimationFrame`, scroll progress bar, IntersectionObserver reveal dengan delay stagger.

✅ **P5 service track publik**: polling 10 detik untuk notifikasi dengan auto-stop pada status selesai/batal, indikator "Live", masked customer name di track.html (`customer_name_masked`), rate-limit 429 ditangani.

✅ **Idempotency key pada pembayaran** (`pay.html:268`) — detail engineering yang baik.

✅ **Pay page UX**: kompresi gambar bukti di sisi klien (canvas 1024px max, JPEG 0.82), validasi tipe+ukuran, preview + hapus, metode pembayaran pill dengan detail rekening/e-wallet/QRIS, tombol bayar berubah ke "Masuk untuk Membayar" saat 401 (alur yang dipikirkan dengan baik).

✅ **Keamanan halaman publik minimal** (track.html): komentar eksplisit mengapa permukaan dibiarkan minimal — setiap elemen = permukaan serangan. Sikap benar.

✅ **Meta lengkap**: SEO, OG, Twitter card, canonical, `theme-color`, `sitemap.xml`, `robots.txt`, `_headers`.

---

## 3. IDE FITUR DESAIN PREMIUM

Urutan = rasio usaha/nilai. Tanda ✱ = satu-satunya yang perlu (lainnya opsional).

### 3.1 ✱✱✱ Fix dulu yang rusak (bukan fitur, tapi blok premium)
1. **Tambah `.status-baru/-proses/-selesai/-batal` + `.bd-*` mapping** ke `style.css` → semua badge hidup. 1 deklarasi CSS per status (`background`/`color`/`border` dari token). Estimasi: 20 baris.
2. **Tambah `.btn-sm`** + `@keyframes spin` global (pindah ke `design-tokens.css` atau `style.css`) → spinner pay.html hidup kembali, tombol toolbar invoice proporsional.
3. **Definisikan token hilang** (`--color-primary`, `--bg-surface`, `--border-color`, `--text-small`, `--color-surface-subtle`) atau ganti pemakaian ke token yang ada (`--color-brand-primary`, `--color-bg-secondary`, `--color-border-subtle`, `--text-caption`, `--color-bg-tertiary`).
4. **Hapus dead code** B1 (~230 baris) + dead CSS B2 → style.css turun ke ~18KB, parse lebih cepat.
5. **Buat `lupasandi.html`** (atau ganti link ke modal "hubungi admin" jika belum ada backend reset).

### 3.2 Sistem visual premium
6. **Sistem badge status tunggal**: `<span class="badge" data-status="${status}">` + CSS `[data-status="baru"] {…}` — menghilangkan kelas dinamis, memungkinkan variant outline/solid/subtle, dan menyala otomatis untuk status baru (mis. "dikirim"). Tambah **ikon status** (emoji atau SVG): `🆕 Baru / 🫧 Proses / ✅ Selesai / ⛔ Batal`.
7. **Elevation tokens ke konteks gelap**: shadow-as-border `--shadow-ring` di dark mode memakai `rgba(255,255,255,0.1)` (sudah ada) — terapkan pada `.card` dark mode supaya kartu tidak "flat black blob". Tambah `--color-bg-elevated` distinct dari `--color-bg-primary` (saat ini `#111827` vs `#090d16` — baik, tapi `.card` memakai `--card` = `#111827` — OK).
8. **Glass topbar dengan blur yang lebih kuat** + border bawah gradient (`mask-image` 1px fade) — efek Linear/Vercel.
9. **Number animation pada KPI**: `requestAnimationFrame` count-up untuk `Total Omset / Pesanan Aktif / Selesai Hari Ini / Total Pelanggan` saat reveal. Tambah `tabular-nums` (`font-variant-numeric`) di semua angka uang/kuantitas agar tidak bergeser saat polling memperbarui data.
10. **Skeleton → content crossfade** (opacity transition 200ms) alih-alih `innerHTML` swap instan. Terasa jauh lebih halus.
11. **Sticky table header + row hover highlight + zebra** untuk tabel pesanan/pelanggan (saat ini border-spacing terpisah — efek "chip row" bagus, tapi header tidak sticky saat scroll di tabel panjang).
12. **Dark mode untuk auth pages** (B5) — bootstrap tema + tombol toggle + ilustrasi 3D dengan `filter: brightness(0.9)`.

### 3.3 Interaksi & state
13. ✱ **Inline editing**: klik nama pelanggan/alamat di tabel → edit-in-place; kurangi modal overhead untuk staf.
14. **Undo toast** setelah hapus pesanan/promo/voucher (data sudah ada di state; restore via API atau simpan snapshot 5 detik). "Hapus ⌫ · Batal (5)".
15. **Command palette (⌘K / Ctrl+K)**: navigasi cepat antar page + cari pesanan by kode + aksi ("buat pesanan", "cetak laporan"). Modal sudah ada infrastrukturnya.
16. **Optimistic update untuk dropdown status** (B9): UI langsung berubah saat ganti → POST di belakang → toast sukses atau rollback + toast error. Spinner mini pada dropdown selama permintaan.
17. **Filter pesanan: date-range preset pills** ("Hari Ini / 7 Hari / Bulan Ini") seperti halaman laporan — konsistensi + 1 klik.
18. **Quick order funnel (B10)**: `btnGo` kirim `?service_id=&kg=&promo=1` ke dashboard → dashboard buka modal order dengan prefilled. Konversi langsung naik.
19. **Notifikasi in-app real-time**: lonceng 🔔 di topbar dengan badge jumlah + dropdown (infrastruktur `/api/notifications` sudah ada, hanya di-render dalam modal track).
20. **Guided onboarding tour** untuk pelanggan baru (3 langkah overlay: pesanan pertama, lacak, bayar) — gunakan `localStorage` flag.
21. **Skeleton topbar** saat load (P14): bar 120px bukan teks "Memuat...".
22. **Empty state ilustrasi SVG** alih-alih emoji — kustom, tidak tergantung font OS, dan dapat dianimasikan (bubble laundry berbobok).

### 3.4 Detail "delight" premium
23. **Confetti** saat pembayaran sukses di pay.html (CSS class `.confetti` sudah ada, tinggal pasang trigger di `submitPayment` success). Konfeti saat "Lunas" adalah momen emosional inti laundry app.
24. **Haptic feedback** (`navigator.vibrate(10)`) pada aksi konfirmasi mobile (hapus, bayar, salin kode).
25. **Copy button dengan toast**, bukan `alert()` (pay.html:154,158,169 & register.html:229-231) — alert() blocking = tidak premium.
26. **Skeleton untuk gambar bukti pembayaran** + lightbox zoom (saat ini klik buka tab baru — OK, lightbox modal lebih baik).
27. **Pull-to-refresh** pada mobile dashboard (sentuh + drag → re-render page).
28. **Long-press / swipe-to-delete** di baris tabel mobile (touch action), seperti email.
29. **Pengalaman "apel ke emas"**: status selesai → card pesanan berubah warna hijau lembut + tombol "Minta Pengantaran".
30. **Time-ago + tooltip waktu**: `2 jam lalu` (relatif) + tooltip waktu absolut di notifikasi — lebih manusiawi dari `HH:MM`.
31. **Halaman pengaturan (settings)**: tema (Terang/Gelap/Sistem = 3 pilihan, bukan toggle biner), bahasa (id/en), preferensi notifikasi,密度 informasi tabel. Toggle pill `.toggle` sudah ada CSS-nya.
32. **Laporan: export CSV/Excel button** + "Bagikan tautan laporan" (query string sudah berfungsi via `_reportFilter`).
33. **Laporan: area/line chart toggle** + klik bar → filter detail hari itu (drill-down). Data `daily` sudah ada.
34. **Peta kurir (delivery page)**: embed peta statis OSM dengan pin alamat + status kurir; tidak perlu API key.

### 3.5 Aksesibilitas & inklusi
35. ✱ **Perbaiki modal a11y**: `role="dialog"`, `aria-modal`, fokus trap, `aria-label` pada tombol ✕, kembalikan fokus ke pemicu saat tutup. `confirm()` sekarang memakai inline `role="dialog"` — bagus, tinggal trap.
36. **Tombol "Lewati ke konten"** (skip link) di dashboard — 1 elemen, langsung WCAG 2.1 AA.
37. **`aria-live` untuk toast container** supaya screen reader mengumumkan toast.
38. **Keyboard navigation penuh untuk tab kategori + kanban** (panah kiri/kanan, `aria-pressed`/`aria-selected`).
39. **Tingkatkan kontras**: beberapa `--color-text-tertiary` (#94a3b8 pada #090d16 = ~4.5:1 OK; tapi #64748b pada #f8fafc = 4.8:1 — tepat di batas AA untuk teks kecil; gunakan #475569 untuk `--text-caption` di latar terang). Audit kontras terakhir direkomendasikan via axe DevTools.

---

## 4. RINGKASAN PRIORITAS

| # | Aksi | Usaha | Dampak |
|---|---|---|---|
| 1 | Tambah CSS `.status-*` badge + `.btn-sm` + `@keyframes spin` global | 30 mnt | 🔴 Memperbaiki tampilan di seluruh dashboard |
| 2 | Definisi token / ganti token tak terdefinisi (B3) | 20 mnt | 🔴 Notifikasi + indikator live hidup |
| 3 | Buat `lupasandi.html` atau nonaktifkan link (K4) | 30 mnt | 🔴 Dead end fungsional |
| 4 | Hapus ~230 baris dead-code promo (B1) + dead CSS (B2) | 1 jam | 🟠 -40% ukuran style.css |
| 5 | Hapus duplikat `esc()` (K2) + guard init (K3) | 15 mnt | 🔴 Kejernihan |
| 6 | Dark mode auth pages (B5) + `.ripple` di login (B6) | 1 jam | 🟠 Konsistensi |
| 7 | Undo toast + optimistic update status (B9) | 2 jam | 🟠 Integritas + kepercayaan |
| 8 | Quick-order prefill funnel (B10) | 2 jam | 🟠 Konversi |
| 9 | Esc-close modal + back/forward SPA (S5, S6) | 1 jam | 🟡 Navigasi |
| 10 | Lencana status tunggal + ikon (3.2 #6) | 1 hari | 🟠 Sistem visual |
| 11 | Command palette (3.3 #15) | 2 hari | ⭐ Premium flagship |
| 12 | Konfeti pembayaran + haptik (3.4 #23-24) | 2 jam | ⭐ Momen emosional |

**Tidak ada kode yang diubah selama audit.** Semua temuan dapat diverifikasi ulang dengan perintah grep yang tercantum di atas.
