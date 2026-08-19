# Embun-Laundry

Aplikasi pengelolaan layanan laundry, pencatatan transaksi kasir, dan tracking status pesanan pelanggan.

## ✨ Fitur Utama
- 🧺 **Manajemen Pesanan:** Pencatatan order masuk, status pengerjaan (Antrian, Proses, Siap Diambil, Selesai), dan cetak nota.
- 👥 **Manajemen Pelanggan:** Database pelanggan, histori pemesanan, dan kategori membership.
- 💲 **Layanan & Tarif:** Pengaturan jenis layanan (Cuci Kering, Setrika, Cuci Lipat, Dry Cleaning) dan tarif per kg / satuan.
- 🚚 **Pickup & Delivery:** Penjadwalan kurir untuk penjemputan dan pengantaran laundry ke alamat pelanggan.
- 🎟️ **Promo & Diskon:** Pengaturan voucher promo dan potongan harga.
- 📑 **Laporan & Analytics:** Laporan pendapatan, volume cucian, dan grafik performa operasional.
- 💳 **Pembayaran Digital & Cash:** Dukungan pencatatan status bayar (Lunas / Belum Lunas) serta QRIS.

## 🛠️ Teknologi yang Digunakan
- **Backend:** PHP 8.x
- **Database:** MySQL / MariaDB (`embun_laundry`)
- **Frontend:** HTML5, CSS3 Modern, Vanilla JavaScript (Fetch API Realtime)
- **Styling:** Custom Modern Responsive Design

## 🚀 Cara Menjalankan Secara Lokal
1. Pastikan **XAMPP** sudah terinstal dan servis **Apache** & **MySQL** berjalan.
2. Tempatkan folder project ini di dalam direktori `c:/xampp/htdocs/`.
3. Buka **phpMyAdmin** (`http://localhost/phpmyadmin`) dan impor database dari file `db/embun_laundry.sql` atau `db/init.sql`.
4. Sesuaikan konfigurasi database pada file `config.php` jika diperlukan:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_USER', 'root');
   define('DB_PASS', '');
   define('DB_NAME', 'embun_laundry');
   ```
5. Akses aplikasi melalui browser di `http://localhost/dhani-laundry` (atau sesuai nama foldernya).
