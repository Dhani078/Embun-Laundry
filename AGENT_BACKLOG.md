# AGENT BACKLOG

Task terurut prioritas. Tandai `[x]` jika selesai, catat commit hash.

Sumber kebenaran utama: `AGENT24.md` Bagian 7.
File ini adalah **working copy** yang diupdate setiap tick.

---

## FASE A — Fondasi & Stabilitas

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| A1 | Link `design-tokens.css` ke `index.html` + `dashboard.html` + `auth/*.html` | P1 | [ ] | — |
| A2 | Link `hero-canvas.js` (p5.js CDN) + container `#hero-canvas-container` | P2 | [ ] | — |
| A3 | Migrasi hardcoded color `index.html` → token | P2 | [ ] | — |
| A4 | Semua API `try/catch` → respons JSON `{ok}` konsisten | P1 | [ ] | — |
| A5 | Tambah endpoint `/api/health` (tanpa DB) | P1 | [ ] | — |
| A6 | Pindahkan secret dari `wrangler.toml` ke `wrangler secret` | **P0** | [ ] | — |
| A7 | Verifikasi 14 endpoint terdaftar di `src/index.js` | P1 | [ ] | — |
| A8 | `robots.txt` + favicon + meta description/OG tags | P3 | [ ] | — |

---

## FASE B — Keamanan

| ID | Task | P | Status | Commit |
|----|------|---|--------|--------|
| B1 | Rate limit `/api/auth/login` (in-memory per-IP) | P1 | [ ] | — |
| B2 | Validasi & sanitasi input server-side | P1 | [ ] | — |
| B3 | JWT secret dari `env.JWT_SECRET`, bukan hardcoded | **P0** | [ ] | — |
| B4 | Header: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | P1 | [ ] | — |
| B5 | CORS ketat (hanya origin sendiri) | P1 | [ ] | — |
| B6 | Cookie `HttpOnly; Secure; SameSite=Lax` | **P0** | [ ] | — |
| B7 | Audit SQL injection (parameterized only) | **P0** | [ ] | — |
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

1. **A6** — Secret di `wrangler.toml` (P0, keamanan)
2. **B3** — JWT secret dari env (P0)
3. **B6** — Cookie flags (P0)
4. **B7** — Audit SQL injection (P0)
5. **A1** — Link design tokens (P1, fondasi desain)
6. **A5** — Endpoint `/api/health` (P1)

> Setelah semua P0 selesai, lanjut ke P1 berurutan.
> Jangan kerjakan P2/P3 sebelum P0/P1 tuntas.
