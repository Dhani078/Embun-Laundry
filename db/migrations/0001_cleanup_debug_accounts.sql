-- db/migrations/0001_cleanup_debug_accounts.sql
-- Fase 0.2: Hapus baris debug dan akun uji dari basis data produksi.
--
-- CARA ROLLBACK:
-- Baris debug tidak boleh dipulihkan di lingkungan produksi. Jika diperlukan untuk pengujian lokal,
-- gunakan fixture uji deterministik db/seed.sql (Fase 1.6).

-- 1. Hapus baris debug plaintext 'testhash' yang terdeteksi di database
DELETE FROM users WHERE password_hash = 'testhash';

-- 2. Hapus akun probe / pengujian otomatis yang mungkin tertinggal
DELETE FROM users WHERE email LIKE '%probe%@%' OR email LIKE '%test%@%';

-- 3. Panduan rotasi sandi untuk akun bawaan di produksi:
-- Jalankan perintah node untuk membuat hash PBKDF2 baru dengan salt acak:
-- node -e "import('./functions/_password.js').then(m => m.hashPassword('SandiBaruKuat123!')).then(console.log)"
--
-- Kemudian update di TiDB Cloud Console:
-- UPDATE users SET password_hash = '<HASH_PBKDF2_BARU>' WHERE email = 'admin@gmail.com';
-- UPDATE users SET password_hash = '<HASH_PBKDF2_BARU>' WHERE email = 'staff@gmail.com';
-- UPDATE users SET password_hash = '<HASH_PBKDF2_BARU>' WHERE email = 'user@gmail.com';
