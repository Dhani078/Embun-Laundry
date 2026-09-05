# Panduan Setup TiDB Cloud Serverless

Dokumen ini menjelaskan langkah demi langkah pengaturan TiDB Cloud Serverless untuk aplikasi **Embun Laundry**.

---

## 1. Buat Cluster TiDB Cloud
1. Kunjungi [https://tidbcloud.com](https://tidbcloud.com) dan login/daftar akun.
2. Klik tombol **Create Cluster**.
3. Pilih opsi **Serverless (Free Tier)**.
4. Pilih Region terdekat (contoh: `ap-southeast-1` Singapura).
5. Tentukan nama cluster, misalnya: `embun-laundry-cluster`.
6. Klik **Create**. Cluster akan aktif dalam beberapa detik.

---

## 2. Ambil Connection String Serverless
1. Pada dashboard cluster, klik tombol **Connect**.
2. Di bagian format koneksi, pilih tab **`@tidbcloud/serverless`** atau **Node.js (HTTPS/Serverless driver)**.
3. Salin URL koneksi yang berformat:
   ```env
   mysql://<user>:<password>@<host>/embun_laundry?ssl={"rejectUnauthorized":true}
   ```
4. Simpan URL ini untuk dimasukkan ke Cloudflare Pages Environment Variables (`TIDB_DATABASE_URL`).

---

## 3. Eksekusi Skema Database
Buka tab **SQL Editor** pada TiDB Cloud console, lalu paste dan jalankan isi file `db/schema_tidb.sql`:

```sql
-- Buat database jika belum ada
CREATE DATABASE IF NOT EXISTS embun_laundry;
USE embun_laundry;

-- 1. Tabel Users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(30) DEFAULT NULL,
  avatar_path VARCHAR(255) DEFAULT NULL,
  role ENUM('Admin','Owner','Staff','Customer') NOT NULL DEFAULT 'Customer',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Services
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) DEFAULT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  description TEXT DEFAULT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  price INT NOT NULL,
  duration_hours INT NOT NULL,
  category VARCHAR(20) NOT NULL DEFAULT 'Reguler',
  is_popular TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  badge VARCHAR(30) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Tabel Customers
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  tag ENUM('VIP','Reguler','Sering','Baru') NOT NULL DEFAULT 'Reguler',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

-- 4. Tabel Orders
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(20) NOT NULL UNIQUE,
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(32) DEFAULT NULL,
  customer_address VARCHAR(255) DEFAULT NULL,
  service_id INT NOT NULL,
  weight_kg INT NOT NULL,
  price_per_kg INT NOT NULL,
  discount INT NOT NULL DEFAULT 0,
  total_amount INT NOT NULL,
  paid_amount INT NOT NULL DEFAULT 0,
  payment_status ENUM('unpaid','partial','paid','refunded') NOT NULL DEFAULT 'unpaid',
  created_by INT DEFAULT NULL,
  status ENUM('baru','proses','selesai','batal') NOT NULL DEFAULT 'baru',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME DEFAULT NULL,
  INDEX idx_orders_created (created_at),
  INDEX idx_orders_status (status)
);

-- 5. Tabel Couriers
CREATE TABLE IF NOT EXISTS couriers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) DEFAULT NULL UNIQUE,
  full_name VARCHAR(80) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  vehicle VARCHAR(40) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  rating DECIMAL(3,2) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. Tabel Pickup & Delivery
CREATE TABLE IF NOT EXISTS pickup_delivery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_code VARCHAR(20) DEFAULT NULL UNIQUE,
  type ENUM('pickup','delivery') NOT NULL,
  order_code VARCHAR(40) DEFAULT NULL,
  customer_name VARCHAR(80) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  status ENUM('scheduled','assigned','onroute','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  courier_id INT DEFAULT NULL,
  schedule_date DATE NOT NULL,
  start_time TIME DEFAULT NULL,
  end_time TIME DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pd_type (type),
  INDEX idx_pd_date (schedule_date),
  INDEX idx_pd_status (status)
);

-- 7. Tabel Promos
CREATE TABLE IF NOT EXISTS promos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) DEFAULT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  type ENUM('percent','nominal','fixed') NOT NULL DEFAULT 'percent',
  value INT NOT NULL DEFAULT 0,
  min_spend INT NOT NULL DEFAULT 0,
  max_discount INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  expires_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 8. Tabel User Vouchers
CREATE TABLE IF NOT EXISTS user_vouchers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  promo_id INT DEFAULT NULL,
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  type ENUM('flat','percent') NOT NULL DEFAULT 'flat',
  value INT NOT NULL DEFAULT 0,
  min_spend INT NOT NULL DEFAULT 0,
  max_discount INT NOT NULL DEFAULT 0,
  expires_at DATETIME DEFAULT NULL,
  used_at DATETIME DEFAULT NULL,
  source VARCHAR(32) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_uv_user (user_id)
);

-- 9. Tabel Payments
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  method ENUM('QRIS','DANA','OVO','GOPAY','TRANSFER','CASH') NOT NULL,
  provider VARCHAR(32) DEFAULT 'manual',
  provider_ref VARCHAR(64) DEFAULT NULL,
  amount INT NOT NULL,
  status ENUM('pending','paid','failed','expired','cancelled') NOT NULL DEFAULT 'pending',
  qr_payload TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL,
  paid_at DATETIME DEFAULT NULL
);

-- 10. Data Awal (Seeds)
INSERT INTO users (full_name, email, phone, role, password_hash)
VALUES 
('Admin Laundry', 'admin@gmail.com', '08123456789', 'Admin', 'admin123'),
('Dhani Staff', 'staff@gmail.com', '082148564979', 'Staff', 'staff123'),
('Pelanggan Setia', 'user@gmail.com', '085700001111', 'Customer', 'user123')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);

INSERT INTO services (name, unit, price, duration_hours, category, is_active)
VALUES
('Cuci Kering Reguler', 'kg', 20000, 24, 'Reguler', 1),
('Setrika Rapi', 'kg', 15000, 12, 'Reguler', 1),
('Cuci Lipat', 'kg', 15000, 24, 'Reguler', 1),
('Dry Cleaning Premium', 'kg', 35000, 48, 'Premium', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);
```

---

## 4. Keunggulan TiDB Serverless Driver
Driver `@tidbcloud/serverless` menggunakan koneksi HTTP/1.1 & HTTP/2 berbasis stateless fetch yang dirancang khusus untuk lingkungan Edge Computing seperti **Cloudflare Pages / Workers**. Driver ini tidak membutuhkan persistent TCP pooling yang umumnya gagal di runtime edge.
