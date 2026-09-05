# Dokumentasi API Serverless

Semua endpoint backend terletak di folder `functions/api/` dan berjalan di atas Cloudflare Edge Runtime dengan koneksi langsung ke TiDB Cloud Serverless.

---

## Daftar Endpoint

### 1. Autentikasi
- `POST /api/auth/login`
  - **Body**: `{ identity: "email/phone/name", password: "xxx" }`
  - **Return**: `{ ok: true, user: { ... } }` dan Set-Cookie session token.
- `POST /api/auth/register`
  - **Body**: `{ full_name, email, phone, password, confirm, agree: true }`
  - **Return**: `{ ok: true, user: { ... } }`
- `POST /api/auth/logout`
  - **Return**: `{ ok: true }` (menghapus cookie session).
- `GET /api/me`
  - **Return**: Informasi user yang sedang login saat ini berdasarkan token cookie.

---

### 2. Dashboard
- `GET /api/dashboard`
  - **Return**: Ringkasan omset, total order aktif, order selesai hari ini, daftar transaksi terkini, serta voucher aktif.

---

### 3. Manajemen Pesanan (Orders)
- `GET /api/orders`
  - Query params: `q`, `status`, `start`, `end`
  - **Return**: `{ ok: true, orders: [...] }`
- `POST /api/orders`
  - Actions:
    - `create_order`: Menambah order baru beserta kalkulasi diskon/voucher.
    - `move_status`: Mengubah status (baru -> proses -> selesai -> batal).
    - `update_order`: Memperbarui rincian order.
    - `delete_order`: Menghapus order.

---

### 4. Pelanggan (Customers)
- `GET /api/customers`
  - Menampilkan daftar pelanggan dengan metrik total belanja dan perhitungan tag (VIP, Sering, Reguler, Baru).
- `POST /api/customers`
  - Actions: `create_customer`, `update_customer`, `delete_customer`.

---

### 5. Layanan & Tarif (Services)
- `GET /api/services`
  - Menampilkan katalog layanan cuci, harga, satuan, dan durasi.
- `POST /api/services`
  - Actions: `create_service`, `update_service`, `delete_service`, `toggle_active`.

---

### 6. Antar Jemput (Pickup & Delivery)
- `GET /api/delivery`
  - Menampilkan daftar jadwal penjemputan dan pengantaran cucian serta list kurir aktif.
- `POST /api/delivery`
  - Actions: `create_task`, `assign_courier`, `update_status`, `delete_task`.

---

### 7. Promo & Voucher
- `GET /api/promos`: Katalog master promo diskon.
- `POST /api/promos`: Manajemen promo (tambah/edit/hapus).
- `GET /api/vouchers`: Daftar voucher milik pengguna.
- `POST /api/vouchers`: Klaim voucher (`action: 'claim'`).

---

### 8. Laporan & Keuangan
- `GET /api/reports`
  - Query params: `group` (hari/minggu/bulan), `start`, `end`.
  - Mengembalikan agregasi omset lunas vs belum lunas, grafik waktu, dan tabel rincian performa harian.

---

### 9. Profil Pengguna
- `GET /api/profile`: Mengambil detail profil user.
- `POST /api/profile`: Update nama, no. hp, dan ubah password dengan validasi password lama.
