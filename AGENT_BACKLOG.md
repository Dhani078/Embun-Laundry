# AGENT BACKLOG

Task terurut prioritas. Tandai `[x]` jika selesai, catat commit hash.

Sumber kebenaran utama: `AGENT24.md` Bagian 7.
File ini adalah **working copy** yang diupdate setiap tick.

---

## FASE A — Fondasi & Stabilitas

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| A1 | Link `design-tokens.css` ke `index.html` + `dashboard.html` + `auth/*.html` | P1 | [x] | `21a94ea` |
| A2 | Link `hero-canvas.js` (p5.js CDN) + container `#hero-canvas-container` | P2 | [x] | `23e3fe2` |
| A3 | Migrasi hardcoded color `index.html` → token | P2 | [x] | `796e81e` |
| A3b | Token baru untuk 9 warna sisa (`#94a3b8` `#f8fafc` `#64748b` `#1e293b` `#090d16` `#f59e0b` `#ef4444`) | P2 | [x] | `f782d3d` |
| A4 | Semua API `try/catch` → respons JSON `{ok}` konsisten | P1 | [x] | `c07ed88` |
| A5 | Tambah endpoint `/api/health` (tanpa DB) | P1 | [x] | `d6cea6a` |
| A6 | Pindahkan secret dari `wrangler.toml` ke `wrangler secret` | **P0** | [ ] | — |
| A7 | Verifikasi 14 endpoint terdaftar di `src/index.js` | P1 | [x] | (verifikasi) |
| A8 | `robots.txt` + favicon + meta description/OG tags | P3 | [x] | `a502402` |

---

## FASE B — Keamanan

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| B1 | Rate limit `/api/auth/login` (in-memory per-IP) | P1 | [x] | `9981427` `ea05b75` |
| B2 | Validasi & sanitasi input server-side | P1 | [ ] | — |
| B3 | JWT secret dari `env.JWT_SECRET`, bukan hardcoded | **P0** | [ ] | — |
| B4 | Header: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | P1 | [x] | `9632507` |
| B5 | CORS ketat (hanya origin sendiri) | P1 | [ ] | — |
| B6 | Cookie `HttpOnly; Secure; SameSite=Lax` | **P0** | [x] | (sudah benar) |
| B7 | Audit SQL injection (parameterized only) | **P0** | [x] | `ea05d42` |
| B8 | Migrasi hash → PBKDF2 via WebCrypto | P2 | [ ] | — |

---

## FASE C — Fitur Inti

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| C1 | Halaman "Layanan" publik + filter | P2 | [ ] | — |
| C2 | Tracking order publik by kode (tanpa login) | P2 | [ ] | — |
| C3 | Notifikasi real-time status (polling) | P2 | [ ] | — |
| C4 | Upload bukti pembayaran (R2 / base64 kecil) | P3 | [ ] | — |
| C5 | Invoice PDF (client-side / print CSS) | P3 | [ ] | — |
| C6 | Riwayat order pelanggan + filter tanggal | P2 | [ ] | — |
| C7 | Manajemen voucher & promo (admin) | P2 | [ ] | — |
| C8 | Laporan bulanan + chart | P2 | [ ] | — |
| C9 | Service worker (offline dasar) | P3 | [ ] | — |
| C10 | Multi-bahasa ID/EN | P4 | [ ] | — |

---

## FASE D — Desain & UX

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| D1 | Terapkan design token ke seluruh dashboard | P3 | [ ] | — |
| D2 | Dark mode toggle (localStorage) | P3 | [ ] | — |
| D3 | Skeleton loading di semua tabel | P3 | [ ] | — |
| D4 | Empty state bermakna di setiap list | P3 | [ ] | — |
| D5 | Toast notification global (ganti alert) | P3 | [ ] | — |
| D6 | Micro-interaction konsisten (hover/focus/active) | P3 | [ ] | — |
| D7 | Responsive audit 360/768/1024/1440px | P3 | [ ] | — |
| D8 | Animasi masuk (IntersectionObserver) | P3 | [ ] | — |
| D9 | Finalisasi p5.js hero (droplet + ripple) | P3 | [ ] | — |

---

## FASE E — Performa & Observability

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| E1 | Cache `/api/services` di edge (TTL 5m) | P3 | [ ] | — |
| E2 | Lazy load gambar non-kritis | P3 | [ ] | — |
| E3 | Preconnect/preload font kritis | P3 | [ ] | — |
| E4 | Minifikasi CSS/JS saat build | P4 | [ ] | — |
| E5 | Logging terstruktur (dev only) | P3 | [ ] | — |
| E6 | Error boundary global SPA | P3 | [ ] | — |

---

## FASE F — Dokumentasi

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| F1 | Update `README.md` (arsitektur final) | P4 | [ ] | — |
| F2 | Lengkapi `API_DOCUMENTATION.md` | P4 | [ ] | — |
| F3 | `DATABASE_SCHEMA.md` sinkron TiDB aktual | P4 | [ ] | — |
| F4 | `CONTRIBUTING.md` + panduan dev lokal | P4 | [ ] | — |

---

## Prioritas Mutlak (kerjakan ini dulu)

1. **A6** — Secret di `wrangler.toml` (P0, keamanan) — TERBLOKIR, butuh
   Cloudflare API token
2. **B7** — Audit SQL injection (P0) — **SELESAI** `ea05d42`: 67 SQL
   literal diaudit, 0 interpolasi nilai user, 2 modul di-hardening.
   Alat: `tools/audit_sql_injection.py` (statik) + `tools/verify_b7_run.mjs`
   (runtime, canary). Jangan dikerjakan ulang.
3. **B1** — Rate limit `/api/auth/login` (P1)
4. **B2** — Validasi & sanitasi input server-side (P1)
5. **B5** — CORS ketat, hanya origin sendiri (P1) — catatan: `jsonResponse`
   masih mengirim `Access-Control-Allow-Origin: *`; A4 memperbaiki preflight
   tapi tidak mempersempit origin. Ini bagian B5, belum dikerjakan.
6. **B1** — Rate limit `/api/auth/login` (P1)
7. **B2** — Validasi & sanitasi input server-side (P1)
8. **B5** — CORS ketat (P1) — `Access-Control-Allow-Origin: *` masih ada di
   `/api/*`; A4 memperbaiki preflight tapi tidak mempersempit origin
9. **A3b** — Token baru untuk 9 warna sisa (P2)

### Status FASE A

Selesai: A1, A2, A3, **A3b**, A4, A5, A7, A8. Tersisa: **A6** (P0, terblokir
butuh Cloudflare API token).

> **B4 SELESAI (jangan diulang).** Header keamanan kini aktif di `/`,
> `/robots.txt`, `/dashboard`, dan `/api/*` (masing-masing 2 header terverifikasi).
> Mekanismenya DUA jalur:
> - **Aset statis** → `public/_headers` (native Cloudflare).
> - **`/api/*`** → `withSecurityHeaders()` di `src/index.js`.
>
> **JEBATAN YANG SUDAH DIBUKTIKAN (jangan coba lagi):**
> 1. `withSecurityHeaders()` TIDAK berlaku untuk aset statis — dengan
>    konfigurasi `[assets]` bawaan, Cloudflare menyajikan aset **SEBELUM**
>    Worker dijalankan. Kode tidak pernah dieksekusi (`CF-Cache-Status: HIT`,
>    nol header kustom).
> 2. `run_worker_first = true` MEMANG memasang header, tapi **merusak `/` dan
>    `/dashboard` menjadi 404**. Sudah di-rollback ke `false`.
> 3. Rebuild `new Response(body, {headers})` di JS juga tidak menolong, karena
>    akar masalahnya adalah Worker yang tidak dipanggil, bukan response beku.
>
> Jadi: untuk header aset statis, satu-satunya jalur yang benar adalah
> **`public/_headers`**. Jangan "memperbaiki" ini lewat kode Worker.

> Setelah semua P0 selesai, lanjut ke P1 berurutan.
> Jangan kerjakan P2/P3 sebelum P0/P1 tuntas.
