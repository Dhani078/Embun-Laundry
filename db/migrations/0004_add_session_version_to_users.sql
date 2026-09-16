-- db/migrations/0004_add_session_version_to_users.sql
-- Fase 0.9 (K7): Pencabutan sesi & refresh token via versi sesi per pengguna.
--
-- CARA ROLLBACK:
-- ALTER TABLE users DROP COLUMN session_version;

-- 1. Tambah kolom session_version INT NOT NULL DEFAULT 1 ke tabel users
ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 1 AFTER role;
