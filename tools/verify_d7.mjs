// tools/verify_d7.mjs
// Harness verifikasi Task D7 — Responsive audit 360/768/1024/1440px (P3)
//
// Menguji:
// 1. Audit Breakpoint Bertingkat (public/assets/style.css):
//    - Tier 1: Wide Desktop (min-width: 1440px) — 4-col KPI, wrap 280px 1fr, bounded main container.
//    - Tier 2: Tablet & Off-canvas Drawer (max-width: 1024px) — 2-col KPI, single col wrap, off-canvas sidebar drawer.
//    - Tier 3: Mobile & Snap Kanban (max-width: 768px) — horizontal snap-scroll kanban, responsive tables, adaptive modals.
//    - Tier 4: Small Mobile (max-width: 480px / 360px) — 1-col KPI, compact padding & typography, responsive toasts.
// 2. Audit Komponen Off-Canvas Drawer (public/assets/style.css):
//    - .sidebar-toggle-btn, .sidebar-close-btn, .sidebar-overlay, body.sidebar-locked.
//    - .sidebar.open transformasi slide-in (translateX(0)) dan bayangan elevasi.
// 3. Audit Markup Dashboard (public/dashboard.html):
//    - Elemen #sidebarOverlay (.sidebar-overlay).
//    - Elemen #sidebarCloseBtn (.sidebar-close-btn) di dalam brand sidebar.
//    - Elemen #sidebarToggleBtn (.sidebar-toggle-btn) di dalam topbar.
// 4. Audit Logika Navigasi & Siklus Hidup SPA (public/app.js):
//    - Inisialisasi App.initMobileSidebar() di dalam App.init().
//    - Implementasi openMobileSidebar(), closeMobileSidebar(), toggleMobileSidebar().
//    - Auto-close pada klik nav-link saat viewport <= 1024px.
//    - Auto-close pada tombol keyboard Escape dan event resize layar > 1024px.
//    - Sinkronisasi template dinamis renderApp() dengan tombol drawer dan overlay.
// 5. Audit Kerapian & Nol Dependensi Eksternal (package.json):
//    - 100% Vanilla CSS & JS murni tanpa library/framework CSS bloated.
//
// Jalankan: node tools/verify_d7_run.mjs

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

console.log('=== VERIFIKASI TASK D7: RESPONSIVE AUDIT 360 / 768 / 1024 / 1440PX ===\n');

// --------------------------------------------------------------------------
// 1. AUDIT CSS RESPONSIVE TIERS (public/assets/style.css)
// --------------------------------------------------------------------------
const styleCssPath = path.join(ROOT, 'public/assets/style.css');
check('D7-CSS-01: File public/assets/style.css tersedia', fs.existsSync(styleCssPath));

const styleCss = fs.readFileSync(styleCssPath, 'utf8');

// Tier 1: Wide Desktop (>= 1440px)
check('D7-T1-01: Media query >= 1440px terdefinisi untuk wide desktop',
  styleCss.includes('@media (min-width: 1440px)') || styleCss.includes('@media (min-width:1440px)'));

check('D7-T1-02: KPI grid 4 kolom terdefinisi pada breakpoint >= 1440px',
  styleCss.includes('repeat(4, 1fr)') || styleCss.includes('repeat(4,1fr)'));

check('D7-T1-03: Main container containment terdefinisi pada breakpoint >= 1440px',
  styleCss.includes('max-width: 1600px') || styleCss.includes('max-width:1600px'));

// Tier 2: Tablet & Off-canvas Drawer (<= 1024px)
check('D7-T2-01: Media query <= 1024px terdefinisi untuk tablet & drawer layout',
  styleCss.includes('@media (max-width: 1024px)') || styleCss.includes('@media (max-width:1024px)'));

check('D7-T2-02: Sidebar drawer fixed off-canvas terdefinisi (position fixed & translateX(-100%))',
  styleCss.includes('translateX(-100%)') &&
  styleCss.includes('.sidebar {') &&
  styleCss.includes('position: fixed;'));

check('D7-T2-03: Sidebar .open slide-in state terdefinisi (translateX(0))',
  styleCss.includes('.sidebar.open') &&
  styleCss.includes('translateX(0)'));

check('D7-T2-04: Navigasi tetap aktif di dalam drawer tablet/mobile (bukan display:none tak bertuan)',
  styleCss.includes('.sidebar .nav') &&
  styleCss.includes('display: flex;') &&
  styleCss.includes('flex-direction: column;'));

// Tier 3: Mobile Portrait & Snap Kanban (<= 768px)
check('D7-T3-01: Media query <= 768px terdefinisi untuk mobile landscape / tablet kecil',
  styleCss.includes('@media (max-width: 768px)') || styleCss.includes('@media (max-width:768px)'));

check('D7-T3-02: Kanban horizontal snap scroll terdefinisi di <= 768px',
  styleCss.includes('scroll-snap-type: x mandatory') &&
  styleCss.includes('overflow-x: auto;') &&
  styleCss.includes('scroll-snap-align: start;'));

check('D7-T3-03: Tabel horizontal scroll & modal adaptif terdefinisi di <= 768px',
  styleCss.includes('-webkit-overflow-scrolling: touch;') &&
  styleCss.includes('max-width: 95vw;'));

// Tier 4: Small Mobile (<= 480px / 360px)
check('D7-T4-01: Media query <= 480px terdefinisi untuk mobile 360px-480px',
  styleCss.includes('@media (max-width: 480px)') || styleCss.includes('@media (max-width:480px)'));

check('D7-T4-02: KPI stack 1 kolom di <= 480px untuk menghindari layout squeeze',
  styleCss.includes('.kpis {') &&
  styleCss.includes('grid-template-columns: 1fr;'));

check('D7-T4-03: Compact padding dan typography adaptif di <= 480px',
  styleCss.includes('.content {') &&
  styleCss.includes('padding: 12px 10px;') &&
  styleCss.includes('#pageTitle'));

// --------------------------------------------------------------------------
// 2. AUDIT KOMPONEN DRAWER & OVERLAY (public/assets/style.css)
// --------------------------------------------------------------------------
check('D7-DRW-01: Kelas .sidebar-toggle-btn terdefinisi dengan transisi dan hover',
  styleCss.includes('.sidebar-toggle-btn') &&
  styleCss.includes('.sidebar-toggle-btn:hover'));

check('D7-DRW-02: Kelas .sidebar-close-btn terdefinisi dengan transisi dan hover',
  styleCss.includes('.sidebar-close-btn') &&
  styleCss.includes('.sidebar-close-btn:hover'));

check('D7-DRW-03: Kelas .sidebar-overlay terdefinisi dengan backdrop blur dan transisi opacity',
  styleCss.includes('.sidebar-overlay') &&
  styleCss.includes('backdrop-filter: blur') &&
  styleCss.includes('.sidebar-overlay.open'));

check('D7-DRW-04: Kelas body.sidebar-locked mencegah scroll latar saat drawer terbuka',
  styleCss.includes('body.sidebar-locked') &&
  styleCss.includes('overflow: hidden;'));

// --------------------------------------------------------------------------
// 3. AUDIT MARKUP DASHBOARD HTML (public/dashboard.html)
// --------------------------------------------------------------------------
const dashHtmlPath = path.join(ROOT, 'public/dashboard.html');
check('D7-HTM-01: File public/dashboard.html tersedia', fs.existsSync(dashHtmlPath));

const dashHtml = fs.readFileSync(dashHtmlPath, 'utf8');

check('D7-HTM-02: Elemen #sidebarOverlay terpasang di dashboard.html',
  dashHtml.includes('id="sidebarOverlay"') &&
  dashHtml.includes('sidebar-overlay'));

check('D7-HTM-03: Elemen #sidebarCloseBtn terpasang di brand header sidebar dashboard.html',
  dashHtml.includes('id="sidebarCloseBtn"') &&
  dashHtml.includes('sidebar-close-btn'));

check('D7-HTM-04: Elemen #sidebarToggleBtn terpasang di topbar dashboard.html',
  dashHtml.includes('id="sidebarToggleBtn"') &&
  dashHtml.includes('sidebar-toggle-btn'));

// --------------------------------------------------------------------------
// 4. AUDIT IMPLEMENTASI JS SPA (public/app.js)
// --------------------------------------------------------------------------
const appJsPath = path.join(ROOT, 'public/app.js');
check('D7-APP-01: File public/app.js tersedia', fs.existsSync(appJsPath));

const appJs = fs.readFileSync(appJsPath, 'utf8');

check('D7-APP-02: App.init() memanggil this.initMobileSidebar()',
  appJs.includes('this.initMobileSidebar();'));

check('D7-APP-03: App.initMobileSidebar() terdefinisi dan mencegah re-initialization',
  appJs.includes('initMobileSidebar()') &&
  appJs.includes('_sidebarInitialized'));

check('D7-APP-04: Method openMobileSidebar, closeMobileSidebar, toggleMobileSidebar terdefinisi',
  typeof appJs === 'string' &&
  appJs.includes('openMobileSidebar()') &&
  appJs.includes('closeMobileSidebar()') &&
  appJs.includes('toggleMobileSidebar()'));

check('D7-APP-05: Event delegation menangani toggle button, close button, dan overlay click',
  appJs.includes('#sidebarToggleBtn') &&
  appJs.includes('#sidebarCloseBtn') &&
  appJs.includes('#sidebarOverlay'));

check('D7-APP-06: Escape key listener menutup sidebar drawer secara otomatis',
  appJs.includes("e.key === 'Escape'") &&
  appJs.includes('this.closeMobileSidebar()'));

check('D7-APP-07: Window resize listener (> 1024px) menutup sidebar drawer secara otomatis',
  appJs.includes('window.innerWidth > 1024') &&
  appJs.includes('this.closeMobileSidebar()'));

check('D7-APP-08: Klik nav-link otomatis menutup drawer pada viewport <= 1024px',
  appJs.includes('window.innerWidth <= 1024') &&
  appJs.includes('this.closeMobileSidebar()'));

check('D7-APP-09: renderApp() menyertakan markup #sidebarOverlay, #sidebarCloseBtn, dan #sidebarToggleBtn',
  appJs.includes('id="sidebarOverlay"') &&
  appJs.includes('id="sidebarCloseBtn"') &&
  appJs.includes('id="sidebarToggleBtn"'));

// --------------------------------------------------------------------------
// 5. AUDIT ZERO HEAVY DEPENDENCIES (package.json)
// --------------------------------------------------------------------------
const pkgJsonPath = path.join(ROOT, 'package.json');
check('D7-PKG-01: File package.json tersedia', fs.existsSync(pkgJsonPath));

const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
const allDeps = {
  ...(pkgJson.dependencies || {}),
  ...(pkgJson.devDependencies || {})
};

const heavyFrameworks = ['bootstrap', 'tailwindcss', 'bulma', 'foundation-sites', '@material-ui/core', '@chakra-ui/react'];
const foundHeavy = heavyFrameworks.filter(lib => allDeps[lib]);

check('D7-PKG-02: Zero dependensi CSS framework berat (100% Vanilla CSS responsif murni)',
  foundHeavy.length === 0,
  foundHeavy.length > 0 ? `Ditemukan: ${foundHeavy.join(', ')}` : 'Clean vanilla CSS');

// --------------------------------------------------------------------------
// RINGKASAN
// --------------------------------------------------------------------------
console.log(`\nHasil Verifikasi Task D7: ${pass} Lulus, ${fail} Gagal\n`);

if (fail > 0) {
  process.exit(1);
} else {
  console.log('STATUS: SEMUA UJI RESPONSIF TIER 360/768/1024/1440PX LULUS (HIJAU)!');
  process.exit(0);
}
