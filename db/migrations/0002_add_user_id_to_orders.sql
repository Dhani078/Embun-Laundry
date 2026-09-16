-- db/migrations/0002_add_user_id_to_orders.sql
-- Fase 0.6 (K4): Ganti dasar kepemilikan pesanan dari customer_name menjadi user_id.
--
-- CARA ROLLBACK:
-- ALTER TABLE orders DROP INDEX idx_orders_user_id;
-- ALTER TABLE orders DROP COLUMN user_id;

-- 1. Tambah kolom user_id INT NULL ke tabel orders
ALTER TABLE orders ADD COLUMN user_id INT NULL AFTER id;

-- 2. Tambah index untuk performa pencarian order per pengguna
ALTER TABLE orders ADD INDEX idx_orders_user_id (user_id);

-- 3. Backfill user_id berdasarkan customer_name jika cocok dengan nama pengguna di tabel users
UPDATE orders o
JOIN users u ON u.full_name = o.customer_name
SET o.user_id = u.id
WHERE o.user_id IS NULL;
