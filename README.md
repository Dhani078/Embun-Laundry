# Dokumentasi Lengkap Embun Laundry Serverless

Aplikasi Manajemen Laundry Modern yang dibangun menggunakan **Cloudflare Pages & Workers** dengan arsitektur Edge Computing serta terhubung langsung ke database **TiDB Cloud Serverless**.

---

## 🚀 Live Demo & Deployment
- **Live URL**: [https://embun-laundry.dhanisepeda.workers.dev](https://embun-laundry.dhanisepeda.workers.dev)
- **Repository GitHub**: [https://github.com/Dhani078/Embun-Laundry](https://github.com/Dhani078/Embun-Laundry)
- **Runtime**: Cloudflare Workers + Static Assets Binding (`env.ASSETS`)
- **Database Engine**: TiDB Cloud Serverless (MySQL Compatible)
- **Driver**: `@tidbcloud/serverless` (Stateless HTTP Fetch Driver)

---

## 👥 Akun Default untuk Login
Aplikasi telah dilengkapi dengan akun bawaan untuk pengujian:

| Role | Email / Username | Kata Sandi | Hak Akses |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@gmail.com` | `admin123` | Akses penuh seluruh modul & laporan |
| **Staff** | `staff@gmail.com` | `staff123` | Manajemen pesanan, kurir, & pelanggan |
| **Pelanggan** | `user@gmail.com` | `user123` | Tracking status pesanan & voucher |

*Anda juga dapat membuat akun pelanggan baru langsung dari tombol **Daftar Pelanggan**.*

---

## 📁 Struktur Proyek
```
embun-laundry/
├── public/                 # Static Assets (HTML, CSS, JS, Gambar)
│   ├── index.html          # Single Page Application Entrypoint
│   ├── pay.html            # Halaman Pembayaran QRIS Dinamis
│   ├── app.js              # State Manager & Client-Side Router
│   ├── assets/             # Stylesheet CSS & Ikon
│   └── img/                # Logo, Ilustrasi 3D, Avatar
├── functions/              # Cloudflare Pages Functions
│   ├── _db.js              # TiDB Connection & Session Token Generator
│   └── api/                # REST API Endpoints
│       ├── auth/           # Login, Register, Logout
│       ├── orders.js       # CRUD Pesanan & Perhitungan Diskon
│       ├── customers.js    # Data Pelanggan & Smart Tagging
│       ├── services.js     # Katalog Layanan & Tarif
│       ├── delivery.js     # Penjadwalan Kurir Pickup/Delivery
│       ├── promos.js       # Master Promo Diskon
│       ├── vouchers.js     # Klaim Voucher Pengguna
│       ├── reports.js      # Rekap Omset & Laporan Finansial
│       ├── profile.js      # Profil User & Ganti Password
│       ├── checkin.js      # Fitur Check-in Harian
│       ├── pay.js          # Detail Pembayaran & Status Invoice
│       └── me.js           # Profil Sesi Aktif
├── src/
│   └── index.js            # Workers Entrypoint Dispatcher & Asset Fallback
├── db/
│   └── embun_laundry.sql   # Dump SQL Asli
├── DATABASE_SCHEMA.md      # DDL Skema TiDB Cloud
├── DEPLOYMENT.md           # Panduan Deploy Cloudflare
├── TIDB_SETUP.md           # Panduan Setup TiDB Cloud Serverless
├── API_DOCUMENTATION.md    # Spesifikasi Endpoint REST API
├── wrangler.toml           # Konfigurasi Cloudflare Wrangler
└── package.json            # Node Module & Dependencies
```

---

## 🛠️ Panduan Menjalankan Secara Lokal
```bash
# 1. Pasang dependensi
npm install

# 2. Jalankan secara lokal dengan Wrangler
npx wrangler dev
```

---

## 🚢 Panduan Deploy ke Cloudflare
```bash
# Deploy langsung via Wrangler CLI
npx wrangler deploy
```
Atau cukup lakukan `git push origin main` pada repository GitHub yang terhubung dengan Cloudflare Pages/Workers Builds.
