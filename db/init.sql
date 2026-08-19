-- db/init.sql
-- Buat database & tabel untuk Embun Laundry
CREATE DATABASE IF NOT EXISTS embun_laundry CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE embun_laundry;

-- Tabel users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(30),
  role ENUM('Admin','Owner','Staff') NOT NULL DEFAULT 'Admin',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel services (harga layanan)
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  price INT NOT NULL,            -- harga per kg
  duration_hours INT NOT NULL,   -- estimasi durasi
  is_popular TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed data services
INSERT INTO services (name, price, duration_hours, is_popular) VALUES
('Cuci Kering', 20000, 5, 1),
('Setrika', 20000, 4, 0),
('Cuci Lipat', 15000, 6, 0),
('Dry Cleaning', 35000, 24, 0)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Optional: Buat user admin demo (email: admin@embunlaundry.id, pass: admin123)
INSERT INTO users (full_name, email, phone, role, password_hash)
SELECT 'Admin Demo', 'admin@embunlaundry.id', '081234567890', 'Admin',
       '$2y$10$y6k7U6xS4I8lS7G1t2mD2eQk4iZrUQd3mMjqz8aqy1G8f2uP1rO/O'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='admin@embunlaundry.id');
-- password_hash di atas = hash('admin123')
