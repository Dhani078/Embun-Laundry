-- db/migrations/0005_create_notifications_table.sql
-- Fase C3: Notifikasi real-time status pesanan (polling)
--
-- CARA ROLLBACK:
-- DROP TABLE IF EXISTS notifications;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'baru',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_order_code (order_code),
  INDEX idx_notifications_created_at (created_at)
);
