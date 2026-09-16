# Dokumentasi REST API Serverless — Embun Laundry

Backend Embun Laundry berjalan di atas **Cloudflare Edge Runtime (Workers & Pages Functions)** dan berkomunikasi secara stateless dengan database **TiDB Cloud Serverless** menggunakan `@tidbcloud/serverless`.

---

## 1. Konvensi Umum & Arsitektur

- **Base URL**: `/api/*`
- **Format Pertukaran Data**: `application/json; charset=utf-8`
- **Format Respons Sukses**: `{ "ok": true, ... }`
- **Format Respons Error**: `{ "ok": false, "error": "Pesan error aman / generik" }`
- **CORS Policy**: Ketat same-origin (`functions/_cors.js`). Setiap endpoint menangani preflight `OPTIONS` secara otomatis dengan header `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, dan `Vary: Origin`.
- **Autentikasi Sesi**: Token JWT berbasis cookie `HttpOnly; Secure; SameSite=Lax`. Token ditandatangani menggunakan kunci simetris `JWT_SECRET`.
- **Pencabutan Sesi Instan**: Setiap token JWT memuat `session_version`. Saat user mengganti password atau sesi dicabut, `session_version` di database dinaikkan, membatalkan token aktif sebelumnya seketika.
- **Keamanan Input & Database**: Semua kueri SQL menggunakan parameterized queries (`execute(query, [params])`). Input disanitasi terhadap bahaya Stored XSS dan SQL Injection.

---

## 2. Matriks Hak Akses (Role-Based Access Control / RBAC)

| Endpoint | Publik | Customer | Staff | Admin / Owner | Keterangan |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `POST /api/auth/login` | ✅ | ✅ | ✅ | ✅ | Rate limited (5 percobaan / 5 menit) |
| `POST /api/auth/register` | ✅ | - | - | - | Khusus registrasi akun Customer baru |
| `POST /api/auth/refresh` | ❌ | ✅ | ✅ | ✅ | Refresh session token |
| `POST /api/auth/logout` | ❌ | ✅ | ✅ | ✅ | Hapus session cookie |
| `GET /api/me` | ❌ | ✅ | ✅ | ✅ | Informasi identitas user aktif |
| `GET /api/health` | ✅ | ✅ | ✅ | ✅ | Liveness probe tanpa beban kueri database |
| `GET /api/services` | ✅ | ✅ | ✅ | ✅ | Edge cached (TTL 5 menit) |
| `POST /api/services` | ❌ | ❌ | ✅ | ✅ | Kelola master layanan & tarif |
| `GET /api/track` | ✅ | ✅ | ✅ | ✅ | Pelacakan pesanan publik by order_code |
| `GET /api/notifications` | ✅ | ✅ | ✅ | ✅ | Polling status order (rate limit: 30 req / 5m) |
| `GET /api/orders` | ❌ | ✅ (Data Sendiri) | ✅ (Semua) | ✅ (Semua) | Filter IDOR berbasis `user_id` |
| `POST /api/orders` | ❌ | ✅ (`create_order`) | ✅ (Semua) | ✅ (Semua) | Pelanggan tidak bisa mengubah harga/diskon |
| `GET /api/pay` | ❌ | ✅ (Data Sendiri) | ✅ (Semua) | ✅ (Semua) | Generate QRIS dinamis & info transfer |
| `POST /api/pay` | ❌ | ✅ (Data Sendiri) | ✅ (Semua) | ✅ (Semua) | Bayar aman (idempotency key & batas sisa tagihan) |
| `GET /api/customers` | ❌ | ❌ | ✅ | ✅ | Daftar & histori agregat pelanggan |
| `POST /api/customers` | ❌ | ❌ | ✅ | ✅ | CRUD pelanggan |
| `GET /api/delivery` | ❌ | ❌ | ✅ | ✅ | Tugas antar jemput & kurir (WIB) |
| `POST /api/delivery` | ❌ | ❌ | ✅ | ✅ | Penjadwalan tugas antar jemput |
| `GET /api/promos` | ✅ | ✅ | ✅ | ✅ | Katalog promo aktif |
| `POST /api/promos` | ❌ | ❌ | ✅ | ✅ | Master data promo |
| `GET /api/vouchers` | ❌ | ✅ (Milik Sendiri) | ✅ (Semua) | ✅ (Semua) | Daftar voucher aktif & terpakai |
| `POST /api/vouchers` | ❌ | ✅ (`claim`) | ✅ (Semua) | ✅ (Semua) | Klaim atau penerbitan voucher |
| `GET /api/reports` | ❌ | ❌ (403) | ✅ | ✅ | Rekap omset, performa harian & grafik |
| `GET /api/profile` | ❌ | ✅ | ✅ | ✅ | Detail profil user |
| `POST /api/profile` | ❌ | ✅ | ✅ | ✅ | Update identitas & ubah sandi (verifikasi sandi lama) |
| `GET /api/checkin` | ❌ | ✅ | ✅ | ✅ | Status streak check-in harian (WIB) |
| `POST /api/checkin` | ❌ | ✅ | ✅ | ✅ | Klaim reward check-in harian |

---

## 3. Spesifikasi Detail Endpoint

### 3.1 Autentikasi (`/api/auth/*`)

#### `POST /api/auth/login`
Autentikasi akun pengguna dengan verifikasi hash PBKDF2 (10.000 iterasi SHA-256).
- **Proteksi**: Rate limited (maksimal 5 kali salah per IP dalam 5 menit).
- **Request Body**:
  ```json
  {
    "identity": "admin@embunlaundry.id",
    "password": "sandi_rahasia"
  }
  ```
- **Respons (200 OK)**:
  ```json
  {
    "ok": true,
    "user": {
      "id": 1,
      "full_name": "Admin Laundry",
      "email": "admin@embunlaundry.id",
      "role": "Admin"
    }
  }
  ```
- **Header**: `Set-Cookie: session=<JWT>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`

#### `POST /api/auth/register`
Pendaftaran mandiri akun pelanggan baru.
- **Request Body**:
  ```json
  {
    "full_name": "Budi Santoso",
    "email": "budi@example.com",
    "phone": "081234567890",
    "password": "Password123!",
    "confirm": "Password123!",
    "agree": true
  }
  ```
- **Respons (200 OK)**:
  ```json
  {
    "ok": true,
    "user": {
      "id": 15,
      "full_name": "Budi Santoso",
      "email": "budi@example.com",
      "role": "Customer"
    }
  }
  ```

#### `POST /api/auth/logout`
Menghapus sesi login dan mereset cookie session.
- **Respons (200 OK)**: `{ "ok": true }`

#### `GET /api/me`
Mengembalikan identitas user dari cookie session aktif.
- **Respons (200 OK)**: `{ "ok": true, "user": { "id": 1, "full_name": "...", "role": "..." } }`

---

### 3.2 Sistem & Health (`/api/health`)

#### `GET /api/health`
Endpoint liveness probe cepat untuk memverifikasi kesiapan worker tanpa membebani koneksi TiDB.
- **Respons (200 OK)**:
  ```json
  {
    "ok": true,
    "status": "healthy",
    "timestamp": 1726470000000
  }
  ```

---

### 3.3 Layanan & Tarif (`/api/services`)

#### `GET /api/services`
Mengambil katalog layanan aktif. Respons di-cache di edge selama 5 menit (`Cache-Control: public, s-maxage=300`).
- **Respons (200 OK)**:
  ```json
  {
    "ok": true,
    "services": [
      {
        "id": 1,
        "name": "Cuci Kering Reguler",
        "price": 20000,
        "unit": "kg",
        "duration_hours": 24,
        "category": "Reguler",
        "is_popular": 1,
        "is_active": 1
      }
    ]
  }
  ```

#### `POST /api/services` (Staff / Admin)
- Actions:
  - `create_service`: Tambah layanan baru (`name`, `price`, `unit`, `duration_hours`, `category`).
  - `update_service`: Ubah data layanan (`id`, `name`, `price`, `duration_hours`, dll).
  - `toggle_active`: Toggle status aktif/non-aktif (`id`).
  - `delete_service`: Hapus layanan (`id`).

---

### 3.4 Pelacakan & Notifikasi Real-time

#### `GET /api/track`
Pelacakan pesanan publik tanpa login berdasarkan kode nota.
- **Query Parameter**: `?code=ORD-20260916-001`
- **Respons (200 OK)**:
  ```json
  {
    "ok": true,
    "order": {
      "order_code": "ORD-20260916-001",
      "service_name": "Cuci Kering Reguler",
      "status": "proses",
      "weight_kg": 3,
      "total_amount": 60000,
      "paid_amount": 60000,
      "payment_status": "paid",
      "created_at": "2026-09-16 10:00:00",
      "timeline": [
        { "status": "baru", "time": "2026-09-16 10:00:00", "desc": "Pesanan diterima" },
        { "status": "proses", "time": "2026-09-16 11:30:00", "desc": "Pencucian & pengeringan" }
      ]
    }
  }
  ```

#### `GET /api/notifications`
Polling real-time untuk status notifikasi pesanan pelanggan.
- **Query Parameter**: `?order_code=ORD-20260916-001` *(wajib)*
- **Rate Limit**: Maksimal 30 request per 5 menit per IP.
- **Respons (200 OK)**:
  ```json
  {
    "ok": true,
    "notifications": [
      {
        "id": 12,
        "order_code": "ORD-20260916-001",
        "message": "Pesanan Anda telah selesai dicuci dan siap diambil.",
        "status": "selesai",
        "created_at": "2026-09-16 14:00:00"
      }
    ]
  }
  ```

---

### 3.5 Manajemen Pesanan (`/api/orders`)

#### `GET /api/orders`
Mengambil daftar pesanan. Pelanggan hanya menerima pesanan miliknya (`user_id = token.id`), sedangkan staf/admin dapat melihat seluruh pesanan.
- **Query Parameters**: `q` (pencarian), `status` (baru/proses/selesai/batal), `start`, `end`.

#### `POST /api/orders`
- **Action `create_order`**:
  - Pelanggan membuat order: Harga dan diskon dihitung secara otoritatif di sisi server berdasarkan `service_id` dan voucher aktif di database, mencegah manipulasi harga dari client (B19).
- **Action `move_status`**:
  - Khusus Staf: Mengubah status pengerjaan pesanan (`baru` → `proses` → `selesai` → `batal`).
- **Action `update_order`**:
  - Khusus Staf: Memperbarui rincian berat, layanan, atau catatan.
- **Action `delete_order`**:
  - Khusus Admin/Staf: Menghapus pesanan.

---

### 3.6 Pembayaran & Invoice (`/api/pay`)

#### `GET /api/pay`
Mengambil payload QRIS dinamis dan rincian invoice pesanan.
- **Query Parameter**: `?code=ORD-20260916-001`
- **Respons (200 OK)**:
  ```json
  {
    "ok": true,
    "order": {
      "order_code": "ORD-20260916-001",
      "total_amount": 60000,
      "paid_amount": 0,
      "unpaid_amount": 60000,
      "payment_status": "unpaid"
    },
    "qr_payload": "00020101021226590014ID.LINKAJA.WWW011893600914000000000002...",
    "bank_transfer": {
      "bank": "BCA",
      "account_number": "1234567890",
      "account_name": "Embun Laundry"
    }
  }
  ```

#### `POST /api/pay`
Melakukan pembayaran atau konfirmasi transfer. Wajib menyertakan sesi login (B17).
- **Proteksi Idempotency**: Kolom `idempotency_key` mencegah eksekusi ganda jika tombol diklik berulang kali atau terjadi masalah jaringan.
- **Proteksi Overpayment**: Jumlah pembayaran dibatasi maksimal sisa tagihan yang belum lunas (B20).
- **Sinkronisasi Otomatis**: Secara atomik memperbarui tabel `payments` dan menyinkronkan `paid_amount` serta `payment_status` (`paid`/`partial`) pada tabel `orders`.
- **Request Body (Pembayaran QRIS / Tunai)**:
  ```json
  {
    "order_code": "ORD-20260916-001",
    "method": "QRIS",
    "amount": 60000,
    "idempotency_key": "pay-uuid-v4-random-string"
  }
  ```
- **Request Body (Upload Bukti Transfer Bank / E-Wallet - C4)**:
  ```json
  {
    "action": "upload_proof",
    "order_code": "ORD-20260916-001",
    "method": "TRANSFER",
    "amount": 60000,
    "proof_image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  }
  ```

---

### 3.7 Promo & Voucher (`/api/promos` & `/api/vouchers`)

#### `GET /api/promos`
Katalog promo diskon. Mendukung filter `?q=...`, `?active=1`, `?id=...`.
#### `POST /api/promos` (Staff / Admin)
Actions: `create_promo`, `update_promo`, `toggle_active`, `delete_promo`.
#### `GET /api/vouchers`
Mengambil voucher aktif milik pengguna.
#### `POST /api/vouchers`
- `action: "claim"`: Klaim promo code menjadi voucher personal pengguna.
- `action: "grant"` / `bulk_grant`: Staf menerbitkan voucher ke satu atau banyak pelanggan.
- `action: "delete"`: Hapus/cabut voucher.

---

### 3.8 Laporan & Analitika Finansial (`/api/reports`)

#### `GET /api/reports` (Staff / Admin Only)
Akses oleh peran `Customer` akan menghasilkan respons `403 Forbidden` (B11).
- **Query Parameters**:
  - `group`: `hari` (default), `minggu`, `bulan`
  - `start`: Format `YYYY-MM-DD`
  - `end`: Format `YYYY-MM-DD`
- **Respons (200 OK)**:
  ```json
  {
    "ok": true,
    "kpi": {
      "total_revenue": 14500000,
      "unpaid_revenue": 850000,
      "total_orders": 245,
      "completed_orders": 230
    },
    "chart": [
      { "period": "2026-09-01", "revenue": 450000, "orders": 12 },
      { "period": "2026-09-02", "revenue": 520000, "orders": 14 }
    ],
    "daily_details": [...]
  }
  ```

---

### 3.9 Profil & Keamanan Pengguna (`/api/profile`)

#### `GET /api/profile`
Mengambil rincian akun profil yang sedang login.
#### `POST /api/profile`
- Update informasi personal: `full_name`, `phone`.
- Ganti password: Mengirim `old_password`, `new_password`, `confirm_password`. Password lama diverifikasi menggunakan WebCrypto PBKDF2 sebelum diubah ke hash baru.

---

### 3.10 Check-in Harian (`/api/checkin`)

#### `GET /api/checkin`
Memeriksa status check-in hari ini berbasis zona waktu Indonesia Barat (`Asia/Jakarta`).
#### `POST /api/checkin`
Klaim reward harian (poin loyalitas & voucher otomatis setiap kelipatan 7 hari berturut-turut).
