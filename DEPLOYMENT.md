# Panduan Deployment Cloudflare Pages

Panduan ini memandu proses deploy aplikasi **Embun Laundry** ke **Cloudflare Pages** secara otomatis ataupun manual menggunakan Wrangler CLI.

---

## 1. Arsitektur Proyek
- **Frontend / Static Assets**: Terletak di folder `public/` (berisi HTML, CSS, JS, Gambar, Ikon).
- **Backend API (Serverless)**: Terletak di folder `functions/` (Cloudflare Pages Functions).
- **Driver Database**: `@tidbcloud/serverless` untuk koneksi langsung dari Cloudflare Edge ke TiDB Cloud melalui HTTP Fetch.

---

## 2. Persiapan Environment Variables
Di Cloudflare Pages Dashboard, buka menu **Settings > Environment Variables**, tambahkan:

| Variable Name | Contoh Nilai | Keterangan |
| :--- | :--- | :--- |
| `TIDB_DATABASE_URL` | `mysql://user:pass@gateway01...` | URL koneksi TiDB Cloud Serverless |
| `JWT_SECRET` | `secret-kunci-enkripsi-anda` | Kunci tanda tangan token otentikasi session |

---

## 3. Deploy via GitHub Integration (Rekomendasi)
1. Push repository ke GitHub: `https://github.com/Dhani078/Embun-Laundry`
2. Buka dashboard [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages**.
3. Klik **Create application** > Tab **Pages** > **Connect to Git**.
4. Pilih repository `Dhani078/Embun-Laundry`.
5. Pengaturan Build:
   - **Framework preset**: `None`
   - **Build command**: `npm install`
   - **Build output directory**: `public`
6. Masukkan Environment Variable `TIDB_DATABASE_URL` dan `JWT_SECRET`.
7. Klik **Save and Deploy**.

---

## 4. Deploy Manual via Wrangler CLI
Jika ingin melakukan deploy langsung dari terminal komputer:

```bash
# 1. Pastikan dependencies terpasang
npm install

# 2. Login ke akun Cloudflare
npx wrangler login

# 3. Deploy ke Cloudflare Pages
npx wrangler pages deploy public --project-name dhani-laundry
```

Atau jika menggunakan `wrangler.toml`:
```bash
npx wrangler deploy
```

---

## 5. Mengapa Tidak Muncul Error "Could not detect static files"?
Pesan error sebelumnya:
```
✘ [ERROR] Could not detect a directory containing static files (e.g. html, css and js) for the project
```
Terjadi karena repository awal hanya berisi file script PHP tanpa folder keluaran statis. Sekarang aplikasi telah distrukturkan dengan:
1. `pages_build_output_dir = "public"` pada `wrangler.toml`.
2. Folder `public/` yang lengkap berisi `index.html`, `app.js`, `pay.html`, aset `style.css`, serta gambar logo.
3. Pages Functions di folder `functions/` yang secara otomatis dipadukan oleh Cloudflare Pages saat deploy.
