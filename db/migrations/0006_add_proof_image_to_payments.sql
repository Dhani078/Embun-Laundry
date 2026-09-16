-- db/migrations/0006_add_proof_image_to_payments.sql
-- Task C4: Menambahkan kolom proof_image untuk bukti pembayaran (transfer bank / e-wallet)

ALTER TABLE payments
  ADD COLUMN proof_image MEDIUMTEXT NULL AFTER qr_payload;

-- ROLLBACK:
-- ALTER TABLE payments DROP COLUMN proof_image;
