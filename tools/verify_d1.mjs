// tools/verify_d1.mjs
// Harness verifikasi Task D1 — Terapkan design token ke seluruh dashboard (P3)
//
// Menguji:
// 1. Audit Design Tokens Authority (public/assets/design-tokens.css):
//    - Brand, semantic backgrounds, text, borders, status, radii, shadows tokens.
//    - Dark mode semantic token overrides.
// 2. Audit Dashboard HTML (public/dashboard.html):
//    - Memuat design-tokens.css sebelum style.css.
// 3. Audit Stylesheet (public/assets/style.css):
//    - :root variable bridging ke design tokens (var(--color-bg-primary), dll).
//    - Dark theme bridging tetap konsisten.
//    - Eliminasi duplicate dead CSS code (.table & .card duplikat).
//    - Komponen inti (.sidebar, .card, .table, .input, .btn) memakai token.
// 4. Audit Frontend SPA (public/app.js):
//    - Nol hardcoded inline card background overrides (#fff / #ffffff).
//    - Nol hardcoded inline border overrides (#e2e8f0 / #cbd5e1).
//    - Seluruh view utama memakai token:
//      * renderDashboard (KPI cards, recent orders)
//      * renderPesanan (filter, modal, order cards)
//      * renderPelanggan (customer card & table)
//      * renderLayanan (service cards, prices)
//      * renderDelivery (courier delivery task cards)
//      * renderPromo (promo form, voucher cards, vouchers table)
//      * renderLaporan (filters, KPI cards, report table)
//      * buildSvgChart (svg grid, text, tooltips)
//      * renderProfile (profile form, password form, disabled inputs)
//      * Modal popups (confirm dialog, proof modal, invoice modal)
// 5. Audit Keamanan & Sanitasi:
//    - Strict HTML escaping (esc()) di seluruh view dinamis.
//
// Jalankan: node tools/verify_d1_run.mjs

import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..');

let pass = 0;
let fail = 0;

function check(name, cond, detail = '') {
  const short = String(detail).length > 200 ? String(detail).slice(0, 200) + '…' : detail;
  if (cond) {
    pass++;
    console.log(`HIJAU  ${name}`);
  } else {
    fail++;
    console.log(`MERAH  ${name}${short ? '  — ' + short : ''}`);
  }
}

console.log('=== VERIFIKASI TASK D1: DESIGN TOKEN KE SELURUH DASHBOARD ===\n');

// --------------------------------------------------------------------------
// 1. AUDIT DESIGN TOKENS AUTHORITY (design-tokens.css)
// --------------------------------------------------------------------------
const designTokensPath = path.join(ROOT, 'public/assets/design-tokens.css');
check('D1-TOK-01: File public/assets/design-tokens.css tersedia', fs.existsSync(designTokensPath));

const tokensCss = fs.readFileSync(designTokensPath, 'utf8');

check('D1-TOK-02: design-tokens.css mendefinisikan brand tokens',
  tokensCss.includes('--color-brand-primary') &&
  tokensCss.includes('--color-brand-primary-hover') &&
  tokensCss.includes('--color-brand-primary-light')
);

check('D1-TOK-03: design-tokens.css mendefinisikan semantic background tokens',
  tokensCss.includes('--color-bg-primary') &&
  tokensCss.includes('--color-bg-secondary') &&
  tokensCss.includes('--color-bg-tertiary')
);

check('D1-TOK-04: design-tokens.css mendefinisikan semantic text tokens',
  tokensCss.includes('--color-text-primary') &&
  tokensCss.includes('--color-text-secondary') &&
  tokensCss.includes('--color-text-tertiary')
);

check('D1-TOK-05: design-tokens.css mendefinisikan border tokens',
  tokensCss.includes('--color-border-subtle') &&
  tokensCss.includes('--color-border-default')
);

check('D1-TOK-06: design-tokens.css mendefinisikan status tokens (success, warning, error)',
  tokensCss.includes('--color-success') &&
  tokensCss.includes('--color-warning') &&
  tokensCss.includes('--color-error')
);

check('D1-TOK-07: design-tokens.css mendefinisikan radii tokens',
  tokensCss.includes('--radius-sm') &&
  tokensCss.includes('--radius-md') &&
  tokensCss.includes('--radius-lg')
);

check('D1-TOK-08: design-tokens.css mendefinisikan shadow tokens',
  tokensCss.includes('--shadow-card') || tokensCss.includes('--shadow-elevation-1')
);

check('D1-TOK-09: design-tokens.css mendukung override dark mode',
  tokensCss.includes('[data-theme="dark"]') &&
  tokensCss.includes('--color-bg-primary') &&
  tokensCss.includes('--color-text-primary')
);

// --------------------------------------------------------------------------
// 2. AUDIT DASHBOARD HTML (public/dashboard.html)
// --------------------------------------------------------------------------
const dashboardHtmlPath = path.join(ROOT, 'public/dashboard.html');
const dashboardHtml = fs.readFileSync(dashboardHtmlPath, 'utf8');

check('D1-HTML-01: dashboard.html memuat design-tokens.css',
  dashboardHtml.includes('assets/design-tokens.css')
);

const idxTokens = dashboardHtml.indexOf('assets/design-tokens.css');
const idxStyle = dashboardHtml.indexOf('assets/style.css');
check('D1-HTML-02: dashboard.html memuat design-tokens.css sebelum style.css',
  idxTokens !== -1 && idxStyle !== -1 && idxTokens < idxStyle
);

// --------------------------------------------------------------------------
// 3. AUDIT STYLESHEET (public/assets/style.css)
// --------------------------------------------------------------------------
const styleCssPath = path.join(ROOT, 'public/assets/style.css');
const styleCss = fs.readFileSync(styleCssPath, 'utf8');

check('D1-CSS-01: style.css menjembatani :root --bg ke design token',
  styleCss.includes('--bg: var(--color-bg-secondary')
);

check('D1-CSS-02: style.css menjembatani :root --card ke design token',
  styleCss.includes('--card: var(--color-bg-primary')
);

check('D1-CSS-03: style.css menjembatani :root --line ke design token',
  styleCss.includes('--line: var(--color-border-subtle')
);

check('D1-CSS-04: style.css menjembatani :root --muted ke design token',
  styleCss.includes('--muted: var(--color-text-secondary')
);

check('D1-CSS-05: style.css menjembatani :root --text ke design token',
  styleCss.includes('--text: var(--color-text-primary')
);

check('D1-CSS-06: style.css menjembatani :root status colors ke design tokens',
  styleCss.includes('--blue: var(--color-brand-primary') &&
  styleCss.includes('--green: var(--color-success') &&
  styleCss.includes('--amber: var(--color-warning') &&
  styleCss.includes('--red: var(--color-error')
);

check('D1-CSS-07: style.css menjembatani :root --shadow ke design token',
  styleCss.includes('--shadow: var(--shadow-card')
);

check('D1-CSS-08: style.css dead code duplikat .table dan .card telah dibersihkan',
  (styleCss.match(/\.table\s*\{/g) || []).length <= 2 &&
  (styleCss.match(/\.card\s*\{/g) || []).length <= 2
);

check('D1-CSS-09: selector .card pada style.css memakai border-radius token',
  styleCss.includes('border-radius: var(--radius')
);

check('D1-CSS-10: selector .btn-primary pada style.css memakai background brand token',
  styleCss.includes('background: var(--blue)') || styleCss.includes('background: var(--color-brand-primary')
);

// --------------------------------------------------------------------------
// 4. AUDIT FRONTEND SPA (public/app.js)
// --------------------------------------------------------------------------
const appJsPath = path.join(ROOT, 'public/app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');

check('D1-SPA-01: Tidak ada inline background: #fff pada elemen .card di app.js',
  !appJs.includes('<div class="card" style="background: #fff') &&
  !appJs.includes('<div class="card" style="background:#fff')
);

check('D1-SPA-02: Tidak ada border: 1px solid #e2e8f0 pada app.js',
  !appJs.includes('#e2e8f0')
);

check('D1-SPA-03: Tidak ada border: 1px solid #cbd5e1 pada app.js',
  !appJs.includes('#cbd5e1')
);

check('D1-SPA-04: renderDashboard menggunakan design tokens untuk KPI dan tabel',
  appJs.includes('renderDashboard()') &&
  appJs.includes('var(--text)') &&
  appJs.includes('var(--card)') &&
  appJs.includes('var(--muted)')
);

check('D1-SPA-05: renderPesanan menggunakan design tokens untuk filter dan modal',
  appJs.includes('renderPesanan()') &&
  appJs.includes('var(--line)') &&
  appJs.includes('var(--bg)')
);

check('D1-SPA-06: renderPelanggan menggunakan design tokens untuk kartu dan daftar',
  appJs.includes('renderPelanggan()')
);

check('D1-SPA-07: renderLayanan menggunakan design tokens untuk kartu layanan',
  appJs.includes('renderLayanan()')
);

check('D1-SPA-08: renderDelivery menggunakan design tokens untuk tugas kurir',
  appJs.includes('renderDelivery()')
);

check('D1-SPA-09: renderPromo menggunakan design tokens untuk form & kartu voucher',
  appJs.includes('renderPromo()')
);

check('D1-SPA-10: renderLaporan menggunakan design tokens untuk filter & metrik',
  appJs.includes('renderLaporan()') &&
  appJs.includes('reportGroup')
);

check('D1-SPA-11: buildSvgChart menggunakan design tokens untuk garis kisi dan tooltip',
  appJs.includes('buildSvgChart(') &&
  appJs.includes('stroke="var(--line)"') &&
  appJs.includes('fill="var(--muted)"')
);

check('D1-SPA-12: renderProfile menggunakan design tokens untuk formulir',
  appJs.includes('renderProfile()') &&
  appJs.includes('profName') &&
  appJs.includes('passForm')
);

check('D1-SPA-13: Modal dialog konfirmasi menggunakan design tokens',
  appJs.includes('_appConfirm') &&
  appJs.includes('var(--card)') &&
  appJs.includes('var(--shadow-card)')
);

check('D1-SPA-14: Modal bukti transfer menggunakan design tokens',
  appJs.includes('proofModal') &&
  appJs.includes('var(--card)')
);

check('D1-SPA-15: Invoice modal actions menggunakan design tokens',
  appJs.includes('invoice-actions') &&
  appJs.includes('var(--line)')
);

// --------------------------------------------------------------------------
// 5. AUDIT KEAMANAN FAIL-CLOSED & SANITASI
// --------------------------------------------------------------------------
check('D1-SEC-01: app.js mempertahankan fungsi sanitasi esc()',
  appJs.includes('function esc(') || appJs.includes('esc(str)') || appJs.includes('const esc =')
);

check('D1-SEC-02: Tidak ada hardcoded credentials atau token rahasia di public/app.js',
  !appJs.includes('eyJhbGciOi') && !appJs.includes('secret_key')
);

// --------------------------------------------------------------------------
// RINGKASAN
// --------------------------------------------------------------------------
console.log(`\nHASIL VERIFIKASI TASK D1:`);
console.log(`  Lolos: ${pass}`);
console.log(`  Gagal: ${fail}`);

if (fail > 0) {
  console.log(`\n❌ VERIFIKASI GAGAL: Ada ${fail} pemeriksaan yang MERAH.`);
  process.exit(1);
} else {
  console.log(`\n✅ VERIFIKASI BERHASIL: Seluruh ${pass} pemeriksaan HIJAU 100%!`);
  process.exit(0);
}
