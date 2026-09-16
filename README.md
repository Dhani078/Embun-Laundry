# Embun Laundry Serverless

Aplikasi Sistem Informasi & Manajemen Laundry Modern berbasis **Cloudflare Workers & Pages Functions** dengan arsitektur Edge Computing, Single Page Application (SPA) Vanilla CSS/JS dengan estetika Glassmorphism, simulasi interaktif p5.js canvas droplet hero, dan terintegrasi langsung dengan database **TiDB Cloud Serverless**.

---

## 🚀 Fitur Utama & Keunggulan

- **Arsitektur Edge Computing**: Berjalan tanpa server konvensional di jaringan global Cloudflare Workers dengan latensi rendah.
- **TiDB Cloud Serverless**: Akses database terdistribusi kompatibel MySQL menggunakan driver stateless HTTP `@tidbcloud/serverless`.
- **Desain & UX Modern**:
  - Tampilan visual Glassmorphism dengan palet warna terstandarisasi melalui [design-tokens.css](file:///c:/xampp/htdocs/embun-laundry/public/assets/design-tokens.css).
  - Simulasi tetesan air dan riak konsentris p5.js hero ([hero-canvas.js](file:///c:/xampp/htdocs/embun-laundry/public/assets/hero-canvas.js)) dengan akselerasi GPU dan penghematan daya otomatis saat keluar viewport (IntersectionObserver).
  - Animasi transisi masuk halus, skeleton loader, dark mode terintegrasi, dan notifikasi toast global.
  - Dukungan aksesibilitas penuh (`prefers-reduced-motion: reduce`).
- **Pelacakan Pesanan & Notifikasi**:
  - Pelacakan pesanan publik instan berdasarkan kode nota tanpa login.
  - Polling real-time notifikasi status pengerjaan cucian.
- **Pembayaran & Kasir Modern**:
  - Dynamic QRIS & opsi transfer bank / e-wallet.
  - Upload bukti pembayaran (transfer slip).
  - Proteksi transaksi idempotency key & pencegahan pembayaran berlebih (overpayment).
  - Cetak nota & invoice PDF langsung dari browser.
- **Loyalitas & Promo**:
  - Sistem voucher & promo diskon terintegrasi.
  - Streak reward check-in harian (zona waktu Indonesia Barat / WIB).
- **Keamanan Berlapis (Enterprise Hardening)**:
  - Hash password PBKDF2 via WebCrypto (10.000 iterasi SHA-256) dengan salt acak 16-byte.
  - Cookie sesi `HttpOnly; Secure; SameSite=Lax` dengan verifikasi JWT berbasis secret lingkungan (`JWT_SECRET`).
  - Pencabutan sesi instan melalui mekanisme `session_version` pada tabel database.
  - Kebijakan CORS ketat same-origin (`functions/_cors.js`) pada seluruh rute API.
  - 100% Parameterized queries untuk proteksi penuh terhadap SQL Injection.
  - Isolasi data pengguna (anti-IDOR) dan sanitasi data (anti-Stored XSS).
  - In-memory rate limiting pada rute autentikasi dan polling notifikasi.

---

## 👥 Manajemen Hak Akses (RBAC)

Sistem mengimplementasikan Role-Based Access Control bertingkat:
- **Admin**: Akses penuh master data, manajemen pengguna, konfigurasi promo, laporan finansial, dan analitika omset.
- **Owner**: Pengawasan performa bisnis, laporan omset, dan metrik operasional.
- **Staff**: Manajemen pesanan operasional, kasir, alokasi kurir antar-jemput, dan katalog pelanggan.
- **Customer**: Pembuatan pesanan mandiri, pelacakan cucian, pembayaran QRIS, klaim voucher, dan check-in harian.

*Registrasi mandiri pelanggan dapat dilakukan langsung melalui antarmuka web. Akun staf dan administratif dikelola secara privat dan tidak menyertakan kredensial default di repositori publik.*

---

## 📁 Struktur Direktori

```
embun-laundry/
├── public/                     # Static Assets & Single Page Application
│   ├── index.html              # Landing Page & Portal Pelanggan
│   ├── pay.html                # Halaman Pembayaran QRIS Dinamis
│   ├── app.js                  # Frontend SPA State & Router
│   ├── manifest.json           # Progressive Web App (PWA) Manifest
│   ├── assets/
│   │   ├── design-tokens.css   # Variabel Desain Token & Palet Warna
│   │   ├── style.css           # Styling Universal & Glassmorphism
│   │   └── hero-canvas.js      # Simulasi Tetesan Air & Riak p5.js
│   └── img/                    # Aset Logo & Gambar Ilustrasi
├── functions/                  # Cloudflare Pages Functions
│   ├── _db.js                  # Database Client & Session Token Helpers
│   ├── _cors.js                # Kebijakan CORS Ketat Same-Origin
│   ├── _password.js            # Hash PBKDF2 via WebCrypto
│   └── api/                    # Modul REST API Serverless
│       ├── auth/               # Login, Register, Refresh, Logout
│       ├── orders.js           # CRUD Pesanan & Kalkulasi Diskon Otoritatif
│       ├── pay.js              # Transaksi Pembayaran & Upload Bukti Transfer
│       ├── services.js         # Master Katalog Layanan & Tarif
│       ├── track.js            # Pelacakan Pesanan Publik
│       ├── notifications.js    # Polling Status Real-time
│       ├── customers.js        # Direktori & Smart Tagging Pelanggan
│       ├── delivery.js         # Penjadwalan Kurir & Tugas Antar-Jemput
│       ├── promos.js           # Master Promo Diskon
│       ├── vouchers.js         # Klaim & Manajemen Voucher
│       ├── reports.js          # Analitika Omset & Performa Finansial
│       ├── checkin.js          # Sistem Check-in Harian (WIB)
│       ├── profile.js          # Manajemen Profil & Penggantian Sandi
│       ├── health.js           # Liveness Probe Tanpa Beban DB
│       └── me.js               # Profil Pengguna Sesi Aktif
├── src/
│   └── index.js                # Cloudflare Worker Dispatcher & Security Headers
├── db/
│   ├── init.sql                # Skema Dasar Inisialisasi Database
│   └── migrations/             # Skrip Migrasi Skema Bertahap
│       ├── 0001_cleanup_debug_accounts.sql
│       ├── 0002_add_user_id_to_orders.sql
│       ├── 0003_add_idempotency_key_to_payments.sql
│       ├── 0004_add_session_version_to_users.sql
│       ├── 0005_create_notifications_table.sql
│       └── 0006_add_proof_image_to_payments.sql
├── tools/                      # Harness Verifikasi & Pengujian Otomatis
│   ├── run_all_verifiers.sh    # Runner Orkestrasi Seluruh Suite (43 Suites)
│   └── verify_*.mjs            # Suite Pengujian Unit, Integrasi & Keamanan
├── DATABASE_SCHEMA.md          # Dokumentasi DDL Lengkap TiDB Serverless
├── TIDB_SETUP.md               # Panduan Konfigurasi TiDB Cloud
├── API_DOCUMENTATION.md        # Spesifikasi REST API & Matriks RBAC
├── DEPLOYMENT.md               # Panduan Deployment Cloudflare
├── CONTRIBUTING.md             # Panduan Pengembangan & Standar Kode
├── wrangler.toml               # Konfigurasi Cloudflare Workers
└── package.json                # Dependensi Proyek
```

---

## 🛠️ Panduan Menjalankan Secara Lokal

### 1. Prasyarat
- [Node.js](https://nodejs.org/) (versi LTS >= 18.0.0)
- npm atau pnpm

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment Variables Lokal
Salin file template `.dev.vars.example` menjadi `.dev.vars`:
```bash
cp .dev.vars.example .dev.vars
```
Isi konfigurasi pada file `.dev.vars`:
```env
TIDB_DATABASE_URL=mysql://<user>:<password>@<host>/embun_laundry?ssl={"rejectUnauthorized":true}
JWT_SECRET=rahasia_kunci_jwt_lokal_minimal_32_karakter
```

### 4. Menjalankan Server Lokal (Wrangler)
```bash
npx wrangler dev
```
Buka browser di `http://localhost:8787` untuk mengakses aplikasi.

---

## 🧪 Pengujian & Verifikasi Otomatis (43 Test Suites)

Proyek ini dilengkapi dengan 43 automated verification suites yang mencakup audit keamanan, integritas data, ketahanan IDOR, SQL injection canary, responsivitas desain, serta fungsionalitas UI.

Untuk menjalankan seluruh suite pengujian sekaligus:
```bash
bash tools/run_all_verifiers.sh
```
Seluruh 43 suite pengujian harus menghasilkan status **100% HIJAU (exit code 0)** sebelum melakukan commit atau deployment.

---

## 🚢 Panduan Deployment

Aplikasi dapat dideploy secara instan menggunakan Cloudflare Wrangler CLI:

```bash
# Set secret di Cloudflare Secret Store
npx wrangler secret put TIDB_DATABASE_URL
npx wrangler secret put JWT_SECRET

# Deploy ke Cloudflare Workers & Static Assets
npx wrangler deploy
```

Informasi konfigurasi mendalam dapat dipelajari di [DEPLOYMENT.md](file:///c:/xampp/htdocs/embun-laundry/DEPLOYMENT.md).

---

## 📄 Lisensi & Kontribusi

Silakan baca [CONTRIBUTING.md](file:///c:/xampp/htdocs/embun-laundry/CONTRIBUTING.md) untuk panduan kontribusi, alur kerja git, serta standar arsitektur kode.
