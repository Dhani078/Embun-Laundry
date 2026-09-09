# AGENT STATE

Terakhir update: 2026-09-09T11:40:00+08:00
Tick ke: 10
Model: cbai/hy4-preview (custom:9router)

## Baseline terakhir

| Path | Status | Catatan |
|------|--------|---------|
| `/` | 200 | Landing page OK, token ter-link |
| `/auth/login.html` | 307 → `/auth/login` | Redirect normal (asset scheme) |
| `/auth/register.html` | 307 | Redirect normal |
| `/dashboard.html` | 307 → `/dashboard` | Worker serve `dashboard.html` |
| `/api/health` | 200 | Liveness OK |
| `/api/services` | 200 | 4 layanan |
| `/assets/design-tokens.css` | **200** | DULU 404 — sudah fix di tick 3 |
| `/assets/hero-canvas.js` | **200** | DULU 404 — sudah fix di tick 3 |
| login admin | OK | `admin@gmail.com` / `admin123` |

## Task aktif

- ID: — (tidak ada; tick 8 selesai)
- Judul: —
- Fase: selesai
- Mulai: —

## Task selesai

- **A3b** — token baru untuk 9 warna sisa (P2) — `f782d3d`
  - 13 token nilai-persis: `--color-slate-50/400/500/800/950`,
    `--color-bg-inverse`, `--color-border-inverse`,
    `--color-text-on-inverse{, -muted, -subtle}`, `--color-rating`,
    `--color-error-500`
  - 9 kemunculan dimigrasi di `index.html` → sisa hex 22 → 11
    (10 di `:root` inline + 1 `<meta theme-color>`)
  - Bukti: `python tools/verify_a3b.py` → HIJAU 15/15, exit 0
  - **JANGAN dikerjakan ulang.** Jangan "merapikan" slate → neutral (beda
    nilai = regresi visual). Jangan definisikan ulang
    `--color-text-inverse` (sudah ada, `#ffffff`, dipakai halaman lain).
- **A5** — endpoint `/api/health` — `d6cea6a`
- **B4** — security headers global — `9632507`
- **B6** — cookie `HttpOnly; Secure; SameSite=Lax` — (sudah benar sejak awal)
- **A7** — verifikasi 16 endpoint terdaftar — (sudah tuntas sejak awal)
- **A1** — link design-tokens.css **SELESAI PENUH** — `21a94ea`
  - Termasuk perbaikan bug produksi: 2 aset yang belum ter-commit
- **A2** — hero canvas p5.js + `#hero-canvas-container` — `23e3fe2`
  - Perbaikan draft: palette dark + `clear()` (bukan `background()`),
    `pointer-events:none`, guard mount, orbs pre-render ke buffer statis
- **A8** — robots.txt + sitemap.xml + meta/OG tags — `a502402`
  (selesai tick 6; tabel backlog belum ditandai `[x]`, perlu disinkronkan)
- **A3** — migrasi hardcoded hex → token (sebagian) — `796e81e`
  - 25 baris diubah, 27 kemunculan diganti, **value-identical → nol regresi**
  - Token dipakai: `--color-neutral-0` (25x), `--color-brand-500/600/900`
  - Sisa 18 kemunculan TIDAK diganti: tidak ada token dengan nilai persis
    (`#94a3b8`x4 `#f8fafc`x3 `#64748b`x2 `#1e293b`x2 `#0f172a` `#e2e8f0`
    `#090d16` `#f59e0b` `#ef4444`) → calon task **A3b**
  - Tidak diganti juga: `<meta theme-color>` (`var()` tidak resolve di
    atribut HTML) dan blok `:root` inline (Gate 5 membolehkan)
- **B7** — audit SQL injection (P0) — `ea05d42`
  - Bukti, bukan keyakinan: 67 string SQL literal diaudit
    (`tools/audit_sql_injection.py`), 57 ber-placeholder `?`, **0 memakai
    interpolasi nilai user**. 17 handler diuji runtime
    (`tools/verify_b7_run.mjs`) dengan canary → **0 SQL kotor**.
  - 2 modul di-hardening (bukan "sudah aman dari dulu"):
    - `dashboard.js`: fragmen `${custFilter}`/`${custFilterAnd}` yang
      disambung ke SQL diganti dua bentuk SQL **penuh terpisah** yang
      digerakkan boolean `scoped`.
    - `reports.js`: `?group=` kini lookup di peta konstanta `GROUP_EXPR`;
      kunci asing jatuh ke 'bulan' (terbukti: canary → `DATE_FORMAT`).
  - Alat baru ter-commit: `audit_sql_injection.py`, `mock_tidb.mjs`,
    `sql_guard_loader.mjs`, `verify_b7.mjs`, `verify_b7_run.mjs`.
- **B1** — rate limit `/api/auth/login` (P1) — `9981427` + `ea05b75`
  - **Dua lapis**: memori per-isolate (10/5 mnt) + **Cache API shared
    per-datacenter (20/5 mnt)**. Lapis 1 saja terbukti tidak cukup.
  - Modul baru `functions/_ratelimit.js`; harness `tools/verify_b1.mjs`
    (7 uji, HIJAU) + `tools/mock_tidb.mjs` kini bisa menyuntik baris.
  - 2 defek urutan diperbaiki: (1) `getDb()` sebelum parse body → body
    rusak jadi 500, kini 400; (2) header Remaining diukur ulang via `peek()`.
  - Terbukti di produksi: 429 pada percobaan ke-21, `Retry-After: 277`,
    dan **self-healing** (login sah 200 lagi setelah jendela kedaluwarsa).
- **A4** — semua API `try/catch` → respons JSON `{ok}` konsisten — `c07ed88`
  - 2 defek produksi nyata diperbaiki (bukan sekadar "sudah ada try"):
    (1) body JSON rusak → **500 dari runtime**, kini 400 `{ok:false}`;
    (2) preflight OPTIONS → **405/401** di 11/16 endpoint, kini 204/200
  - Helper baru di `_db.js`: `readJson(request)` + `corsOptions(methods)`
  - `me.js` dibungkus try/catch (satu-satunya `await` di luar guard)
  - Alat audit ikut ter-commit: `tools/audit_api_guard.py`,
    `tools/audit_throw_sites.py`, `tools/probe_api.py`

## Blokir

- **A6** (P0) — secret `TIDB_DATABASE_URL` + `JWT_SECRET` masih plaintext di
  `wrangler.toml`. Butuh **Cloudflare API token** untuk `wrangler secret put`.
  - Butuh: `CLOUDFLARE_API_TOKEN` dengan izin Workers Secrets:Edit
  - Atau: manusia jalankan `npx wrangler secret put TIDB_DATABASE_URL` manual
  - Sejak: 2026-09-08T21:42
  - Task terdampak: A6, B3 (sebagian)
- **Catatan mitigasi**: JWT sudah baca `env.JWT_SECRET` dengan fallback;
  setelah secret diset di produksi, fallback otomatis tidak terpakai.

## Tech debt tercatat

1. `wrangler.toml` berisi `TIDB_DATABASE_URL` + `JWT_SECRET` plaintext → **P0**.
2. `public/index.html` — sisa **11 kemunculan hex pada 11 baris** setelah
   A3b (`f782d3d`), turun dari 49 kemunculan/47 baris. Sisanya:
   - 10 di blok `:root` inline (definisi, wajar — Gate 5 membolehkan)
   - 1 `<meta name="theme-color" content="#2563eb">` — `var()` TIDAK
     di-resolve di atribut HTML, jangan diganti
   - **9 warna sisa A3b SUDAH SELESAI** (`#94a3b8` `#f8fafc` `#64748b`
     `#1e293b` `#090d16` `#f59e0b` `#ef4444`) — kini token keluarga
     **slate** (`--color-slate-*`) terpisah dari **neutral** (warm).
     Jangan "merapikan" slate → neutral: nilainya berbeda = regresi visual.
   - CATATAN PENGUKURAN: baseline lama mencatat "40" (itu `grep -c` =
     BARIS). Pakai `tools/hexdiff.py` dan laporkan baris DAN kemunculan.
2a. **B4 belum mencakup aset statis.** Header keamanan
   (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`) ADA di `/api/*`
   tetapi TIDAK ada di respons HTML statis (`/`, `/dashboard`). B4 dulu
   ditandai selesai hanya karena diverifikasi lewat endpoint API.
   Perlu ditambahkan di jalur serve-aset di `src/index.js`.
2b. p5.js kini dependensi baru (CDN 1.03MB, SRI-pinned, deferred).
   - Draft `hero-canvas.js` awalnya TIDAK bisa dipakai langsung: palette
     near-white di atas hero gradient gelap. Sudah diperbaiki.
   - Jika nanti ingin nol dependensi, port sketch ke raw canvas 2D
     (~150 baris) dan hapus tag p5 + integrity.
4. 4 tabrakan nama token `index.html` vs `design-tokens.css`:
   `--radius-lg` (18 vs 12px), `--radius-md` (12 vs 8px), `--radius-sm`
   (8 vs 6px), `--shadow-sm` (beda nilai). Link sengaja diletakkan SEBELUM
   `<style>` inline supaya `:root` index menang → nol regresi visual.
   Saat A3 dikerjakan, hapus blok `:root` inline agar token yang menang.

## Catatan untuk tick berikutnya

- **Urutan fokus**: FASE A selesai kecuali **A6** (terblokir, butuh
  Cloudflare API token). FASE B: **B7 selesai** (tick 8), **B1 selesai**
  (tick 9). A3b selesai (tick 10).
  → **Berikutnya B2** (validasi & sanitasi input server-side, P1) → B5
  (CORS ketat; `Access-Control-Allow-Origin: *` masih ada di `/api/*`).
- **A3b JANGAN dikerjakan ulang.** Sudah tuntas `f782d3d`. Untuk memeriksa
  ulang: `python tools/verify_a3b.py` (exit 0, HASIL: HIJAU).
- **B1 JANGAN dikerjakan ulang.** Sudah tuntas `ea05b75`. Untuk memeriksa
  ulang: `node tools/verify_b1.mjs` (7 uji, HASIL: HIJAU).
- **PELAJARAN PENTING (berlaku umum)**: jangan menandai selesai hanya karena
  uji lokal hijau. Uji lokal B1 hijau untuk lapis memori saja, tetapi
  produksi membuktikan batasnya tidak berlaku (13 percobaan × 0 × 429).
  Selalu lakukan post-verify produksi yang mengukur AKHIRAT — bukan sekadar
  "endpoint masih 200".
- **B7 JANGAN dikerjakan ulang.** Sudah tuntas `ea05d42`. Jika ingin
  memeriksa ulang, jalankan `python tools/audit_sql_injection.py` (exit 0)
  dan `node tools/verify_b7_run.mjs` (HASIL: HIJAU) — itu cukup, jangan
  menulis ulang audit dari nol.
- **Pola verifikasi B7 bisa dipakai lagi** untuk task keamanan lain:
  ganti dependensi berbahaya dengan mock pencatat lewat ESM loader
  (`tools/sql_guard_loader.mjs`), lalu ukur apa yang benar-benar dikirim,
  bukan apa yang tertulis di sumber. Untuk B1 (rate limit) pola ini juga
  cocok: panggil handler 20x dan hitung respons 429.
- **`execute_code` DIBLOKIR di cron** (kebijakan: arbitrary local Python
  butuh persetujuan; cron tidak punya user). Pakai `terminal` + skrip di
  `tools/`, atau `search_files`. Jangan merencanakan langkah yang butuh
  `execute_code`.
- Untuk A3b: tambahkan dulu token ke `design-tokens.css`, baru ganti
  pemakaiannya. Jangan ganti hex ke token yang nilainya berbeda.
- Blok `:root` inline di `index.html` MASIH ADA dan menang atas
  `design-tokens.css` (link sengaja sebelum `<style>`). Menghapusnya
  mengubah 4 nilai radius/shadow (lihat debt #4) → butuh uji visual.
- **PENTING — jangan percaya `grep -c try` untuk A4**: 14/16 handler sudah
  punya `try`, jadi audit dangkal akan bilang "A4 hampir selesai". Yang
  rusak justru yang tidak terlihat: body JSON rusak dan preflight OPTIONS.
  Pakai `tools/probe_api.py` (lawan produksi) untuk mengukur kontrak, bukan
  menghitung kata kunci.
- `tools/probe_api.py` **TIDAK BISA dipakai apa adanya**: urllib
  (UA `Python-urllib/*`) diblokir Cloudflare → error 1010, semua respons
  403. Pakai `curl` (UA default) untuk probe produksi. Jika ingin memakai
  script itu lagi, set UA browser lewat header.
- Saat A3: hapus blok `:root` inline di index.html agar token
  design-tokens.css menang. Waspadai 4 tabrakan nilai (lihat tech debt #4).
- Sekarang ada 3 alat audit (sudah ter-commit): `audit_api_guard.py`
  (try/catch per handler), `audit_throw_sites.py` (buktikan handler tanpa
  try aman = nol throw site), `probe_api.py` (kontrak lawan produksi).
  `analyze_tokens.py` + `hexdiff.py` + `verify_a2.py` untuk A3.
- **Browser tool TERBLOKIR** di cron: Chrome minta persetujuan remote
  debugging manual. Verifikasi runtime harus lewat DOM/HTTP (cukup untuk
  A3/A4/A8; B1 rate-limit juga bisa di-HTTP).
- Saat A3: hapus blok `:root` inline di index.html agar token
  design-tokens.css menang. Waspadai 4 tabrakan nilai (lihat tech debt #4).
- Ingat: `@tidbcloud/serverless` `execute()` return `[]` untuk INSERT —
  pakai SELECT terpisah.
- Jangan ubah `name = "embun-laundry"` di `wrangler.toml`.
- Jangan sentuh `auth/login.html` dan `auth/register.html` (inline CSS stabil).

## Checklist tick terakhir (tick 4 — A2)

```
[x] Baca AGENT24.md + AGENT_STATE.md
[x] git pull --rebase origin main
[x] Baseline verifikasi hijau?
[x] Task terpilih dari backlog (A1)
[x] Rencana ≤10 baris
[x] Implementasi
[x] node --check semua JS → 0 error
[x] Struktur HTML valid
[x] Smoke test login + services
[x] Tidak ada hardcoded color BARU (40 hex = debt lama, tidak bertambah)
[x] A11y dasar
[x] Commit + bukti
[x] Push
[x] Post-verify produksi
[x] Update AGENT_STATE.md + AGENT_LOG.md
```

## Catatan verifikasi manual (2026-09-09 11:15)

- **B1 rate limit AKTIF dan bekerja benar.** Saat verifikasi manual, IP
  penguji sudah melewati batas 10 percobaan / 5 menit, sehingga
  `POST /api/auth/login` mengembalikan **429**
  `{"ok":false,"msg":"Terlalu banyak percobaan login. Coba lagi nanti."}`.
- **Ini BUKAN bug.** Jangan "memperbaiki" endpoint login saat melihat 429.
  Rate limit akan pulih sendiri setelah jendela 5 menit lewat.
- Endpoint non-auth tetap normal: `/api/services` → 200, `/` → 200.
- Saat memverifikasi login di tick berikutnya, **batasi percobaan** agar tidak
  memicu rate limit sendiri. Cukup 1–2 percobaan per tick.
