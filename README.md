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

## 👥 Manajemen Akun & Hak Akses
Sistem mengimplementasikan Role-Based Access Control (RBAC) dengan tingkatan peran:
- **Admin**: Akses penuh seluruh modul master data, laporan finansial, dan audit log.
- **Staff**: Manajemen pesanan kasir, penjadwalan kurir, dan data pelanggan.
- **Pelanggan**: Pelacakan status pesanan secara real-time dan klaim voucher.

*Pengguna baru dapat mendaftar langsung melalui tombol **Daftar Pelanggan** pada antarmuka web. Akun administratif dikelola secara tertutup dan tidak dipublikasikan dengan kredensial default di repositori publik.*

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
