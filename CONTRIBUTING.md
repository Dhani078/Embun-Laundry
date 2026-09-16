# Panduan Kontribusi — Embun Laundry

Terima kasih atas minat Anda untuk berkontribusi pada pengembangan sistem **Embun Laundry**. Dokumen ini memuat panduan lingkungan pengembangan lokal, standar arsitektur, konvensi penulisan kode, serta protokol keamanan yang wajib ditaati.

---

## 1. Filosofi Proyek

1. **Lightweight & Efisien**: Tidak ada dead code, tidak ada dependensi berlebih (zero-bloat). Seluruh backend berjalan di atas serverless worker edge yang ramping.
2. **Estetika Visual Maksimal**: UI dibangun dengan presisi tinggi menggunakan prinsip Glassmorphism, animasi mikro yang responsif, dan palet warna terstandarisasi melalui [design-tokens.css](file:///c:/xampp/htdocs/embun-laundry/public/assets/design-tokens.css).
3. **Keamanan Sebagai Prioritas Utama**: Tidak ada kompromi pada aspek keamanan. Setiap rute diproteksi dengan RBAC, parameterized queries, sanitasi XSS, proteksi IDOR, dan audit regresi otomatis.

---

## 2. Memulai Lingkungan Pengembangan Lokal

### 2.1 Prasyarat
- **Node.js**: Versi LTS 18.x atau 20.x.
- **Wrangler CLI**: `npx wrangler` terpasang secara lokal atau global.
- **Git Bash** (khusus pengguna Windows) untuk menjalankan runner shell script verifikasi.

### 2.2 Langkah Setup
1. **Clone repository**:
   ```bash
   git clone https://github.com/Dhani078/Embun-Laundry.git
   cd embun-laundry
   ```
2. **Pasang dependensi**:
   ```bash
   npm install
   ```
3. **Konfigurasi Environment Variable**:
   Salin template `.dev.vars.example` menjadi `.dev.vars`:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
   Isi koneksi TiDB Cloud dan kunci rahasia JWT lokal:
   ```env
   TIDB_DATABASE_URL=mysql://<user>:<password>@<host>/embun_laundry?ssl={"rejectUnauthorized":true}
   JWT_SECRET=kunci_rahasia_lokal_pengujian_dev_32char
   ```
4. **Jalankan Server Lokal**:
   ```bash
   npx wrangler dev
   ```
   Server dev lokal akan aktif pada `http://localhost:8787`.

---

## 3. Standar Penulisan Kode & Arsitektur

### 3.1 Styling & Desain Token
- **Dilarang hardcode warna**: Gunakan variabel CSS dari `public/assets/design-tokens.css` (contoh: `var(--color-brand)`, `var(--bg-glass)`, `var(--radius-md)`).
- **Aksesibilitas**: Selalu sediakan fallback `@media (prefers-reduced-motion: reduce)` pada elemen visual yang bergerak atau beranimasi.
- **Efisiensi Viewport**: Animasi kanvas atau grafis berat wajib menggunakan `IntersectionObserver` untuk mem-pause loop saat elemen tidak terlihat di layar.

### 3.2 Backend & Penanganan Database
- **Parameterized Queries**: Selalu gunakan query berparameter:
  ```javascript
  // BENAR
  await db.execute('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);

  // DILARANG KERAS (SQL Injection vulnerability)
  await db.execute(`SELECT * FROM orders WHERE id = ${orderId}`);
  ```
- **Error Handling**: Tangani blok `try/catch` di semua handler. Kembalikan pesan error generik yang aman ke klien, jangan pernah membocorkan stack trace mentah atau pesan error internal TiDB (`e.message`).
- **CORS Ketat**: Selalu sertakan helper `handleCors(request)` dari `functions/_cors.js` dan ekspor `onRequestOptions`.

### 3.3 Alur Migrasi Database
- **Immutability**: Jangan pernah mengubah file migrasi lama yang telah dirilis ke produksi.
- **Migrasi Baru**: Buat file migrasi baru di direktori `db/migrations/` dengan format penamaan berurut:
  `XXXX_deskripsi_singkat.sql` (contoh: `0007_add_courier_notes.sql`).
- Sertakan komentar instruksi rollback di dalam file migrasi.
- Sinkronkan DDL pada [DATABASE_SCHEMA.md](file:///c:/xampp/htdocs/embun-laundry/DATABASE_SCHEMA.md) dan [TIDB_SETUP.md](file:///c:/xampp/htdocs/embun-laundry/TIDB_SETUP.md).

---

## 4. Protokol Pengujian & Harness Verifikasi

Setiap perubahan kode **wajib** lolos 43 verification suites tanpa regresi sebelum diajukan ke branch utama:

```bash
# Jalankan seluruh rangkaian tes otomatis
bash tools/run_all_verifiers.sh
```

Jika Anda menambahkan fitur baru atau memperbaiki celah keamanan:
1. Buat harness pengujian baru di folder `tools/verify_<nama_task>.mjs`.
2. Sediakan pembungkus eksekusi `tools/verify_<nama_task>_run.mjs` yang mandiri (tanpa dependensi eksternal).
3. Daftarkan file verifier tersebut ke `tools/run_all_verifiers.sh`.

---

## 5. Standar Commit & Pull Request

Gunakan konvensi commit yang jelas:
- `feat:` Penambahan fitur baru (contoh: `feat: integrasi upload bukti pembayaran`)
- `fix:` Perbaikan bug atau celah keamanan (contoh: `fix: cegah overpayment pada transaksi kasir`)
- `refactor:` Restrukturisasi kode tanpa mengubah fungsionalitas (contoh: `refactor: optimasi IntersectionObserver canvas`)
- `docs:` Pembaruan dokumentasi (contoh: `docs: perbarui spesifikasi REST API`)
- `test:` Penambahan atau penyempurnaan suite pengujian otomatis
