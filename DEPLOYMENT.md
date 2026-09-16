# Panduan Deployment Cloudflare — Embun Laundry

Dokumen ini menjelaskan alur deployment aplikasi **Embun Laundry** ke platform **Cloudflare Workers & Static Assets** dengan integrasi database **TiDB Cloud Serverless**.

---

## 1. Arsitektur Deployment

Aplikasi menggunakan arsitektur Cloudflare Workers modern dengan asset binding:
- **Frontend / Static Assets**: Terletak di folder `public/` (HTML, CSS, JS Vanilla, p5.js canvas, gambar ilustrasi). Dilayani langsung oleh Cloudflare edge cache.
- **Worker Dispatcher**: Entrypoint `src/index.js` mengorkestrasi rute API, menyuntikkan security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`), serta meneruskan request static asset ke `env.ASSETS`.
- **Backend API (Serverless)**: Terletak di folder `functions/api/`, dipanggil oleh dispatcher secara modular.
- **Database**: Terhubung ke **TiDB Cloud Serverless** via protokol stateless HTTP fetch (`@tidbcloud/serverless`), bebas dari masalah koneksi TCP pool di edge.

---

## 2. Manajemen Secrets & Environment Variables

> [!IMPORTANT]
> Sesuai Aturan Keamanan, secret sensitif (`TIDB_DATABASE_URL` dan `JWT_SECRET`) **tidak boleh diletakkan di `wrangler.toml`** dalam bentuk plaintext.

### 2.1 Konfigurasi Produksi / Staging (Cloudflare Secret Store)
Gunakan Wrangler CLI untuk menyimpan secret secara terenkripsi:

```bash
# 1. Simpan URL koneksi TiDB Cloud
npx wrangler secret put TIDB_DATABASE_URL
# Masukkan nilai string koneksi (contoh: mysql://user:pass@gateway01.../embun_laundry?ssl={"rejectUnauthorized":true})

# 2. Simpan kunci JWT Secret (minimal 32 karakter acak)
npx wrangler secret put JWT_SECRET
```

Variabel publik non-sensitif didefinisikan dalam `wrangler.toml`:
```toml
[vars]
TIDB_DATABASE = "embun_laundry"
```

### 2.2 Konfigurasi Pengembangan Lokal (`.dev.vars`)
Untuk eksekusi lokal (`npx wrangler dev`), buat file `.dev.vars`:
```env
TIDB_DATABASE_URL=mysql://<user>:<password>@<host>/embun_laundry?ssl={"rejectUnauthorized":true}
JWT_SECRET=rahasia_kunci_jwt_lokal_minimal_32_karakter
```
File `.dev.vars` telah diabaikan oleh git (`.gitignore`) guna mencegah kebocoran kredensial.

---

## 3. Alur Verifikasi Sebelum Deploy

Sebelum merilis perubahan ke server produksi, jalankan suite pengujian otomatis untuk memastikan tidak ada regresi fungsional atau kebocoran keamanan:

```bash
bash tools/run_all_verifiers.sh
```
Pastikan seluruh 43 verification suites berstatus **HIJAU 100% (exit 0)**.

Lakukan validasi bundel dengan dry-run:
```bash
npx wrangler deploy --dry-run
```

---

## 4. Eksekusi Deployment

### Cara 1: Deploy Langsung via Wrangler CLI (Direkomendasikan)
```bash
# 1. Login ke akun Cloudflare (jika belum)
npx wrangler login

# 2. Deploy worker dan seluruh aset statis
npx wrangler deploy
```

Output terminal akan menampilkan URL publik:
```
Uploaded 28 files (X.XX sec)
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded embun-laundry (X.XX sec)
Deployed embun-laundry triggers
  https://embun-laundry.<subdomain>.workers.dev
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Cara 2: Integrasi Otomatis via GitHub Actions / Cloudflare Git Connect
Jika repositori dihubungkan langsung ke Cloudflare:
1. Hubungkan repository GitHub `Dhani078/Embun-Laundry`.
2. Pengaturan Environment Variables pada Dashboard Cloudflare:
   - `TIDB_DATABASE_URL` (Tipe: Encrypted / Secret)
   - `JWT_SECRET` (Tipe: Encrypted / Secret)
3. Setiap push ke branch `main` akan memicu build & deploy secara otomatis.

---

## 5. Pemeriksaan Pasca-Deployment (Post-Deploy Sanity Check)

Verifikasi kesehatan endpoint utama setelah proses deployment selesai:

1. **Liveness Check**:
   ```bash
   curl -i https://embun-laundry.<subdomain>.workers.dev/api/health
   # Respons: HTTP 200 OK {"ok":true,"status":"healthy",...}
   ```
2. **Katalog Layanan (Edge Cache Check)**:
   ```bash
   curl -i https://embun-laundry.<subdomain>.workers.dev/api/services
   # Respons: HTTP 200 OK {"ok":true,"services":[...]}
   # Header: cache-control: public, s-maxage=300
   ```
3. **Security Headers Check**:
   Periksa keberadaan header keamanan pada landing page:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: SAMEORIGIN`
   - `Referrer-Policy: strict-origin-when-cross-origin`
