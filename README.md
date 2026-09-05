# Embun Laundry · Serverless Edition (Cloudflare Pages + TiDB Cloud)

Sistem Manajemen Laundry Modern berbasis **Cloudflare Pages (Edge Functions)** dan **TiDB Cloud Serverless**.

---

## 🌟 Fitur Utama
- **Multi-Role RBAC**: Admin, Staff, Owner, dan Pelanggan.
- **Manajemen Pesanan Real-Time**: Status pesanan (Baru, Proses, Selesai, Batal), hitung otomatis diskon kiloan dan voucher.
- **Pickup & Delivery Kurir**: Penjadwalan jemput dan antar cucian, penugasan kurir, dan tracking status pengiriman.
- **Promo & Voucher Diskon**: Sistem klaim voucher otomatis dengan perhitungan diskon persentase maupun potongan harga flat.
- **Laporan Finansial & KPI**: Grafik omset, perbandingan lunas vs belum lunas, rata-rata bobot laundry, dan rekapitulasi harian.
- **Sistem Pembayaran Dinamis**: Halaman invoice QRIS dinamis siap bayar (`/pay.html`).
- **Edge Performance**: Waktu respon ultra-cepat (<50ms) didukung jaringan global Cloudflare dan TiDB Cloud Serverless Driver.

---

## 🚀 Panduan Ringkas Menjalankan
1. **Lokal**:
   ```bash
   npm install
   npx wrangler pages dev public
   ```
2. **Deploy**:
   ```bash
   npx wrangler pages deploy public
   ```

Lihat panduan lengkap pada:
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) untuk panduan konfigurasi Cloudflare Pages.
- [`TIDB_SETUP.md`](./TIDB_SETUP.md) untuk pengaturan database TiDB Cloud.
- [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) untuk referensi endpoint REST API.
- [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) untuk DDL skema database.
