# AGENT LOG

Riwayat tick (append-only).

---

## Tick 0 — 2026-09-08T21:40:00+08:00

- Task: SETUP — inisialisasi sistem agent
- Perubahan:
  - Buat `AGENT24.md` (konstitusi loop 24 jam, 20 bagian)
  - Buat `AGENT_STATE.md` (state awal + baseline terverifikasi)
  - Buat `AGENT_BACKLOG.md` (backlog terurut P0–P4)
- File: `AGENT24.md`, `AGENT_STATE.md`, `AGENT_BACKLOG.md`
- Verifikasi:
  - `/` → 200
  - `/api/services` → 200 (4 layanan)
  - `/auth/login.html` → 307 (normal)
  - `/dashboard.html` → 307 → `/dashboard` (200)
  - login `admin@gmail.com` → OK
- Status: SUKSES (setup)
- Catatan: Baseline produksi hijau. Prioritas pertama adalah A6 (secret di wrangler.toml).

---

## Tick 1 — 2026-09-08T21:42:00+08:00

- Task: **A5** — tambah endpoint `/api/health`
- Perubahan:
  - Buat `functions/api/health.js` → `{ok,status,service,timestamp}`, tanpa DB
  - Daftarkan di `src/index.js`
- File: `functions/api/health.js`, `src/index.js`
- Verifikasi: `node --check` OK
- Commit: `d6cea6a`
- Status: SUKSES
- Catatan: Endpoint siap dipakai uptime monitor + baseline agent.

---

## Tick 2 — 2026-09-08T21:45:00+08:00

- Task: **B4** (security headers) + **A1** (link design tokens)
- Perubahan:
  - `withSecurityHeaders()` di `_db.js`: nosniff, X-Frame-Options DENY,
    Referrer-Policy, Permissions-Policy
  - Terapkan ke SEMUA respons: API + static asset + SPA route
  - Refactor router jadi `else-if` chain + satu titik `await` (lebih bersih)
  - Link `design-tokens.css` di `dashboard.html` + `pay.html`
- File: `src/index.js`, `functions/_db.js`, `public/dashboard.html`, `public/pay.html`
- Verifikasi:
  - `node --check src/index.js` → OK
  - `node --check functions/_db.js` → OK
  - `/api/health` → 200 + 4 header keamanan terpasang
  - `/api/services` → 200 (Cuci Kering 20000, dll)
  - login admin → `ok:true`
  - `/`, `/dashboard` → 200
- Commit: `9632507`
- Status: SUKSES
- Catatan:
  - `/` masih `CF-Cache-Status: HIT` (cache edge lama) → header belum muncul
    di landing, tapi SUDAH aktif di `/api/health`. Bersih saat cache purge.
  - **B6 (cookie flags) sudah benar** sejak awal: `HttpOnly; Secure; SameSite=Lax`
    di login/register/logout → B6 ditandai SELESAI.
  - **A7 tuntas**: 16 endpoint terdaftar di router.

---

## Tick 3 — 2026-09-09T06:20:00+08:00

- Task: **A1** (lanjutan) — link `design-tokens.css` ke `public/index.html`
- Temuan penting (bug produksi): `public/assets/design-tokens.css` dan
  `public/assets/hero-canvas.js` **tidak pernah ter-commit** (`?? untracked`).
  Padahal `dashboard.html` + `pay.html` sudah memanggil
  `/assets/design-tokens.css` → keduanya memuat stylesheet **404** di produksi.
  A1 yang sebelumnya ditandai "partial selesai" sebenarnya rusak di live.
- Perubahan:
  - `git add` dua aset yang hilang (673 baris) → sekarang ter-track
  - Tambah `<link rel="stylesheet" href="/assets/design-tokens.css"/>` di
    `public/index.html`, **SEBELUM** blok `<style>` inline
- File: `public/index.html`, `public/assets/design-tokens.css`,
  `public/assets/hero-canvas.js`
- Analisis pra-implementasi (`tools/analyze_tokens.py`):
  - 4 tabrakan nama token index vs design-tokens: `--radius-lg` (18 vs 12px),
    `--radius-md` (12 vs 8px), `--radius-sm` (8 vs 6px), `--shadow-sm`
  - Semua 16 `var()` di index.html terdefinisi di `:root` inline
  - Karena link diletakkan SEBELUM `<style>`, `:root` inline tetap menang →
    **nol regresi visual**
- Verifikasi (lokal):
  - `node --check src/index.js` / `public/app.js` / `functions/_db.js` /
    `public/assets/hero-canvas.js` → semua exit 0
  - `grep -c "</html>" public/index.html` → 1
  - `grep -c "authModal" public/index.html` → 0
  - `grep -c "<h1" public/index.html` → 1
  - `grep -c "assets/design-tokens.css" public/index.html` → 1
  - Hardcoded hex di index.html: 40 (sama seperti sebelum → tidak bertambah)
- Commit: `21a94ea`
- Post-verify produksi (setelah ~95s deploy) — SEMUA HIJAU:
  - `/` → **200** (token link terlihat di HTML live)
  - `/api/health` → 200
  - `/api/services` → 200
  - `/dashboard` → 200
  - `/assets/design-tokens.css` → **200** (sebelumnya **404**) ✔
  - `/assets/hero-canvas.js` → **200** (sebelumnya **404**) ✔
  - `/assets/style.css` → 200
  - login `admin@gmail.com` → `ok:true`
  - Security headers masih aktif: `nosniff`, `X-Frame-Options: DENY`,
    `Referrer-Policy`
  - Gate 7 DOM: `pricesGrid` 3, `orderModal` 8, `<h1>` 1, `</html>` 1,
    `<footer>` 1, script setelah `</html>` → 0
- Status: SUKSES
- Catatan:
  - **A1 kini SELESAI PENUH.** Perbaikan nyata: 2 aset 404 → 200 di produksi,
    yang juga memperbaiki `dashboard.html` dan `pay.html`.
  - Sisa tech debt A3: 40 hardcoded hex (18 warna unik) di index.html.
  - `tools/analyze_tokens.py` dibuat untuk analisis, belum di-commit.
  - Next tick: **A2** (link hero-canvas.js + p5.js CDN ke hero landing).

---

## Tick 4 — 2026-09-09T08:12:00+08:00

- Task: **A2** — link `hero-canvas.js` (p5.js CDN) + container
  `#hero-canvas-container` ke hero landing
- Analisis pra-implementasi menemukan draft `hero-canvas.js` **tidak bisa
  dipakai langsung** (3 masalah nyata):
  1. Palette `bg: [220,15,97]` = near-white, sedangkan `.hero` gradient
     GELAP (`#1e3a8a → #3b82f6`). `p.background()` akan menutupi hero.
  2. Canvas overlay `position:absolute; inset:0` akan menelan klik pada
     tombol "Pesan Sekarang" / "Lihat Harga".
  3. `mountHeroCanvas()` tanpa guard → jika p5 gagal load, p5 menyuntik
     canvas default ke `<body>`.
- Perubahan:
  - `index.html`: container `<div id="hero-canvas-container" aria-hidden>`
    + CSS (`pointer-events:none`, `z-index:0`, `.hero > .container` z-index 1)
    + tag p5.js CDN **SRI-pinned** (`sha384-6Twx1hAe...`) + `defer` +
      `crossorigin` + `referrerpolicy`, lalu `hero-canvas.js` `defer`
  - `hero-canvas.js`: palette diubah ke light-on-dark; `p.background()` →
    `p.clear()` (gradient CSS tetap terlihat); orbs di-redam; guard di
    `mountHeroCanvas()`; hapus `p.preload` (no-op)
  - **Performa**: 3 ambient orbs STATIS sebelumnya di-render ulang sebagai
    3 gradient radial full-canvas SETIAP FRAME (~6M px @1920px) →
    pre-render sekali ke buffer offscreen, di-blit 1 gambar/frame;
    rebuild saat resize + `initDroplets()`; buffer di-`remove()` saat unmount
- Justifikasi dependensi baru (aturan keras #3): p5.js 1.03MB dari CDN,
  deferred + SRI-pinned sehingga tidak block render & tidak bisa dimanipulasi.
  Jika CDN gagal → `mountHeroCanvas()` no-op, hero gradient tetap tampil
  (nol regresi visual). Tertulis di commit message.
- Verifikasi (lokal):
  - `node --check` × 4 file → exit 0
  - `</html>`=1, `authModal`=0, `<h1>`=1, `orderModal`=8, `pricesGrid`=3,
    `footer`=1, script setelah `</html>`=0
  - **Hex tidak bertambah**: HEAD 40 baris/42 kemunculan == kerja 40/42;
    0 hex di seluruh 31 baris baru (`tools/hexdiff.py`)
- Commit: `23e3fe2`
- Post-verify produksi (setelah ~95s) — SEMUA HIJAU:
  - `/` 200, `/api/health` 200, `/api/services` 200,
    `/assets/hero-canvas.js` 200, `/dashboard` 200
  - Markup hidup: container + tag p5 + integrity ada di baris 787/1150/1151
  - **SRI hash diverifikasi cocok** dengan berkas CDN
    (`openssl dgst -sha384` → `6Twx1hAeKnwfOYJAHtYe...` identik)
  - CSS `pointer-events:none` + `z-index` terkonfirmasi di HTML live
  - Isolasi: `hero-canvas.js` 0 referensi di `/dashboard` dan `/pay`
  - login admin → `ok:true`
- Status: SUKSES
- Catatan:
  - **A2 SELESAI.** Draft p5 yang "sudah jadi" ternyata butuh 4 koreksi
    agar aman dipasang — jangan percaya aset yang belum pernah di-link.
  - **Browser tool terblokir** di cron (Chrome minta persetujuan remote
    debugging). Verifikasi runtime dilakukan via DOM/HTTP produksi, bukan
    observasi visual. Sudah dicatat di AGENT_STATE.md.
  - Catatan pengukuran: angka "40 hex" di tick 3 = `grep -c` (baris);
    `grep -o | wc -l` = 42 (kemunculan). Keduanya valid, jangan panik.
  - Next tick: **A3** (migrasi 40 baris hex → token; hapus `:root` inline).

---

## Tick 6 — 2026-09-09T09:52:00+08:00

- Task: **A8** — SEO: robots.txt, sitemap.xml, meta/OG tags
- Perubahan:
  - Buat `public/robots.txt` (allow /, disallow /api/ + /dashboard + /pay.html)
  - Buat `public/sitemap.xml` (3 URL publik)
  - Landing: meta description, keywords, canonical, OG, Twitter card, favicon
- Verifikasi:
  - `grep -c '</html>'` → 1 (struktur utuh, tidak ada dobel blok)
  - `grep -c 'og:title|name="description"'` → 2 (meta masuk)
- Post-verify produksi (HTTP):
  - `/robots.txt` → 200
  - `/sitemap.xml` → 200
  - `/api/health` → 200
  - `/api/services` → 200
  - `/dashboard` → 200
- Commit: `a502402` (pushed)
- Status: **DONE**

**CATATAN PENTING (observasi tick 6):** cron fire jam 09:35 cuma update docs.
Interval 60m memberi jeda kosong panjang. Interval sudah dipadatkan ke **30m**
dan `repeat` dinaikkan ke **96** (bukan 24) agar loop bertahan jauh lebih lama
dan jeda antar-tick tidak terasa "berhenti".

---

## Tick 5 — 2026-09-09T09:20:00+08:00

- Task: **A4** — pastikan semua API `try/catch` → respons JSON `{ok}` konsisten
- Perubahan:
  - `_db.js`: tambah `readJson(request)` (hasil objek, tidak melempar) dan
    `corsOptions(methods)` (preflight 204 bersama)
  - Migrasi 10 pemanggilan `request.json()` mentah → `readJson()`
  - Tambah penanganan OPTIONS di customers, delivery, pay, orders, profile,
    services, vouchers, promos, checkin, dashboard, reports, me
  - `src/index.js`: dispatch OPTIONS ke `onRequestOptions` bila ada, supaya
    preflight tidak bergantung pada urutan if/else per endpoint
  - `me.js`: bungkus pembacaan sesi dalam try/catch
- File: `_db.js`, `src/index.js`, 13 handler di `functions/api/`, 7 `tools/`
- Verifikasi (SEMUA terhadap produksi, setelah deploy ~95s):
  - **Defek #1 — body JSON rusak**: SEBELUM `POST /api/auth/login "{bad json"`
    → **500**; SESUDAH → **400** `{"ok":false,"msg":"Body JSON tidak valid"}`.
    Sama untuk orders, pay, delivery, dan (dengan sesi admin) promos,
    customers, services, vouchers, profile — semua 400, bukan 500.
  - **Defek #2 — preflight OPTIONS**: SEBELUM 11/16 endpoint → 405/401
    (`/api/orders` 405, `/api/services` 405, `/api/me` 401, dst);
    SESUDAH **16/16 → 204 atau 200**.
  - Regresi: 16 endpoint GET terautentikasi → `ok:true` dengan data nyata
    (dashboard revenue 175000, orders, customers, reports, dll)
  - Auth: admin/staff/user login → `ok:true`; password salah → 401
    `{ok:false}`, bukan 500
  - `node --check` 20/20 file → exit 0
  - `npx wrangler deploy --dry-run` → OK (115.35 KiB / gzip 25.58)
  - Gate struktur: `</html>`=1, `authModal`=0, `<h1>`=1
  - Security headers (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
    `Permissions-Policy`) tetap aktif
  - `/api/tidak-ada` → 404 JSON `{"ok":false}` (bukan HTML)
  - `tools/audit_throw_sites.py`: 8 handler tanpa try/catch terbukti
    **nol throw site** → tidak bisa melempar saat runtime
- Commit: `c07ed88`
- Status: SUKSES
- Catatan:
  - **Pelajaran metode**: audit `grep -c try` menghasilkan "14/16 sudah ada
    try, A4 hampir selesai" — itu MENYESATKAN. Kerusakan nyata ada di
    preflight OPTIONS dan body JSON rusak. Ukur kontrak lawan produksi
    (`curl`), jangan hitung kata kunci.
  - **Jebakan verifikasi**: `tools/probe_api.py` (urllib) diblokir Cloudflare
    → error 1010, semua 403. Semua angka di atas diambil dengan `curl`.
    Jangan melaporkan 403 itu sebagai bug aplikasi.
  - Urutan 401 pada promos/customers/services/vouchers/profile saat body
    rusak TANPA sesi adalah BENAR: guard auth jalan sebelum parse body.
    Dengan sesi admin, semuanya 400 seperti yang diharapkan.
  - **A4 SELESAI.** Next tick: **A3** (migrasi hex → token, hapus `:root`
    inline), lalu A8. A6 tetap terblokir.

---

## Tick 7 — A3: migrasi hardcoded hex → design token (`796e81e`)

**Task:** A3 (P2) — migrasi hardcoded color di `public/index.html` ke
design token.

**Hasil: SUKSES** — 25 baris diubah, 27 kemunculan diganti.

### Strategi: hanya substitusi yang NILAINYA IDENTIK

Inventaris awal: **49 kemunculan hex pada 47 baris, 18 warna unik**.
Dari itu, hanya **31 baris yang punya kecocokan nilai persis** dengan token
di `design-tokens.css`. Aku sengaja TIDAK mengarang token baru dan TIDAK
memakai token "yang kira-kira mirip" — karena substitusi value-identical
berarti **nol regresi visual secara terbukti**, bukan sekadar klaim.

Yang diganti (value-identical, aman):

| Hex | Token | Jml |
|---|---|---|
| `#ffffff` / `#fff` | `--color-neutral-0` | 25 |
| `#2563eb` | `--color-brand-600` | 1 |
| `#1e3a8a` | `--color-brand-900` | 1 |
| `#3b82f6` | `--color-brand-500` | 1 |

Yang SENGAJA tidak diganti (18 kemunculan, tidak ada token dengan nilai
persis — jadi tech debt, bukan kelalaian):
`#94a3b8`(4) `#f8fafc`(3) `#64748b`(2) `#1e293b`(2) `#0f172a` `#e2e8f0`
`#090d16` `#f59e0b` `#ef4444`. Plus blok `:root` inline (Gate 5
membolehkan) dan `<meta theme-color>` — `var()` **tidak** di-resolve di
atribut HTML, jadi menggantinya akan merusak warna browser chrome.

### Bukti verifikasi

```
</html> = 1          <html = 1         authModal = 0      <h1> = 1
script setelah </html> = 0
baris: 1182 -> 1182  (tidak ada rewrite total)
hex: 47 baris/49 kemunculan -> 22 baris/22 kemunculan (net -27)
token dipakai tapi tak terdefinisi: TIDAK ADA
  (--delay muncul di audit = pre-existing, 0 kemunculan di diff)
line endings: 1182 LF sebelum & sesudah = sama dengan HEAD (CRLF aman)
node --check: src/index.js, public/app.js, functions/_db.js,
              public/assets/hero-canvas.js -> semua exit 0
diff --stat: 1 file changed, 25 insertions(+), 25 deletions(-)
```

Post-deploy (produksi, ~95s): `/` `/api/health` `/api/services`
`/assets/design-tokens.css` `/assets/hero-canvas.js` = **200**.
HTML yang disajikan memuat `24x var(--color-neutral-0)` +
`1x --color-brand-500/600/900`. Login admin `ok:true`.
Bad-JSON body tetap 400 (kontrak A4 tidak regress).

### Temuan baru (bukan regresi, catat sebagai debt)

**B4 tidak berlaku untuk halaman statis.** Header keamanan
(`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy`) hadir di respons `/api/*` tetapi **TIDAK** ada di
respons HTML statis seperti `/` dan `/dashboard`. Task B4 dulu ditandai
selesai karena diverifikasi lewat endpoint API saja. Perlu header juga di
jalur serve aset statis di `src/index.js`.

### Catatan untuk tick berikutnya

- A3 **selesai untuk warna yang punya token persis**. Sisa 18 kemunculan
  butuh keputusan: tambah token baru ke `design-tokens.css`
  (mis. `--color-slate-400: #94a3b8`, `--color-warning-star: #f59e0b`)
  atau biarkan. Ini bisa jadi tick tersendiri (A3b).
- Blok `:root` inline di `index.html` MASIH ADA dan masih menang atas
  `design-tokens.css` karena link diletakkan sebelum `<style>`. Menghapusnya
  (rencana lama) akan mengubah 4 nilai radius/shadow → butuh uji visual,
  jangan dilakukan buta.
- A8 sudah selesai di tick 6 (`a502402`) meski tabel backlog belum
  ditandai `[x]` — perlu disinkronkan.
- **Fase A tinggal A6** (terblokir, butuh Cloudflare API token).
  Setelahnya lanjut FASE B: B7 (audit SQL injection, P0), B1 (rate limit),
  B2 (validasi input), B5 (CORS ketat — `Access-Control-Allow-Origin: *`
  masih terlihat di `/api/health`).


## Tick 8 — 2026-09-09T10:21:38+08:00

- Task: **B7** (P0) — Audit SQL injection: buktikan semua query parameterized
- Perubahan:
  - `functions/api/dashboard.js` — fragmen `${custFilter}` / `${custFilterAnd}`
    yang disambung ke SQL diganti dua bentuk SQL **penuh terpisah** yang
    digerakkan boolean `scoped`. Konstanta `FILTER_WHERE` diberi nama agar
    audit bisa memutihkannya.
  - `functions/api/reports.js` — `?group=` tidak lagi memilih ekspresi GROUP BY
    lewat if/else yang menyambung string; kini lookup di peta `GROUP_EXPR`.
    Kunci asing (termasuk canary) jatuh ke 'bulan'.
- File: 2 modul produksi + 5 alat audit baru di `tools/`
- Verifikasi:
  - `python tools/audit_sql_injection.py` → 67 SQL literal, 57 ber-`?`,
    **0 interpolasi** (exit 0)
  - `node tools/verify_b7_run.mjs` → 17 handler dipanggil sungguhan dengan
    canary `x' OR 1=1 -- zzCANARYzz` + `zzUNIONzz/**/SELECT`:
    **Total SQL kotor: 0 → HASIL: HIJAU**
  - Uji peta GROUP BY: `group=hari` → `DATE(created_at)`;
    `group="x' OR 1=1 -- zzCANARYzz"` → `DATE_FORMAT(created_at,'%Y-%m')`
    (fallback aman, tidak bocor)
  - Uji scoping: role=Customer → 4 query `customer_name = ?`, nama tidak
    pernah disisipkan mentah; role=Admin → 0 (sesuai desain)
  - `node --check` 6 file → exit 0
  - Produksi (~95s): `/` `/api/health` `/api/services` `/dashboard`
    `/robots.txt` `/assets/design-tokens.css` = 200; login admin & user
    `ok:true`; `/api/dashboard` & `/api/reports` berisi data; bad-JSON → 400
    `{ok:false}`; OPTIONS → 204 (kontrak A4 tidak regress)
- Commit: `ea05d42`
- Status: **SUKSES**
- Catatan:
  - Temuan penting: audit dangkal ("semua pakai `?`") akan mengatakan B7
    sudah beres sejak awal. Yang sebenarnya rapuh adalah **pola**-nya: dua
    modul menyambung fragmen SQL. Nilainya konstanta hari ini, tapi satu
    edit saja bisa mengubahnya jadi vektor injeksi. Diperbaiki secara
    struktural, bukan diberi komentar.
  - 5 alat audit ter-commit supaya tick berikutnya mengulang *pengukuran*,
    bukan mengulang *keyakinan*.
  - `execute_code` diblokir kebijakan cron → semua skrip dijalankan lewat
    `terminal` + berkas di `tools/`.

---

## Tick 9 — 2026-09-09T10:51+08:00
- Task: **B1** — Rate limit `/api/auth/login` (P1)
- Perubahan:
  - Modul baru `functions/_ratelimit.js` — **dua lapis**: memori per-isolate
    (10/5 menit) + Cache API shared per-datacenter (20/5 menit).
  - `functions/api/auth/login.js` — `consume()` sebelum sentuh DB; header
    `X-RateLimit-Limit/-Remaining` + `Retry-After`; jatah dibersihkan lewat
    `ctx.waitUntil()` setelah login berhasil.
  - `tools/verify_b1.mjs` (baru) + `tools/mock_tidb.mjs` (bisa suntik baris).
- Verifikasi: `tools/verify_b1.mjs` 7 uji → **HIJAU**; `node --check` 6 file;
  B7 audit SQL HIJAU; `audit_throw_sites` AMAN.
- Commit: `9981427` (lapis 1) · `ea05b75` (lapis 2 — perbaikan inti)
- Status: **SUKSES**
- Catatan:
  - **Post-verify produksi menyelamatkan tick ini.** Lapis memori saja
    terbukti TIDAK cukup: 13 percobaan gagal berturut-turut → tetap 401,
    dan `X-RateLimit-Remaining` terukur melonjak 7→6→9→5→9→8. Penyebab:
    isolate Workers tidak berbagi memori → ambang praktis 10 × jumlah
    isolate. Setelah lapis Cache API: **429 muncul tepat pada percobaan
    ke-21** (ambang shared), `Retry-After: 277`.
  - Dua defek urutan juga ditemukan harness (bukan sekadar "tambah counter"):
    (1) `getDb()` dipanggil sebelum body di-parse → body rusak jadi 500
    "Database tidak terhubung"; kini parse+validasi duluan → 400.
    (2) `X-RateLimit-Remaining` diisi dari nilai sebelum percobaan dihitung;
    kini diukur ulang lewat `peek()`.
  - Terbukti **self-healing**: login sah diblokir selama jendela berjalan,
    lalu 200 + `Remaining: 10` setelah kedaluwarsa — tidak mengunci permanen.
  - Fail-open sengaja: Cache API mati → tidak memblokir (Uji 7).
  - Harness memalsukan Cache API supaya lapis 2 ikut teruji, bukan dilewati
    diam-diam (pola B7: ganti dependensi, ukur nyatanya).

---

## Tick 10 — 2026-09-09T11:30+08:00

- Task: **A3b** (P2) — token baru untuk 9 warna sisa, hapus hardcoded hex
- Perubahan: 13 token nilai-persis baru di `design-tokens.css`, lalu
  migrasi 9 kemunculan hex di `index.html`. Sisa hex turun 22 → 11
  kemunculan (10 di `:root` inline + 1 `<meta theme-color>`).
- File: `public/assets/design-tokens.css`, `public/index.html`,
  `tools/verify_a3b.py` (baru)
- Verifikasi:
  - `python tools/verify_a3b.py` → **HASIL: HIJAU (15/15)**, exit 0
    (13 nilai token OK, 0 tabrakan nama, 27 var() ter-resolve, 0 hex sisa
    di luar `:root`/`theme-color`)
  - `python tools/hexdiff.py` → `baris_baru=0 hex_pada_baris_baru=0`
  - `node --check` ×4 → exit 0; `</html>`=1, `authModal`=0, CSS brace 5/5
  - Produksi (setelah deploy ~95s): `/` 200, `/api/health` 200,
    `/api/services` 200, `/assets/design-tokens.css` 200; token baru
    terlihat di CSS live (baris 87/98/103/105/106/107/110); halaman `/`
    hanya memuat 2 hex (keduanya di `:root` inline); login admin
    `ok:true`; `/api/services` 4 layanan
- Commit: `f782d3d`
- Status: **SUKSES**
- Catatan:
  - **Jebakan nama yang berhasil dihindari**: `--color-text-inverse` SUDAH
    ada di `design-tokens.css` (nilai `#ffffff`) dan dipakai halaman lain.
    Redefinisi untuk footer akan jadi tabrakan nilai tersembunyi. Dipakai
    nama `--color-text-on-inverse*` sebagai gantinya.
  - Harness verifikasi awalnya **MERAH** karena `var(--delay, 0ms)`.
    Benar adanya bahwa `--delay` tidak punya deklarasi, tapi AMAN karena
    semua pemakaiannya punya fallback. Pemeriksaannya DIPERBAIKI untuk
    membedakan "tak terdefinisi" vs "tak terdefinisi tapi ber-fallback" —
    bukan dilonggarkan supaya hijau.
  - Keluarga **slate** sengaja terpisah dari **neutral** (warm): footer
    landing didesain dengan slate dingin, jadi nilainya dijaga
    bit-identical. Jangan "merapikan" slate → neutral; itu regresi visual
    nyata, bukan penyederhanaan.

---

## Tick 11 — 2026-09-09T12:15+08:00

- Task: **B2** (P1) — validasi & sanitasi input server-side
- Perubahan:
  - Modul baru `functions/_validate.js` (161 baris): `validate(body, spec)`
    mengembalikan objek hasil (TIDAK melempar) supaya kontrak A4 tetap
    rapi. Tipe field: `str`, **`raw`**, `int`, `enum`, `bool`, `email`,
    `date`. `cleanStr()` membuang karakter kontrol (NUL..US, DEL) dan
    merapikan spasi.
  - 7 handler dipasang: `customers`, `services`, `orders`, `promos`,
    `vouchers`, `auth/register`, `auth/login`. Semua parameter GET
    pencarian (`q`, `cat`, `tag`, `status`) kini dibersihkan + dibatasi.
- File: `functions/_validate.js` (baru), 7 handler, `tools/verify_b2.mjs`
  + `tools/verify_b2_run.mjs` (baru)
- Verifikasi:
  - `node tools/verify_b2_run.mjs` → **HASIL: HIJAU (47/47)**, exit 0
    (12 uji satuan validator + 25 uji "input buruk → 400" + 3 uji
    sanitasi SQL + 1 uji 401 tanpa sesi + 1 uji "string raksasa tidak
    sampai ke DB")
  - `node --check` seluruh `functions/**/*.js` → exit 0
  - Regresi: B7 HIJAU, B1 HIJAU (7 uji), A3b HIJAU (15/15)
- Commit: `c9db43b`
- Status: **SUKSES**
- Defek nyata yang ditemukan (bukan sekadar "tambah validasi"):
  1. `Math.max(1, parseInt(weight_kg) || 1)` mengizinkan **berat 100000
     kg** — order senilai miliaran dari satu input; kini 1..1000.
  2. `bulk_claim` menerima **daftar user tanpa batas** (`[1..100000]`
     dalam satu permintaan); kini maks 500 dan tiap id wajib bulat.
  3. Register **tidak punya batas bawah sandi sama sekali** — sandi
     1 karakter diterima; kini minimal 6.
  4. `start`/`end` digabung mentah menjadi `'<nilai> 00:00:00'` lalu
     dikirim ke TiDB; kini wajib `YYYY-MM-DD` (kalender nyata, bukan
     sekadar regex — `2026-02-30` ditolak).
  5. Promo tipe `percent` bisa bernilai **500**; kini maks 100.
- Catatan:
  - **Jebakan yang berhasil dihindari**: `cleanStr()` pada kata sandi
    akan MERUSAK sandi yang mengandung spasi ganda. Karena itu
    ditambahkan tipe **`raw`** — panjang dibatasi, isi tidak disentuh.
    Semua field sandi (`login.password`, `register.password/confirm`)
    memakai `raw`.
  - `cleanStr()` mengganti karakter kontrol jadi **SPASI**, bukan
    menghapus: `'Budi\0Santoso'` → `'Budi Santoso'`, bukan
    `'BudiSantoso'` (dua kata tidak melebur).
  - Harness awalnya **MERAH** karena uji `cleanStr` mengekpektasi
    penghapusan. Pemeriksanya DIBENARKAN sesuai semantik yang disengaja —
    bukan dilonggarkan.
  - **URL produksi ternyata `dhanisepeda`, bukan `dhani078`.** Beberapa
    menit terbuang untuk resolusi DNS yang gagal; sumber kebenarannya
    ada di `public/sitemap.xml`. Sudah dicatat di AGENT_STATE.md.
  - Post-verify produksi mengukur AKHIRAT, bukan "masih 200": login
    raksasa → 400, register email buruk → 400, `move_status` status asing
    → 400, persen 500 → 400, **dan jalur sukses tetap jalan**:
    `create_customer` mengembalikan `"Budi Santoso"` / `"Jl. Melati
    No. 1"` (spasi dirapikan di server), baris uji lalu dihapus.
- Berikutnya: **B5** — CORS ketat (`Access-Control-Allow-Origin: *` masih
  di `jsonResponse()` & `corsOptions()`).

---


## Tick 12 — 2026-09-09T12:22:00+08:00 (B5 — CORS ketat)

- Task: **B5** — CORS ketat: hanya origin sendiri (P1)
- Perubahan:
  - Modul baru `functions/_cors.js` — `isOriginAllowed()`, `corsHeaders()`,
    `applyCors()`. Daftar izin: origin produksi
    (`https://embun-laundry.dhanisepeda.workers.dev`) + semua
    `*.dhanisepeda.workers.dev` (preview deploy) + `localhost`/`127.0.0.1`/
    `[::1]` (dev) + `ALLOWED_ORIGINS` dari env (bisa diset di dasbor tanpa
    ubah kode).
  - 6 titik hardcoded `Access-Control-Allow-Origin: *` DIHAPUS:
    `jsonResponse()` + `corsOptions()` di `_db.js`, dan `onRequestOptions`
    di `auth/login.js`, `auth/logout.js`, `auth/register.js`, `health.js`.
  - `src/index.js`: `applyCors()` dipasang di 3 jalur — preflight OPTIONS,
    respons handler, dan 404 endpoint. Jadi header CORS terpusat di 1 titik,
    tidak ada lagi yang bisa lolos.
  - `Vary: Origin` dikirim bila ada header Origin → CDN tidak mencampur
    respons antar-origin.
- File:
  - BARU: `functions/_cors.js`, `tools/verify_b5.mjs`,
    `tools/verify_b5_run.mjs`
  - UBAH: `functions/_db.js`, `src/index.js`,
    `functions/api/auth/{login,logout,register}.js`, `functions/api/health.js`
- Verifikasi (lokal):
  - `node tools/verify_b5_run.mjs` → **HASIL: HIJAU — 50 lulus, 0 gagal**,
    exit 0. Uji menjalankan `src/index.js` sungguhan (bukan fungsi
    terisolasi) dengan `env.ASSETS` tiruan, lalu mengukur header yang
    benar-benar keluar.
  - Regresi: B7 HIJAU, B1 HIJAU, B2 47/47, A3b 15/15. `node --check` exit 0.
  - Hex `index.html` tetap 11 (debt lama, tidak bertambah).
- Verifikasi (produksi, setelah deploy ~95s) — mengukur AKHIRAT:
  - Origin `https://evil.example.com` → **tanpa ACAO** di `/api/health`,
    `/api/services`, `/api/orders`, `/api/profile`.
  - Preflight OPTIONS dari origin jahat → **tanpa ACAO**, tetap 200
    (tidak 405). Hanya Allow-Methods/Allow-Headers yang masih dikirim
    (tidak membocorkan apa pun tanpa ACAO).
  - Origin produksi → `Access-Control-Allow-Origin: https://...dhanisepeda
    .workers.dev` (persis, bukan `*`), + `Max-Age: 86400`.
  - `Vary: Origin` terkirim.
  - Nol regresi: `/` 200, `/api/health` 200 `ok:true`, `/api/services` 200,
    `/assets/design-tokens.css` 200, login admin **200 ok:true**,
    `/dashboard` 200, `/api/orders` 200 (dengan cookie).
- Commit: `d32c367`
- Status: **SUKSES**
- Catatan:
  - Semua `fetch()` di `public/` memakai URL relatif (`/api/...`) → same
    origin, jadi daftar izin aman dan tidak ada pemanggil yang patah.
    Sudah diperiksa: 26 pemanggilan di `app.js`, `index.html`, `pay.html`,
    `auth/*.html`, semuanya relatif.
  - `Access-Control-Allow-Methods`/`-Headers` sengaja MASIH dikirim ke origin
    asing: tanpa `Access-Control-Allow-Origin` browser tetap memblokir
    respons, jadi ini tidak membocorkan data — dan menjaga preflight tidak
    berubah jadi 405 (kontrak A4).
  - Jika nanti butuh origin tambahan (domain kustom), set `ALLOWED_ORIGINS`
    di dasbor Cloudflare — tidak perlu ubah kode.
- Berikutnya: **B8** (PBKDF2 untuk hash sandi) atau FASE C (fitur). A6 tetap
  terblokir (butuh Cloudflare API token).

---

## Tick 13 — 2026-09-09T14:12:00+08:00 (B8 — migrasi hash sandi ke PBKDF2)

- Task: **B8** — migrasi hash sandi → PBKDF2 via WebCrypto (P2)
- Temuan awal (DIUKUR dari TiDB produksi, bukan asumsi):
  - `tools/probe_hash.mjs`: 9 pengguna, 8 berformat sha256-hex64, 1 plaintext
    debug (`testhash`). Tidak ada bcrypt sama sekali.
  - `tools/probe_schema.mjs`: `password_hash VARCHAR(255)`, dan TERBUKTI
    `hash admin@gmail.com == sha256('admin123' + 'dhani-salt')` → COCOK.
  - Jadi kondisi awal: SATU kali SHA-256 dengan salt global yang tertulis di
    sumber. Satu tabel pelangi berlaku untuk seluruh pengguna.
- Perubahan:
  - BARU `functions/_password.js`: `hashPassword()`, `verifyPassword()`,
    `isPbkdf2Hash()`. Format `pbkdf2-sha256$<iterasi>$<salt>$<hash>` — 86
    karakter, muat di VARCHAR(255) tanpa mengubah skema.
  - **Salt acak 16 byte per pengguna.** Dua hash untuk sandi yang sama tidak
    pernah identik. Perbandingan memakai loop XOR (waktu konstan), bukan
    `===` yang berhenti di byte pertama.
  - Iterasi **10.000**, tersemat di dalam hash. Bukan 600.000 rekomendasi
    OWASP — alasan terukur di bawah.
  - `verifyPassword()` menerima semua format lawas (SHA-256+salt, SHA-256
    tanpa salt, plaintext, bcrypt) → migrasi tidak mengunci siapa pun.
  - `login.js`: **lazy upgrade** — login sah dengan hash lawas menulis ulang
    hash ke PBKDF2 lewat `ctx.waitUntil()`. Tidak menahan respons; gagal
    tulis tidak membatalkan login. Hash yang sudah PBKDF2 tidak ditulis
    ulang.
  - Deduplikasi: dua salinan algoritma (`_db.js` + `login.js`) jadi satu.
    `_db.js` kini hanya re-export.
  - `profile.js change_password`: pakai `verifyPassword()` (satu sumber) +
    menolak sandi baru < 6 karakter (**defek nyata**: sebelumnya `x`
    diterima dan langsung ditulis ke DB).
- Kenapa 10.000 iterasi, bukan 600.000 — keputusan berdasar pengukuran:
  - Workers menghitung **CPU time**, bukan wall clock (ambang rencana gratis
    10 ms/permintaan).
  - `tools/bench_pbkdf2.mjs` (Node 22, mesin ini):
    10.000 → 3,44 ms | 20.000 → 6,16 ms | 50.000 → 13,66 ms |
    100.000 → 25,24 ms | 200.000 → 47,81 ms | 600.000 → 139,73 ms
  - `change_password` memanggil hash **2×** (sandi lama + baru). Pada 10.000
    → ~7,0 ms (aman). Pada 20.000 → ~12,3 ms → akan MENGGAGALKAN ganti
    sandi. Jadi 10.000 adalah nilai terbesar yang aman untuk kedua jalur.
  - Ini tetap ~10.000× lipat biaya dibanding SHA-256 tunggal, dan salt acak
    per pengguna membuat tabel pelangi jadi tidak berguna.
- File:
  - BARU: `functions/_password.js`, `tools/verify_b8.mjs`,
    `tools/verify_b8_run.mjs`, `tools/bench_pbkdf2.mjs`,
    `tools/probe_hash.mjs`, `tools/probe_schema.mjs`,
    `tools/probe_b8_live.mjs`
  - UBAH: `functions/_db.js`, `functions/api/auth/login.js`,
    `functions/api/profile.js`
- Verifikasi (lokal):
  - `node tools/verify_b8_run.mjs` → **HIJAU 35 lulus, 0 gagal**, exit 0.
  - Yang diuji bukan "fungsi dipanggil", melainkan hasil nyata: format hash,
    salt acak (2 hash untuk sandi sama tidak identik), panjang ≤ 255,
    hash lawas **yang diambil dari produksi** tetap bisa login, **SQL UPDATE
    yang benar-benar dikirim saat lazy upgrade** (ditangkap lewat mock
    pencatat), hash hasil upgrade bisa diverifikasi, nol UPDATE saat hash
    sudah PBKDF2, nol UPDATE saat sandi salah, biaya CPU 3,5 ms/hash.
  - Regresi hijau: B7 nol temuan, B2 47/47, B5 50/50, B1 HIJAU, A3b 15/15.
    `node --check` semua .js/.mjs → exit 0. Hex `index.html` tetap 10.
- Verifikasi (produksi, setelah deploy ~95 s):
  - `/` 200, `/api/health` 200 `ok:true`, `/api/services` 200,
    `/assets/design-tokens.css` 200, `/dashboard` 200, `/api/orders` 200.
  - Login admin → **200 `ok:true`** (hash lawas, memicu upgrade).
  - `/api/me` 200 dengan cookie.
  - Sandi salah → **401** `{"ok":false,"msg":"Kata sandi salah"}`.
  - CORS: origin `evil.example.com` → tanpa ACAO (B5 tidak regressi).
  - **PEMBUKTIAN AKHIR** (`tools/probe_b8_live.mjs`, baca langsung dari
    TiDB setelah login produksi):
    - `admin@gmail.com` → `pbkdf2-sha256$10000$6LBzy3uvk7…` (**BARU**),
      `verifyPassword('admin123') -> true`
    - sebelumnya: `0a1233d67b1b6a30…` (SHA-256 + salt global)
    - `user@gmail.com`, `staff@gmail.com` → masih LAWAS (belum login sejak
      deploy) → **sesuai rancangan lazy upgrade**, bukan kegagalan.
- Commit: `87d3fa9`
- Status: **SUKSES**
- Catatan:
  - Pengguna yang TIDAK pernah login ulang tetap berhash lawas sampai mereka
    login lagi. Pantau dengan `TIDB_DATABASE_URL=… node tools/probe_hash.mjs`.
    Jalur verifikasi lawas baru boleh dihapus setelah seluruh baris PBKDF2.
  - Jangan naikkan iterasi tanpa mengukur ulang `tools/bench_pbkdf2.mjs` —
    `change_password` memanggil hash 2× dan akan melewati batas CPU Workers.
  - wrangler lokal TIDAK terautentikasi (`wrangler whoami` → not
    authenticated), jadi deploy hanya terjadi lewat push ke `main`.
- Berikutnya: FASE C (fitur inti) atau B3 (JWT secret dari env). A6 tetap
  terblokir (butuh Cloudflare API token).

---

---

## Tick 14 — 2026-09-09T14:40:00+08:00

- Task: **B9** — escaping HTML untuk seluruh data dari API (stored XSS, P0)
- Temuan (bukan task yang direncanakan — ditemukan saat orientasi):
  - `public/app.js`, `public/index.html`, `public/pay.html` membangun
    antarmuka dengan `innerHTML` dan menyuntikkan nilai dari API secara
    MENTAH: `<td>${o.customer_name}</td>`.
  - `customer_name` berasal dari `users.full_name` yang diisi bebas saat
    registrasi — `_validate.js` hanya memotong karakter kontrol dan
    panjang, TIDAK menghapus `<`, `>`, `"`. Pendaftar dengan nama
    `<img src=x onerror=...>` menjalankan skrip di browser setiap
    Admin/Owner/Staff yang membuka Dashboard/Pesanan/Pelanggan/Delivery.
  - Ini stored XSS (P0). Belum pernah tercatat di backlog.
- Perubahan:
  - BARU `public/assets/escape.js`: satu helper `esc()` bersama untuk
    ketiga berkas (bukan tiga salinan). Meng-escape `& < > " '`, aman di
    isi elemen DAN di nilai atribut ber-tanda kutip ganda.
    null/undefined -> `''` (tidak ada lagi "null"/"undefined" di UI).
  - Dimuat sebelum skrip pemakai; di `dashboard.html` SEBELUM `app.js`
    (urutan ini diuji, karena app.js butuh esc() saatrender).
  - 46 titik penyuntikan di-escape: orders, customers (`cust.`), services,
    delivery (`t.`), promos, vouchers, laporan (`d.`, KPI `s.`), profil
    (`u.`), nav landing page.
- Perbaikan tambahan (defek nyata yang ditemukan di jalur yang sama):
  - `href="/pay.html?code=${o.order_code}"` → `encodeURIComponent(...)`:
    kode pesanan tidak bisa lagi menyuntik parameter URL tambahan.
  - `t.type.toUpperCase()` → `String(t.type || '').toUpperCase()`:
    sebelumnya satu baris dengan `type` null membuat `renderDelivery()`
    TypeError dan seluruh tabel gagal dirender.
- Alat:
  - `tools/audit_xss.py` (statik) — pindai semua interpolasi `${...}`.
  - `tools/verify_b9.mjs` (runtime, 32 uji) — memuat esc() sungguhan lewat
    `vm` dan membuktikan 6 muatan XSS nyata netral.
- Verifikasi (lokal):
  - `node tools/verify_b9.mjs` → **HIJAU 32/32**, exit 0.
  - `python tools/audit_xss.py` → **HIJAU**, exit 0.
  - `node --check` semua .js/.mjs → 0 error.
  - Regresi HIJAU: B1, B2 47/47, B5 50/50, B7, B8 35/35, A3b 15/15.
- Verifikasi (produksi, setelah deploy ~95 s):
  - `/` 200, `/api/health` 200, `/api/services` 200, `/dashboard` 200,
    `/assets/escape.js` **200** (berkas baru terdeploy).
  - `curl /app.js | grep -c 'esc('` → **47** pemanggilan.
  - Urutan skrip benar: `escape.js` (baris 79) sebelum `app.js` (80) di
    `/dashboard`; `escape.js` (967) sebelum skrip sebaris di `/`.
- Commit: `be7d8cd`
- Status: **SUKSES**
- Catatan:
  - **Pelajaran alat**: audit XSS pertama saya MELEWATKAN `cust.`, `t.`,
    dan `kpi.` karena daftar variabel DB-nya hanya `o/s/p/v/c/d/r`.
    Daftar itu sudah diperlebar. Jika menambah renderer baru, jalankan
    `python tools/audit_xss.py` — jangan andalkan mata.
  - **Jangan tambah esc() berlapis**: `esc()` sengaja TIDAK idempoten
    (`esc(esc('<b>'))` → `&amp;lt;b&amp;gt;` merusak tampilan). Satu
    pemanggilan per titik penyuntikan.
  - Escaping di klien adalah lapis kedua. Lapis pertama (validasi/sanitasi
    input saat registrasi) sudah ada di B2, tetapi `_validate.js` memang
    tidak dimaksudkan untuk menghapus tag HTML — nama seperti "O'Brien"
    sah. Jadi escaping saat render adalah mekanisme yang benar.
  - Berikutnya: **B3** (JWT secret dari env) atau FASE C. A6 + B3 masih
    terblokir (butuh Cloudflare API token).

## Tick 15 — 2026-09-09T18:55:00+08:00 (B11 — hak akses laporan + rentang tanggal)

- Task: **B11** — ditemukan saat orientasi, BELUM pernah ada di backlog.
- Orientasi: `git pull --rebase` bersih. Baseline: B10 29/29, B9 32/32,
  B8 35/35, B5 50/50, B2 47/47, B7 HIJAU, B1 HIJAU, A3b 15/15,
  audit_xss HIJAU, audit_sql 0 temuan, `node --check` 0 error.
- **Jebakan yang menghabiskan waktu tick ini (catat!)**: menjalankan
  `node tools/verify_b10.mjs` LANGSUNG menghasilkan MERAH 14/29. Itu PALSU.
  Tanpa pembungkus `verify_b10_run.mjs`, loader `sql_guard_loader.mjs` tidak
  dipasang, `@tidbcloud/serverless` tidak diganti mock-nya, handler gagal
  menyambung DB → 500. SELALU pakai `*_run.mjs`. Begitu dibuktikan,
  hasilnya HIJAU 29/29 (pernah juga sempat MERAH karena saya menyuntik
  `console.log` debug — sudah dibersihkan dengan `git checkout`).
  `verify_b8_run.mjs` juga sempat MERAH pada "2 hash < 10 ms" (12.57 ms);
  jalankan ulang → 8.09 ms HIJAU. Uji berbasis waktu itu FLAKY.
- **Kenapa defek ini bisa lolos dari SEMUA verifier**: tidak ada satu pun
  harness yang pernah memanggil `/api/reports`. `verify_b7` (kanari SQL)
  dan `verify_b10` (IDOR) tidak menyentuhnya. Pelajaran: cakupan verifier
  = daftar endpoint yang orang ingat, bukan daftar endpoint yang ada.
- Temuan 1 — HAK AKSES (hardening, BUKAN IDOR):
  - Akun Customer menerima 200 + `kpi`/`chart`/`daily` lengkap. Memang ada
    filter `customer_name = ?`, jadi ini BUKAN kebocoran baris orang lain —
    jangan diklaim sebagai IDOR.
  - Yang membuatnya layak diperbaiki: tidak ada satu pun halaman pelanggan
    yang memanggil `/api/reports` (menu Laporan hanya dirender untuk
    `isStaff` di `public/app.js`). Jadi 3 query agregat per permintaan
    murni terbuang, dan permukaannya harus diuji setiap kali skema laporan
    berubah.
- Temuan 2 — RENTANG TANGGAL:
  - `?start=`/`?end=` diambil mentah, lalu DISAMBUNG ke string
    `' 00:00:00'`/`' 23:59:59'` sebelum masuk `BETWEEN ? AND ?`.
  - Placeholder mencegah injeksi (B7), tetapi bukan mencegah nilai ngawur:
    `start=bukan-tanggal` → 200 menyapu nol baris, rentang terbalik → 200,
    rentang 10.000 tahun → 200 menyapu seluruh tabel, kirim salah satu saja
    = "tanpa batas".
  - `tools/audit_sql_injection.py` TIDAK menemukannya: aturannya "nilai yang
    sudah lewat `cleanStr()` dianggap aman" — benar untuk placeholder `?`,
    SALAH untuk penyambungan string. **Pembersihan ≠ validasi format.**
- Perubahan:
  - BARU `functions/_reportfilter.js`: satu penjaga `dateRange()`.
    Mengembalikan string datetime LENGKAP supaya pemanggil tidak perlu
    menyambung apa pun (sumber nilai mentah pada temuan 2). Menolak format
    salah, `2026-02-31`, rentang terbalik, >3660 hari, rentang sebelah.
  - `reports.js`: 403 untuk bukan staf SEBELUM menyentuh DB; `dateRange()`
    menggantikan penyambungan string; `custFilter` dihapus (staf melihat
    seluruh toko → dead code setelah 403).
  - `.gitignore`: tambah `.tmp/` (scratch tick).
- Alat: `tools/verify_b11.mjs` + `verify_b11_run.mjs` — 41 uji yang mengukur
  status, isi JSON, DAN SQL yang benar-benar terkirim lewat `mock_tidb`.
- **Bukti defek (diukur, bukan diklaim)**: kode lama di-checkout dari HEAD,
  harness dijalankan → **MERAH 23/41**, dengan baris
  `reports sebagai Customer -> status=200` dan
  `start tidak valid -> terkirim=3 SELECT`. Kode baru → **HIJAU 41/41**.
- Verifikasi (lokal): B11 41/41; regresi B1 HIJAU, B2 47/47, B5 50/50,
  B7 HIJAU (0 temuan, 68 literal), B8 35/35, B9 32/32, B10 29/29,
  A3b 15/15, audit_xss HIJAU, `node --check` 0 error.
- Verifikasi (produksi, setelah deploy ~100 s):
  - `/` 200, `/api/health` 200, `/api/services` 200, `/dashboard` 200.
  - `/api/reports` tanpa sesi → **401** `{"ok":false,"msg":"Unauthorized"}`.
  - Token Customer yang DITANDATANGANI DENGAN KUNCI PRODUKSI
    (`JWT_SECRET` dari wrangler.toml) → **403**
    `{"ok":false,"msg":"Laporan hanya tersedia untuk Admin, Owner, dan
    Staff"}` — jadi 403 itu bukan artefak uji lokal.
  - Token Customer yang sama: `/api/orders` 200, `/api/dashboard` 200 →
    fitur pelanggan TIDAK rusak.
  - Login admin 1× (hati-hati rate limit): tanpa rentang → 200 dengan isi
    nyata (`kpi.rev 175000`); rentang sah `2026-09-01..2026-09-09` → 200;
    `start=bukan-tanggal` → **400** `Format start tidak valid (YYYY-MM-DD)`;
    hanya `start` → **400** `Rentang tanggal tidak lengkap`; terbalik →
    **400** `Rentang tanggal terbalik`.
  - Admin: dashboard/orders/customers/delivery tetap 200.
- Commit: `5534bc3`
- Status: **SUKSES**
- Catatan:
  - Perbaikan ini sengaja TIDAK diklaim sebagai IDOR. Menutup akses yang
    tak terpakai adalah hardening; menyebutnya kebocoran data akan
    menyesatkan tick berikutnya.
  - Peringatan untuk tick berikutnya: kalau pelanggan kelak perlu "riwayat +
    total belanjaku" (backlog C6), buat endpoint BARU dengan agregat per
    pelanggan — BUKAN membuka kembali `/api/reports`.
  - Berikutnya: masih ada endpoint yang belum punya harness — `checkin.js`
    dan `vouchers.js` belum pernah diukur. Kandidat task tick 16.
    A6 + B3 tetap terblokir (butuh Cloudflare API token; `npx wrangler
    whoami` → "You are not authenticated").
=====

## Tick 16 — 2026-09-10T16:20:00+08:00 (B12 — hari check-in Asia/Jakarta, bukan UTC)

- Task: B12 — zona waktu `daily_checkins` + harness untuk `checkin.js` dan
  `vouchers.js` (dua endpoint yang dicatat tick 15 sebagai "belum punya
  harness").
- Temuan — `new Date().toISOString().split('T')[0]` menghasilkan hari **UTC**.
  Workers berjalan di UTC; operasional laundry di WIB (UTC+7). Antara pukul
  00:00–06:59 WIB — persis jam toko mulai buka — "hari ini" menurut kode
  adalah **kemarin**. Dampaknya dua arah: check-in pagi tercatat di baris
  kemarin, sehingga penjaga "sudah check-in hari ini" tidak pernah melihatnya
  dan hari yang sama bisa membuahkan DUA baris.
- Perubahan:
  - BARU `functions/_today.js` — `APP_TZ = 'Asia/Jakarta'` dan `todayIn()`;
    memakai `Intl.DateTimeFormat('en-CA', …)` karena format lokalnya persis
    `YYYY-MM-DD`. Fallback ke UTC bila `Intl` gagal (lebih baik salah jam
    daripada 500).
  - `functions/api/checkin.js`: dua pemanggilan `toISOString()` diganti
    `todayIn()` (GET + POST).
  - `tools/mock_tidb.mjs`: `__MOCK_ROWS` boleh berupa FUNGSI
    `(sql, params) => rows`, bukan hanya array. Perlu karena check-in
    menjalankan SELECT "sudah ada?" lalu SELECT COUNT(*) dan harness harus
    membedakan jawabannya.
  - BARU `tools/verify_b12.mjs` + `verify_b12_run.mjs` — 33 uji yang mengukur
    status, isi JSON, dan SQL + params yang benar-benar terkirim.
- **Bukti defek (diukur, bukan diklaim)**: kode lama di-checkout dari HEAD
  (`git show HEAD:functions/api/checkin.js`), harness dijalankan →
  **MERAH 29/33**, dengan baris `06:00 WIB -> hari terkirim=2026-09-10 (harus
  2026-09-11)` dan `POST 06:00 WIB -> [9,"2026-09-10"]`. Kode baru →
  **HIJAU 33/33**. Berkas lama dikembalikan setelahnya.
- Verifikasi (lokal): B12 33/33; regresi B1 HIJAU, B2 47/47, B5 50/50,
  B7 HIJAU (0 temuan interpolasi, 68 literal), B8 35/35, B9 32/32, B10 29/29,
  B11 41/41, A3b 15/15, audit_xss HIJAU, `node --check` 0 error.
- Verifikasi (produksi, setelah deploy ~100 s):
  - `/` 200, `/api/health` 200, `/api/services` 200, `/dashboard` 200.
  - `/api/checkin` tanpa sesi → **401** `{"ok":false,"msg":"Unauthorized"}`.
  - Login admin (field `identity`, bukan `email` — salah pakai `email` memberi
    400 "Identitas wajib diisi"), lalu:
    GET → `{"ok":true,"checked_today":false,"total_checkins":"0"}`;
    POST → `{"ok":true,"msg":"Check-in sukses!","total_checkins":"1"}`;
    GET → `{"ok":true,"checked_today":true,"total_checkins":"1"}`;
    POST lagi → **400** `{"ok":false,"msg":"Sudah check-in hari ini"}`.
    Penjaga hari bekerja pada hari yang benar.
- Commit: `1c2af13`
- Status: **SUKSES**
- Catatan:
  - Endpoint `/api/auth/login` menerima field `identity` (bukan `email`) —
    berguna untuk tick berikutnya yang perlu token produksi.
  - `vouchers.js` ikut terukur oleh harness B12 dan ternyata SUDAH aman:
    tanpa sesi 401, `promo_id` bukan angka/nol/negatif/hilang 400, aksi tak
    dikenal 400, `claim` sebagai Customer 401, `bulk_claim` 501 id 400,
    sebagai Admin 200 + 1 INSERT. Jangan diubah tanpa alasan.
  - Berikutnya: pola `toISOString().split('T')[0]` masih ada di
    `functions/api/delivery.js` (`schedule_date`). Hanya nilai bawaan saat
    klien tak mengirim tanggal, jadi tidak ada penjaga "sudah ada" yang
    bergantung padanya — prioritas rendah. A6 + B3 tetap terblokir
    (butuh Cloudflare API token).

## Tick 17 — 2026-09-10T16:55:00+08:00 (B13 — validasi /api/profile + pesan error generik)

- Task: B13 — harness untuk tiga endpoint yang tercatat belum punya harness
  (`me.js`, `logout.js`, `profile.js`) sekaligus menutup celah yang
  ditemukannya.
- Temuan (diukur, kode lama MERAH 55/66 -> baru HIJAU 66/66):
  - `update_profile` hanya memeriksa `if (!name)`. Nama 100.000 karakter
    diteruskan mentah ke TiDB -> 200. `_validate.js` sudah ada sejak B2,
    hanya belum dipakai di `profile.js`.
  - `phone` bukan string -> `(body.phone || '').trim()` melempar TypeError ->
    **500** dengan pesan `(body.phone || "").trim is not a function`.
    Bila `phone` objek, `[object Object]` tersimpan di kolom VARCHAR.
  - Kedua `catch` di `profile.js` mengirim `msg: e.message` -> connection
    string / nama tabel / nomor baris bisa ikut ke klien (kontrak A4).
- Perubahan:
  - `functions/api/profile.js`: `update_profile` memakai `validateOr400()`
    (nama 2-120, telepon <=30); kedua pesan 500 digenerik.
  - `functions/_validate.js`: field `str`/`email`/`date` menolak objek &
    array (sebelumnya `String({})` = `[object Object]` lolos karena
    panjangnya "valid").
  - BARU `tools/verify_b13.mjs` + `verify_b13_run.mjs` — 66 uji untuk
    `/api/me`, `/api/auth/logout`, `/api/profile`.
  - BARU `tools/run_all_verifiers.sh` (semua verifier sekaligus) dan
    `tools/baseline.sh` (cek produksi cepat).
- Verifikasi (lokal, nol regresi): B13 66/66; B1 HIJAU, B2 47/47, B5 HIJAU,
  B7 HIJAU (0 temuan interpolasi), B8 HIJAU, B9 HIJAU, B10 29/29, B11 41/41,
  B12 33/33, A3b HIJAU, audit_xss HIJAU, `node --check` 0 error.
- Verifikasi (produksi, setelah deploy ~100 s) — `bash tools/probe_b13_live.sh`:
  - `/` 200, `/dashboard` 200, `/api/health` 200, `/api/services` 200.
  - Tanpa sesi: `/api/me` 401, `/api/profile` GET+POST 401.
  - Login admin (field `identity`), lalu:
    GET `/api/profile` 200, `password_hash` **tidak** ikut terkirim;
    nama 100.000 char -> **400** "Validasi gagal: Nama terlalu panjang
    (maksimal 120 karakter)";
    `phone` objek -> **400** "Validasi gagal: Format Telepon tidak valid";
    nama 1 char -> **400** "Nama terlalu pendek (minimal 2 karakter)";
    nama+telepon wajar -> **200** (fitur tidak mati);
    logout 200 + `Set-Cookie: session_token=; HttpOnly; Secure;
    SameSite=Lax; Path=/; Max-Age=0`.
  - Header B4 tetap ada di `/api/me`: nosniff, X-Frame-Options: DENY,
    Referrer-Policy.
- Commit: `3145171`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - Pola `msg: e.message` MASIH ADA di 18 titik lain (checkin, customers,
    dashboard, delivery, orders, pay, promos, reports, services, vouchers,
    login, register). B13 baru membersihkan `profile.js`. Kalau mau
    dilanjutkan, kerjakan per modul dengan harness-nya sendiri — jangan
    sapu semua sekaligus tanpa uji.
  - Endpoint yang tercatat "belum punya harness" (tick 15/16) kini semuanya
    terukur: `me`, `logout`, `profile`, `checkin`, `vouchers`.
  - A6 + B3 tetap terblokir (butuh Cloudflare API token).

## Tick 18 — 2026-09-10T17:20:00+08:00
- Task: B14 — pesan error generik di 20 titik (11 modul) + validasi `/api/pay`
  (P1). Ini adalah AGENT_BACKLOG.md entri 12 ("sisa pekerjaan yang nyata"),
  lanjutan langsung dari B13.
- Temuan (diukur, bukan diasumsikan):
  - Pola `msg: e.message` ternyata **20 titik** di 11 modul — bukan 18
    seperti catatan tick 17: checkin (2), customers (2), dashboard (1),
    delivery (2), orders (2), pay (2), promos (2), reports (1), services
    (2), vouchers (2), login (1), register (1).
  - `e.message` berasal dari driver @tidbcloud/serverless → dapat memuat
    connection string, nama database, nama tabel, nomor baris. Harness
    menyuntikkan pesan berpenanda; teksnya muncul utuh di 20 endpoint.
  - **Celah B2 baru di `/api/pay`**, 4 sub-defek:
    (a) `parseInt([1,2])` = 1 → array menjadi nilai uang yang sah, INSERT
        tetap jalan, 200.
    (b) tanpa batas atas → `amount: 2000000000` diterima.
    (c) `method` mentah ke kolom ENUM → nilai asing = 500 dari TiDB.
    (d) `order_code` tak dibatasi padahal VARCHAR(20).
- Perubahan:
  - BARU `SERVER_ERROR` di `functions/_db.js` — satu sumber pesan 500
    generik; 20 titik kini memakainya.
  - `functions/api/pay.js`: `amount`/`method`/`order_code` lewat
    `validateOr400()`; enum `method` mengikuti DATABASE_SCHEMA.md;
    GET `?order_code=` > 40 karakter → 400.
  - BARU `tools/verify_b14.mjs` + `verify_b14_run.mjs` (76 uji) dan
    `tools/probe_b14_live.sh` (uji produksi).
  - `tools/run_all_verifiers.sh`: B14 ikut dijalankan.
- Verifikasi (lokal): B14 **76/76**; B1, B2 47/47, B5, B7, B8, B9,
  B10 29/29, B11 41/41, B12 33/33, B13 66/66 HIJAU; `node --check` 0 error.
  Catatan: B8 sempat MERAH pada uji WAKTU "2 hash < 10 ms" (13,65 ms) saat
  11 verifier dijalankan berurutan → HIJAU 35/35 pada 3x ulang terpisah.
  `_password.js` tidak disentuh.
- Verifikasi (produksi, setelah deploy ~100 s) — `bash tools/probe_b14_live.sh`:
  - `/` 200, `/dashboard` 200, `/api/health` 200, `/api/services` 200.
  - Tanpa sesi: `/api/me`, `/api/orders`, `/api/customers`, `/api/reports`
    401; `/api/pay` 400.
  - `/api/pay`: amount array → 400; amount 2e9 → 400; amount -1000 → 400;
    body JSON rusak → 400; order_code raksasa → 400; method asing → 400
    `{"ok":false,"msg":"Validasi gagal: Metode pembayaran tidak valid"}`
    (teks baru membuktikan kode baru sudah hidup).
  - Login admin → 200; `/api/me`, `/api/orders`, `/api/dashboard`,
    `/api/checkin`, `/api/vouchers` bersesi → 200 (fitur tidak mati).
  - Header B4 utuh: nosniff, X-Frame-Options: DENY, Referrer-Policy.
- Commit: `58fb1b5`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - Dua angka 404 di probe BUKAN kegagalan: `pay GET ?order_code=200X`
    ditolak validasi lebih dulu, dan `method` asing berhenti di "pesanan
    tidak ditemukan" sebelum `method` diuji. Uji dengan order_code yang ADA.
  - `verify_b8` mengandung uji WAKTU — ulangi sebelum menyimpulkan regresi.
  - Audit statik di `verify_b14` membuang komentar dulu; tanpa itu
    `profile.js` MERAH PALSU (komentar B13 menyebut `msg: e.message`).
  - A6 + B3 tetap terblokir (butuh Cloudflare API token).
  - Backlog: FASE B kini tinggal A6/B3 (terblokir). FASE C (C1–C10) belum
    tersentuh; prioritas berikutnya P2 = C1/C2/C3/C6/C7/C8.

---

## Tick 19 — 2026-09-10T17:50:00+08:00 (housekeeping MD + aturan keras baru)

Bukan task fitur — sesi ini menata ulang dokumen loop dan menambal dua
celah operasional yang ditemukan saat memantau loop.

- Perubahan:
  - `AGENT24.md` — **Aturan Keras 13 & 14** (Bagian 3):
    - 13: dilarang menulis secret/kredensial ke file di working tree.
    - 14: tick tidak boleh menggantung >~20 menit tanpa hasil.
  - `AGENT_STATE.md` — bagian baru "Konfigurasi loop" + "Insiden tercatat".
  - `AGENT_BACKLOG.md` — bagian baru "Catatan Operasional Loop (bukan task)".
  - `AGENT_LOG.md` — entri ini.
- Insiden yang mendasari aturan baru:
  - **Kebocoran secret**: sebuah tick menulis `TIDB_DATABASE_URL` ke
    `.tmp/dburl.txt`. File dihapus; terverifikasi `.tmp/` tidak terlacak git
    (`git ls-files .tmp/` kosong, `git check-ignore` → `.gitignore:9`).
    Tidak pernah masuk riwayat git.
  - **Tick menggantung**: fire 19:02 dan 19:22 (2026-09-09) berjalan 20+
    menit tanpa commit, sehingga fire berikutnya dilewati terus.
- Verifikasi:
  - `git ls-files .tmp/` → kosong (aman)
  - `git check-ignore -v .tmp/dburl.txt` → `.gitignore:9:.tmp/`
  - Loop tetap aktif; commit terakhir sebelum sesi ini `58fb1b5` (tick 18).
- Catatan lingkungan:
  - EquipRent dibiarkan jalan berdampingan (keputusan user). Scheduler satu
    job per waktu → penundaan 1–2 jam wajar, bukan insiden.
  - Watchdog disesuaikan: `RIVAL_IDS=[]`, `STALE_HOURS` 3 → 6 jam.
- Status: **DONE** (housekeeping)

---

## Tick 20 — 2026-09-10T18:08:00+08:00

- Task: **C2** — Tracking order publik by kode (tanpa login) (P2)
- Perubahan:
  - Buat `functions/api/track.js` — endpoint publik `GET /api/track?code=...` (dan `?order_code=...`)
  - Daftarkan routing `/api/track` di `src/index.js`
  - Proteksi privasi pelanggan (B10): `customer_phone` & `customer_address` tidak diekspos (absen dari JSON), nama pelanggan disamarkan (`maskName()`, e.g. "Budi S.")
  - Rate limiting (B1): 20 req/5m per IP sebelum menyentuh TiDB
  - Input validation (B2): kode 3..20 karakter, alfanumerik / hyphen / underscore saja
  - Hardening server error (B14): kegagalan DB mengembalikan `SERVER_ERROR` generik tanpa membocorkan koneksi
  - UI landing page (`public/index.html`):
    - Tombol "Lacak Pesanan" di navbar dan Hero CTA
    - Modal interaktif `#trackModal` + visual progress stepper (Diterima → Diproses → Selesai)
    - Kartu rincian pesanan + status pembayaran (Lunas / Belum Lunas)
    - Tautan cepat "Bayar Sekarang" jika tagihan belum lunas
    - Dukungan URL param otomatis: `/?track=ORD-XXX` langsung membuka modal tracking
  - Harness uji: `tools/verify_c2.mjs` & `tools/verify_c2_run.mjs` (47/47 uji HIJAU)
- File: `functions/api/track.js`, `src/index.js`, `public/index.html`, `tools/verify_c2.mjs`, `tools/verify_c2_run.mjs`, `tools/run_all_verifiers.sh`
- Verifikasi:
  - Gate 1: `node --check` pada semua file JS/ESM → exit 0
  - Gate 2: `</html>` tepat 1 di `public/index.html`
  - Gate 5: 0 warna hardcoded hex baru (semua token CSS)
  - Gate 6: Aksesibilitas aria-label + role="dialog"
  - Gate 7: Struktur landing page utuh
  - Verifier suite: `tools/run_all_verifiers.sh` → 12/12 HIJAU (verify_c2: 47/47)
- Commit: `1551773`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - FASE C: C2 selesai. Task P2 berikutnya: C1 (Katalog Layanan publik + filter) atau C3 (Notifikasi status polling).

---

## Tick 21 — 2026-09-10T18:12:00+08:00

- Task: **C1** — Halaman "Layanan" publik + filter (P2)
- Perubahan:
  - `functions/api/services.js`: publik secara default diproteksi hanya melihat layanan aktif (`is_active = 1`); staf dapat melihat non-aktif dengan `?status=nonaktif`
  - `public/index.html`:
    - Bilah pencarian instan `#serviceSearchInput` untuk mencari nama atau deskripsi pakaian
    - Filter kategori dinamis `#categoryPills` (`Semua`, `Reguler`, `Express`, `Satuan`, `Dry Cleaning`) dengan indikator aktif & tablist aksesibilitas
    - Kartu layanan dinamis dengan badge kategori, harga/satuan (`/kg`, `/pcs`), durasi, deskripsi, dan tombol order modal
    - Tampilan kosong (empty state) ramah dengan tombol "Reset Filter"
  - `public/track.html`: Halaman mandiri pelacakan pesanan publik terintegrasi
  - Harness uji: `tools/verify_c1.mjs` & `tools/verify_c1_run.mjs` (18/18 uji HIJAU)
- File: `functions/api/services.js`, `public/index.html`, `public/track.html`, `tools/verify_c1.mjs`, `tools/verify_c1_run.mjs`, `tools/run_all_verifiers.sh`
- Verifikasi:
  - Gate 1: `node --check` sintaks bersih → exit 0
  - Gate 2: `</html>` tepat 1 di `index.html` dan `track.html`
  - Gate 5: 0 warna hex baru (semua via CSS tokens)
  - Gate 6: Aksesibilitas `role="tab"` + `aria-selected` + `aria-label`
  - Gate 7: Struktur `#pricesGrid` utuh
  - Verifier suite: `tools/run_all_verifiers.sh` → 13/13 HIJAU
- Commit: `1a02520`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - FASE C: C1 dan C2 selesai. Task P2 berikutnya: C3 (Notifikasi status polling) atau C6 (Riwayat order pelanggan).


---

## Tick 22 — 2026-09-10T18:20:00+08:00 (C2 — penguatan harness kontrak UI)

Bukan fitur baru: memperkuat harness C2 yang sudah ter-commit (`1551773`).

- Latar belakang: harness C2 hanya menguji kontrak BARU (`?code=`). Padahal
  landing page (`fetchTrackOrder` di index.html) memanggil `?order_code=` dan
  memakai `progress_step`, `unit`, serta `delivery` — sebelum endpoint ini
  ada, fitur "Lacak Pesanan" di landing **404 (mati)**. Tanpa uji untuk
  kontrak lama, perubahan pada parameter atau `progress_step` bisa mematikan
  UI lagi tanpa satu pun verifier menjadi MERAH.
- Perubahan: `tools/verify_c2.mjs` +41 baris (11 uji baru).
  - `?order_code=` tetap berfungsi (kontrak lama yang dipakai index.html).
  - `progress_step`: baru 0, proses 1, selesai 2, batal -1.
  - `unit` layanan ikut terkirim.
  - `delivery.type`/`status` ikut, dan terbukti TIDAK bawa alamat/telepon.
- **Uji mutasi (bukan sekadar hijau)** — tiga kali sengaja merusak kode:
  1. hapus dukungan `?order_code=`        -> MERAH 56/58
  2. bocorkan `customer_phone`/`_address` -> MERAH 54/58
  3. `progress_step` selesai 2 -> 1       -> MERAH 57/58
  Setelah dipulihkan: HIJAU 58/58. Uji ini membuktikan harness punya gigi.
- Kode produksi TIDAK diubah: `functions/api/track.js` identik dengan HEAD.
- Verifikasi: 13 verifier HIJAU (C2 58/58); `node --check` 0 error.
- Verifikasi produksi (setelah deploy ~95 s):
  - `/api/track?order_code=ORD-ABC123` -> **404 JSON terstruktur**
    `{"ok":false,"msg":"Pesanan tidak ditemukan"}` (sebelumnya 404 "Endpoint
    not found" dari router = endpoint belum ada).
  - `/track.html` -> 307 -> 200 di `/track`.
  - OPTIONS `/api/track` -> 204 (preflight tidak menghabiskan jatah).
  - Header B4 utuh: nosniff, X-Frame-Options: DENY, Referrer-Policy;
    X-RateLimit-Limit: 20 ikut terkirim.
  - **Dengan data nyata** `ORD-260906CCC` (tanpa cookie):
    200, `progress_step: 2` (selesai), `unit: "kg"`, dan **nol field
    telepon/alamat** — PII terbukti tidak bocor di produksi.
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - **Ada agent lain yang mengerjakan repo ini bersamaan.** Saat tick
    berjalan, `run_all_verifiers.sh` dan `AGENT_LOG.md` diubah oleh sibling
    subagent; C2 (`1551773`) dan C1 (`1a02520`) ter-commit di luar tick ini.
    SELALU `git status` + `git diff HEAD` sebelum menyimpulkan bahwa
    pekerjaanmu hilang — dan refresh `.agent-lock` bila tick panjang.
  - Endpoint ini sengaja publik dan TANPA login. Kode pesanan hanya ~46 ribu
    kemungkinan per milidetik, jadi yang boleh bocor hanyalah status dan
    nominal. Jangan pernah menambah field ke `publicView()` tanpa uji
    "TIDAK bocor" yang baru.


---

## Tick 23 — 2026-09-10T18:35:00+08:00 (B15 — validasi `/api/delivery` + jadwal Asia/Jakarta)

Latar belakang: `delivery.js` adalah satu-satunya modul yang TIDAK ikut
dipasangi `validateOr400()` pada B2 (tick 11). Tujuh modul lain sudah;
delivery tertinggal. Celah ini dicatat sendiri di `_today.js` sejak B12:
"pola `toISOString().split('T')[0]` masih ada di `functions/api/delivery.js`
untuk `schedule_date`". Jadi satu tick menutup dua hal: input tanpa
validasi, dan tanggal yang salah zona.

- Diukur DULU dengan probe sementara (13 kasus) sebelum mengubah apa pun.
  Kode lama menerima SEMUANYA dengan 200:
  - `customer_name` 5.000 char -> masuk ke `VARCHAR(80)` -> 500 dari TiDB
  - `phone` objek `{n:1}`      -> `[object Object]` tersimpan di VARCHAR(30)
  - `address` array `['a','b']`-> `"a,b"` (koersi JS) tersimpan di TEXT alamat
  - `order_code` 9.000 char    -> melampaui VARCHAR(40)
  - `notes` 20.000 char, `schedule_date:'besok-saja'`, `start_time:'pagi sekali'`
  - `id: [5,9]` pada update_status -> `parseInt([5,9])` = 5, elemen pertama
    dipakai, sisanya dibuang tanpa keluhan; `id: -3` juga lolos
  - `courier_id: -7` pada assign_courier -> diterima mentah
  Kolom yang dipertaruhkan: **alamat dan telepon pelanggan**.
- Perubahan produksi (2 berkas):
  - `functions/api/delivery.js`: seluruh field `create_task` lewat
    `validateOr400()`; batas mengikuti `DATABASE_SCHEMA.md` (nama 80, telepon
    30, kode pesanan 40, alamat/catatan 2000). Tiga aksi lain
    (`update_status`, `assign_courier`, `delete_task`) ikut divalidasi.
    Parameter GET (`status`, `date`) dibersihkan + divalidasi.
    Jadwal bawaan `toISOString().split('T')[0]` -> `todayIn()` (`_today.js`).
  - `functions/_validate.js`: TIPE BARU `time` (`HH:MM`/`HH:MM:SS`, untuk
    kolom MySQL `TIME`) + `isTime()`. `type:'int'` kini MENOLAK objek/array —
    sebelumnya `{id:[3]}` lolos karena `Number([3])` = 3.
- BARU `tools/verify_b15.mjs` + `verify_b15_run.mjs` — 93 uji. Uji mengukur
  SQL/params yang BENAR-BENAR terkirim, bukan teks sumber.
- **Tiga hijau palsu yang ditemukan pada harness SENDIRI (penting):**
  1. `if (patch.type === undefined) delete body.type;` — karena hampir semua
     patch tidak punya kunci `type`, SETIAP kasus kehilangan `type` dan
     menjadi 400 karena "Tipe wajib diisi", BUKAN karena field yang diuji.
     Uji mutasi (batas nama dibuka jadi 100.000) tetap HIJAU 91/91 padahal
     kode sudah rusak. Diperbaiki dengan `'type' in patch &&`.
  2. Uji zona waktu tidak bisa HIJAU MERAH bila WIB dan UTC sedang hari yang
     sama — terbukti: mutasi "jadwal balik ke UTC" HIJAU 91/91. Ditambah uji
     dengan JAM DIBEKUKAN ke `2026-09-10T23:00:00Z` (= 06:00 WIB hari
     berikutnya), sehingga kedua zona pasti beda hari.
  3. Karena pembekuan `Date` menyentuh scope global, ditambah uji bahwa jam
     pulih sesudahnya (selisih < 60 dtk) agar kebocoran tidak merusak uji lain.
- **Uji mutasi (7x sengaja merusak kode) — semua terbukti MERAH:**
  | 1 batas nama -> 100.000        | MERAH 90/93 |
  | 2 `date` -> str bebas          | MERAH 87/93 |
  | 3 `time` -> str bebas          | MERAH 90/93 |
  | 4 jadwal balik ke UTC          | MERAH 92/93 |
  | 5 Customer boleh pilih kurir   | MERAH 91/93 |
  | 6 validasi create_task dilewati| MERAH 60/93 |
  | 7 filter GET status dimatikan  | MERAH 92/93 |
  Dipulihkan: HIJAU 93/93.
- Regresi: `tools/run_all_verifiers.sh` **14/14 HIJAU** (B15 93/93 masuk
  daftar). `node --check` semua fungsi + src + tools bersih.
  `audit_sql_injection.py` 0 temuan, `audit_xss.py` HIJAU.
- **Terbukti di produksi** (setelah deploy ~100 dtk, `abc9922`):
  - 10 input ngawur -> **400** dengan pesan spesifik ("Nama pelanggan
    terlalu panjang (maksimal 80 karakter)", "Format Jam mulai tidak valid
    (HH:MM)", "Format ID tidak valid", "Kurir di luar rentang...").
  - Jalur SUKSES tidak mati: `create_task` wajar -> **200**, baris tersimpan
    `schedule_date: "2026-12-24"`, `start_time: "09:30:00"`.
  - B10 utuh: tanpa sesi -> **401** (POST dan GET).
  - B4 utuh: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy.
  - B5 utuh: origin `evil.example.com` -> tanpa ACAO, `Vary: Origin`.
  - OPTIONS preflight -> 204.
- Commit: `abc9922`
- Status: **SUKSES**
- Catatan untuk tick berikutnya:
  - Tipe `time` di `_validate.js` hanya dipakai delivery. Bila modul lain
    (mis. jam operasional toko di settings) butuh kolom TIME, pakai tipe ini.
  - `_validate.js` kini menolak objek/array untuk `int` juga. Bila ada klien
    sah yang mengirim id berupa array, itu bug klien — jangan dilonggarkan.
  - Modul yang BELUM punya harness khusus validasi: `customers.js` POST
    (sudah lewat B2, belum punya harness sendiri), `services.js` idem.
    Kandidat B16 bila backlog fitur sedang kosong.

## Tick 25 — B17: wajib sesi pada POST /api/pay (P0)

- Commit: `a8ca085`
- Status: **SUKSES**

- Awal tick: `.agent-lock` berusia **109,98 menit** (dari 19:26) → lock basi
  karena tick 24 crash SEBELUM sempat merapikan dokumen. Lock dihapus, lalu
  dibuat ulang. Karena itu tick ini juga menyelesaikan **pekerjaan buku
  tick 24 (B16)** yang tertinggal: B16 sudah ter-commit `502d56a` (20:06)
  dan terbukti di produksi, tetapi belum tercatat di backlog/log/state.

- **B16 (tick 24) — diverifikasi ulang, bukan dikerjakan ulang.**
  `node tools/verify_b16_run.mjs` → **HIJAU 156/156**. Terbukti di produksi
  dengan nilai batas (N → 200, N+1 → 400):
  | orders.customer_name | 100 → 200, 101 → 400 "maksimal 100 karakter" |
  | services.name        |  80 → 200,  81 → 400 "maksimal 80 karakter"  |
  | customers.address    | 255 → 200, 256 → 400 "maksimal 255 karakter" |
  | promos.expires_at    | 'besok-saja' → 400 (dulu 500)                |
  Jalur sukses tidak mati: `create_customer` wajar → 200, baris tersimpan.

- **B17 — celah baru, ditemukan saat mengukur B16 di produksi.**
  Untuk menguji batas butuh kode pesanan nyata; saat mencoba `POST /api/pay`,
  permintaan TANPA cookie mengembalikan **200 + `qr_payload`** dan baris
  `payments` tersimpan atas `ORD-MTVK0BVGUA5`. `POST /api/pay` tidak punya
  pemeriksaan sesi sama sekali; `public/pay.html` hanya memanggil GET, jadi
  tidak ada klien sah yang memakai POST ini.
  - **GET TETAP PUBLIK dan sengaja demikian** (halaman pembayaran dibuka
    lewat tautan berkode; B10 menyensor telepon & alamat). Jangan "diperbaiki".
- Perubahan (1 berkas): `functions/api/pay.js`
  - `!user` → 401 diletakkan SEBELUM `db.query()`.
  - Setelah pesanan ketemu: pemilik (`customer_name` cocok) atau staf
    (Admin/Owner/Staff) boleh lanjut; pelanggan asing → 401.

- BARU `tools/verify_b17.mjs` + `verify_b17_run.mjs` — **19 uji**. Yang
  diukur adalah INSERT yang BENAR-BENAR terkirim, bukan status.
- Sebelum diperbaiki: **MERAH 14/19** (harness punya gigi).
- **Uji mutasi (5x) — semua MERAH:**
  | 1 hapus guard !user (kode lama)    | MERAH 18/19 |
  | 2 guard dipindah SETELAH INSERT    | MERAH 18/19 |
  | 3 pelanggan asing selalu diizinkan | MERAH 17/19 |
  | 4 staf ikut ditolak (fitur mati)   | MERAH 17/19 |
  | 5 GET publik ikut ditutup          | MERAH 17/19 |
  Dipulihkan: **HIJAU 19/19**.
  Mutasi 2 yang terpenting: 401 yang dikembalikan SETELAH `db.execute()`
  tetap meninggalkan baris — tanpa uji ini, "perbaikan" yang menolak
  terlambat akan tampak benar.
- Jebakan harness yang ditemui: token uji dibuat dari `{role, full_name}`,
  bukan `{user_role, user_name}`. Salah bentuk → staf menjadi "Customer"
  → uji MERAH karena kesalahan harness. Sudah diberi komentar di berkas.
- Regresi: `run_all_verifiers.sh` **16/16 HIJAU** (B17 19/19 masuk daftar;
  `run_all_verifiers.sh` ditambahi entri B17). `audit_sql_injection.py`
  exit 0, `audit_xss.py` HIJAU, `node --check` bersih.
- **Terbukti di produksi** (setelah deploy; butuh ~200 dtk, bukan ~90):
  - POST tanpa sesi → **401 `{"ok":false,"msg":"Unauthorized"}`** (dulu 200).
  - GET anonim → **200**, `customer_phone`/`customer_address` = null,
    `total_amount` tetap terkirim → B10 & C2 utuh.
  - POST staf bersesi → **200** + `qr_payload` → fitur kasir tidak mati.
  - `/`, `/api/health`, `/api/services` → 200.

- Catatan untuk tick berikutnya:
  - **Pola audit yang belum dilakukan: "uji kata kerja TULIS pada setiap
    modul yang GET-nya sengaja publik."** B17 lolos karena `verify_b10`
    hanya menguji GET `pay.js`. Kandidat pemeriksaan serupa: `track.js`
    (publik by design) — perlu dicek apakah ia punya jalur tulis.
  - Deploy kali ini butuh ~200 detik; bila post-verify masih menunjukkan
    perilaku lama, ulangi sekali sebelum menyimpulkan kegagalan.
  - Field login adalah `identity` (bukan `email`/`username`); `customers`
    POST memakai `full_name` (bukan `name`); `orders` list = GET tanpa
    `action`. Salah field menghasilkan 400 yang tampak seperti bug.

## Tick 26 — B18: audit kata kerja TULIS semua modul (`ab7026e`)

Tindak lanjut langsung dari catatan tick 25: "uji kata kerja TULIS pada
setiap modul yang GET-nya sengaja publik." Kandidat yang disebut (`track.js`)
diperiksa lebih dulu — ternyata ia GET-saja dengan 405 untuk kata kerja lain,
jadi aman. Alih-alih memeriksa satu per satu tanpa bukti, dibuat jaring
regresi untuk SELURUH kelas defeknya.

- **Bukan perbaikan defek.** Tidak ada baris `functions/` yang diubah;
  `git diff --stat` untuk direktori itu kosong. Ini murni penambahan harness.
- **Yang diukur:** 29 aksi tulis pada 10 modul dipanggil TANPA cookie; yang
  dicek adalah SQL tulis yang benar-benar terkirim ke driver, bukan status.
  Alasan (pelajaran B17): 401 yang dikembalikan SETELAH `db.execute()` tetap
  meninggalkan baris, jadi status bisa menipu.
- Cakupan: orders (4 aksi), customers (3), services (4), promos (4),
  vouchers (4), delivery (4), pay, profile (2), checkin, register.
  Tambahan: 4 kata kerja terlarang pada `track.js`, 10 uji jalur sukses
  staf, 3 uji GET publik tidak ikut tertutup (C1/C2/B10).
- **Registrasi diuji dengan asersi TERBALIK** — mendaftar ialah satu-satunya
  penulisan yang memang harus bisa tanpa sesi. Bila kelak ia "diperbaiki"
  menjadi 401, harness harus MERAH.

### Hasil

`node tools/verify_b18_run.mjs` → **HIJAU 76/76**. Nol jalur tulis terbuka.

### Uji mutasi (5x, kode dipulihkan setelah masing-masing)

| # | Mutasi | Hasil |
|---|--------|-------|
| 1 | hapus penjaga `isStaff` di services.js (B17 terulang) | MERAH 73/76 |
| 2 | penjaga digeser sesudah `validate` (masih sebelum tulis) | HIJAU 76/76 |
| 3 | **tulis SEBELUM penjaga**, services.js | MERAH 72/76 |
| 4 | `track.js` menerima POST | MERAH 74/76 |
| 5 | `isStaff = false` (fitur mati) | MERAH 74/76 |

Mutasi 3 yang terpenting: status **401 namun UPDATE tetap terkirim** —
persis pola B17. Tanpa mengukur SQL, mutasi ini tampak "benar".

**Mutasi 2 sengaja HIJAU, dan itu bukan kelemahan harness** — penjaga masih
mendahului penulisan, jadi memang bukan celah. Dicatat agar tick berikutnya
tidak "memperbaiki" harness gara-gara angka hijau.

### Temuan yang layak dicatat: mutasi 3 gagal di `delivery.js`

Mutasi "tulis sebelum penjaga" mula-mula dicoba pada `delivery.js` dan tetap
HIJAU 76/76. Diagnosis: `delivery.js` punya penjaga `!user` di **tingkat
atas**, sehingga mutasi setempat tidak dapat menghasilkan penulisan. Baru
setelah mutasi dipindah ke `services.js` (GET publik, tanpa penjaga atas)
pola B17 terbukti MERAH. Pelajaran umum: sebelum menyimpulkan harness lemah,
periksa apakah modul yang dimutasi punya penjaga lapis lain.

### Regresi & verifikasi

- `run_all_verifiers.sh` **17/17 HIJAU** (B18 76/76 masuk daftar).
- `audit_sql_injection.py` exit 0; `audit_throw_sites.py` exit 0 ("setiap
  handler tanpa try/catch terbukti nol throw site"); `audit_xss.py` HIJAU.
- `audit_api_guard.py` exit 1 — **sudah ada sebelumnya, bukan regresi**: 10
  handler tanpa try/catch, semuanya dispatcher (`onRequest`) / `health` /
  `me.js` yang tidak menyentuh DB, dan `audit_throw_sites.py` membuktikan
  nol throw site. Jangan "diperbaiki" tanpa bukti ada defek.
- `node --check` bersih di semua `functions/**` plus berkas baru.
- **Terbukti di produksi:** POST `/api/pay` tanpa sesi → 401; POST
  `/api/services` tanpa sesi → 401; POST `/api/track` → 405; GET
  `/api/services` dan `/api/promos` → 200. Baseline `/`, `/dashboard`,
  `/api/health`, `/api/services`, `/assets/design-tokens.css` → 200.

### Catatan untuk tick berikutnya

- Perubahan bersifat test-only, jadi tidak ada perilaku produksi yang
  berubah; verifikasi produksi di atas hanya membuktikan keadaan sudah benar.
- Pola audit berikutnya yang belum dilakukan: **harness untuk modul yang
  masih belum punya** — `dashboard.js` dan `reports.js` (keduanya GET dan
  sudah berpenjaga `!user`, jadi kemungkinan besar bersih).
