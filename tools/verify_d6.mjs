// tools/verify_d6.mjs
// Harness verifikasi Task D6 — Micro-interaction konsisten (hover/focus/active) (P3)
//
// Menguji:
// 1. Audit Sistem Focus Aksesibel (public/assets/style.css):
//    - :focus-visible universal & pembersihan outline mouse click via :focus:not(:focus-visible).
//    - Focus-visible ring pada .btn, .btn-primary, .btn-icon, .tabbtn, .theme-toggle-btn.
//    - Focus-visible pada input, select, textarea, dan link navigasi sidebar.
// 2. Audit State Hover & Active (public/assets/style.css):
//    - .btn:active, .btn-primary:active, .btn-icon:active, .tabbtn:active dengan transform/scale mikro.
//    - .nav a:active / .nav-link:active feedback sentuhan.
//    - .input:hover, select:hover, textarea:hover transisi border halus.
//    - State :disabled pada tombol dan form input.
// 3. Audit Interaksi Baris Tabel (public/assets/style.css):
//    - .table tbody tr:hover highlight background (var(--blue-soft)) & border tint.
//    - Transisi halus (transition: transform, box-shadow, background).
// 4. Audit Efek Ripple & Feedback Sentuhan (public/assets/style.css & public/app.js):
//    - Definisi .ripple & keyframe rippleAnimation di style.css.
//    - Implementasi App.initRipple() di public/app.js dan pemanggilan di App.init().
// 5. Audit Aksesibilitas prefers-reduced-motion (public/assets/style.css):
//    - Penonaktifan transform, animasi, dan transisi pada prefers-reduced-motion: reduce.
//    - Penonaktifan ripple pada preferensi reduced-motion.
// 6. Audit Nol Overhead & Kerapian (package.json):
//    - Tanpa dependensi library animasi eksternal berat (0 dependency).
//
// Jalankan: node tools/verify_d6_run.mjs

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

console.log('=== VERIFIKASI TASK D6: MICRO-INTERACTION KONSISTEN (HOVER/FOCUS/ACTIVE) ===\n');

// --------------------------------------------------------------------------
// 1. AUDIT SISTEM FOCUS AKSESIBEL (public/assets/style.css)
// --------------------------------------------------------------------------
const styleCssPath = path.join(ROOT, 'public/assets/style.css');
check('D6-CSS-01: File public/assets/style.css tersedia', fs.existsSync(styleCssPath));

const styleCss = fs.readFileSync(styleCssPath, 'utf8');

check('D6-FOC-01: style.css mendefinisikan aturan universal :focus-visible',
  styleCss.includes(':focus-visible') &&
  styleCss.includes('outline:')
);

check('D6-FOC-02: style.css membersihkan outline klik mouse via :focus:not(:focus-visible)',
  styleCss.includes(':focus:not(:focus-visible)')
);

check('D6-FOC-03: style.css memiliki :focus-visible pada tombol (.btn / .btn-primary)',
  styleCss.includes('.btn:focus-visible') &&
  styleCss.includes('.btn-primary:focus-visible')
);

check('D6-FOC-04: style.css memiliki :focus-visible pada tombol ikon (.btn-icon)',
  styleCss.includes('.btn-icon:focus-visible')
);

check('D6-FOC-05: style.css memiliki :focus-visible pada tombol tab (.tabbtn)',
  styleCss.includes('.tabbtn:focus-visible')
);

check('D6-FOC-06: style.css memiliki :focus-visible pada tombol ganti tema (.theme-toggle-btn)',
  styleCss.includes('.theme-toggle-btn:focus-visible')
);

check('D6-FOC-07: style.css memiliki :focus-visible pada form inputs (.input / select / textarea)',
  styleCss.includes('.input:focus-visible') || styleCss.includes('input:focus-visible')
);

check('D6-FOC-08: style.css memiliki :focus-visible pada link navigasi (.nav a / .nav-link)',
  styleCss.includes('.nav a:focus-visible') || styleCss.includes('.nav-link:focus-visible')
);

// --------------------------------------------------------------------------
// 2. AUDIT STATE HOVER, ACTIVE, & DISABLED (public/assets/style.css)
// --------------------------------------------------------------------------
check('D6-ACT-01: style.css mendefinisikan state :active pada .btn (snappy micro-press)',
  /\.btn:active\s*\{[^}]*scale\(/.test(styleCss)
);

check('D6-ACT-02: style.css mendefinisikan state :active pada .btn-primary',
  styleCss.includes('.btn-primary:active')
);

check('D6-ACT-03: style.css mendefinisikan state :active pada .btn-icon',
  styleCss.includes('.btn-icon:active')
);

check('D6-ACT-04: style.css mendefinisikan state :active pada .tabbtn',
  styleCss.includes('.tabbtn:active')
);

check('D6-ACT-05: style.css mendefinisikan state :active pada .theme-toggle-btn',
  styleCss.includes('.theme-toggle-btn:active')
);

check('D6-ACT-06: style.css mendefinisikan state :active pada link navigasi',
  styleCss.includes('.nav a:active') || styleCss.includes('.nav-link:active')
);

check('D6-HOV-01: style.css mendefinisikan :hover pada form input (subtle border transition)',
  styleCss.includes('.input:hover') || styleCss.includes('input:hover')
);

check('D6-HOV-02: style.css mendefinisikan :hover pada .btn dengan elevasi visual',
  styleCss.includes('.btn:hover') && styleCss.includes('translateY(-2px)')
);

check('D6-DIS-01: style.css mendefinisikan aturan :disabled pada tombol dan form input',
  styleCss.includes('.btn:disabled') &&
  (styleCss.includes('.input:disabled') || styleCss.includes('input:disabled'))
);

// --------------------------------------------------------------------------
// 3. AUDIT INTERAKSI BARIS TABEL (public/assets/style.css)
// --------------------------------------------------------------------------
check('D6-TBL-01: style.css mendefinisikan efek hover pada baris tabel (.table tbody tr:hover)',
  styleCss.includes('.table tbody tr:hover') || styleCss.includes('.table tr:hover')
);

check('D6-TBL-02: Baris tabel hover menggunakan token warna brand (--blue-soft / --blue-border)',
  styleCss.includes('var(--blue-soft)')
);

// --------------------------------------------------------------------------
// 4. AUDIT EFEK RIPPLE & FEEDBACK SENTUHAN (public/assets/style.css & public/app.js)
// --------------------------------------------------------------------------
check('D6-RIP-01: style.css mendefinisikan kelas .ripple dan @keyframes rippleAnimation',
  styleCss.includes('.ripple') && styleCss.includes('@keyframes rippleAnimation')
);

const appJsPath = path.join(ROOT, 'public/app.js');
check('D6-APP-01: File public/app.js tersedia', fs.existsSync(appJsPath));

const appJs = fs.readFileSync(appJsPath, 'utf8');

check('D6-APP-02: App mendefinisikan method initRipple()',
  appJs.includes('initRipple()')
);

check('D6-APP-03: App.init() memanggil this.initRipple()',
  appJs.includes('this.initRipple()')
);

check('D6-APP-04: initRipple() menangani pointerdown dan membersihkan elemen ripple',
  appJs.includes('pointerdown') &&
  appJs.includes('ripple.className = \'ripple\'') &&
  appJs.includes('animationend')
);

// --------------------------------------------------------------------------
// 5. AUDIT AKSESIBILITAS prefers-reduced-motion (public/assets/style.css)
// --------------------------------------------------------------------------
check('D6-ACC-01: style.css memiliki blok @media (prefers-reduced-motion: reduce)',
  styleCss.includes('@media (prefers-reduced-motion: reduce)')
);

check('D6-ACC-02: prefers-reduced-motion menonaktifkan transform dan box-shadow interaksi tombol/kartu',
  styleCss.includes('transform: none !important') &&
  styleCss.includes('box-shadow: none !important')
);

check('D6-ACC-03: prefers-reduced-motion menonaktifkan ripple animation',
  styleCss.includes('.ripple') && styleCss.includes('display: none !important')
);

check('D6-ACC-04: prefers-reduced-motion mempertahankan skeletonPulse untuk indikator muat data',
  styleCss.includes('skeletonPulse')
);

// --------------------------------------------------------------------------
// 6. AUDIT ZERO OVERHEAD & KEBERSIHAN
// --------------------------------------------------------------------------
const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const allDeps = Object.keys(pkgJson.dependencies || {}).concat(Object.keys(pkgJson.devDependencies || {}));

check('D6-DEP-01: Tanpa library animasi eksternal berat (framer-motion, animejs, gsap, dll)',
  !allDeps.includes('framer-motion') &&
  !allDeps.includes('animejs') &&
  !allDeps.includes('gsap') &&
  !allDeps.includes('velocity-animate')
);

// --------------------------------------------------------------------------
// RINGKASAN
// --------------------------------------------------------------------------
console.log(`\nHASIL VERIFIKASI TASK D6:`);
console.log(`  Lolos: ${pass}`);
console.log(`  Gagal: ${fail}`);

if (fail > 0) {
  console.log(`\n❌ VERIFIKASI GAGAL: Ada ${fail} pemeriksaan yang MERAH.`);
  process.exit(1);
} else {
  console.log(`\n✅ VERIFIKASI BERHASIL: Seluruh ${pass} pemeriksaan HIJAU 100%!`);
  process.exit(0);
}
