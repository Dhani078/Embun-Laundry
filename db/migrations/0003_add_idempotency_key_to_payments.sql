-- db/migrations/0003_add_idempotency_key_to_payments.sql
-- Fase 0.7 (K5): Tambah kolom idempotency_key UNIQUE pada tabel payments untuk mencegah pembayaran ganda / race condition.
--
-- CARA ROLLBACK:
-- ALTER TABLE payments DROP INDEX uq_payments_idempotency_key;
-- ALTER TABLE payments DROP COLUMN idempotency_key;

-- 1. Tambah kolom idempotency_key VARCHAR(64) NULL ke tabel payments
ALTER TABLE payments ADD COLUMN idempotency_key VARCHAR(64) NULL AFTER id;

-- 2. Tambah unique index untuk memastikan setiap idempotency key hanya tercatat sekali
ALTER TABLE payments ADD UNIQUE INDEX uq_payments_idempotency_key (idempotency_key);
