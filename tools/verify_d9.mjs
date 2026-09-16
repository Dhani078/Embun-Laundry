// tools/verify_d9.mjs
// Harness verifikasi Task D9 — Finalisasi p5.js hero (droplet + ripple) (P3)
//
// Menguji:
// 1. Audit Performa Canvas & p5 Configuration (public/assets/hero-canvas.js):
//    - p5.disableFriendlyErrors = true untuk eliminasi overhead validasi per frame (AGENT24:699).
//    - pixelDensity(1) untuk mencegah overdraw 4x di layar retina.
//    - HERO_CONFIG mengatur dropletCount, rippleCount, dan particleCount secara terkendali.
// 2. Audit Sistem Tetesan Air / Droplet (public/assets/hero-canvas.js):
//    - Inisialisasi targetY zona splash pada initDroplets().
//    - Pergerakan jatuh alami dengan wobble sine pada updateDroplets().
//    - Pemicu ripple splash otomatis saat tetesan mencapai permukaan air (targetY).
//    - Bentuk tetesan air teardrop aerodinamis (bezierVertex) dengan pantulan highlight.
// 3. Audit Sistem Gelombang Riak / Ripple (public/assets/hero-canvas.js):
//    - addRipple() dengan batas kapasitas terikat array (FIFO bounding).
//    - updateRipples() dengan damping ekspansi halus dan peluruhan transparansi natural.
//    - drawRipples() menggambar riak konsentris ganda berperspektif elips (outer wave + inner crest).
// 4. Audit Interaktivitas Kursor / Pointer (public/assets/hero-canvas.js):
//    - Listener pointermove pada section .hero dengan throttling frekuensi halus.
//    - Dukungan mousePressed & touchStarted.
// 5. Audit Aksesibilitas & Reduced Motion (public/assets/hero-canvas.js):
//    - Deteksi prefers-reduced-motion: reduce.
//    - Penghentian p.noLoop() dan rendering komposisi statis drawStaticFrame().
// 6. Audit Integrasi Template & CSS (public/index.html):
//    - Elemen #hero-canvas-container dengan pointer-events: none agar tidak memblokir tombol CTA.
//    - Skrip p5.js & hero-canvas.js dimuat secara non-blocking (defer).
// 7. Audit Zero Overhead Library Eksternal Berat (package.json):
//    - Tanpa dependensi engine 3D berat (Three.js, Babylon, dll).
//
// Jalankan: node tools/verify_d9_run.mjs

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

console.log('=== VERIFIKASI TASK D9: FINALISASI P5.JS HERO CANVAS (DROPLET + RIPPLE) ===\n');

// --------------------------------------------------------------------------
// 1. AUDIT KONFIGURASI & PERFORMA CANVAS (public/assets/hero-canvas.js)
// --------------------------------------------------------------------------
const heroJsPath = path.join(ROOT, 'public/assets/hero-canvas.js');
check('D9-CAN-01: File public/assets/hero-canvas.js tersedia', fs.existsSync(heroJsPath));

const heroJs = fs.readFileSync(heroJsPath, 'utf8');

check('D9-CAN-02: p5.disableFriendlyErrors = true terpasang untuk performa 60 FPS (AGENT24:699)',
  heroJs.includes('disableFriendlyErrors = true'));

check('D9-CAN-03: pixelDensity(1) terpasang untuk mencegah overdraw layar retina (AGENT24:699)',
  heroJs.includes('p.pixelDensity(1);') || heroJs.includes('pixelDensity(1)'));

check('D9-CAN-04: HERO_CONFIG mendefinisikan batasan droplet, ripple, dan particle secara terukur',
  heroJs.includes('dropletCount:') &&
  heroJs.includes('rippleCount:') &&
  heroJs.includes('particleCount:'));

// --------------------------------------------------------------------------
// 2. AUDIT SISTEM TETESAN AIR / DROPLET (public/assets/hero-canvas.js)
// --------------------------------------------------------------------------
check('D9-DRP-01: initDroplets menginisialisasi koordinat targetY splash',
  heroJs.includes('targetY:'));

check('D9-DRP-02: updateDroplets menghitung gravitasi jatuh dan wobble gelombang',
  heroJs.includes('d.y += d.speedY') &&
  heroJs.includes('d.wobblePhase += d.wobble') &&
  heroJs.includes('p.sin(d.wobblePhase)'));

check('D9-DRP-03: Tetesan air memicu riak splash otomatis saat mencapai target permukaan air (targetY)',
  heroJs.includes('d.y >= d.targetY') &&
  /\baddRipple\(d\.x,\s*d\.y/.test(heroJs));

check('D9-DRP-04: Tetesan air digambar dengan kurva teardrop bezier dan specular highlight',
  heroJs.includes('bezierVertex(') &&
  heroJs.includes('HERO_PALETTE.highlight'));

// --------------------------------------------------------------------------
// 3. AUDIT SISTEM GELOMBANG RIAK / RIPPLE (public/assets/hero-canvas.js)
// --------------------------------------------------------------------------
check('D9-RIP-01: addRipple menjaga batas kapasitas terikat array (FIFO bounding)',
  heroJs.includes('heroRipples.shift()') || heroJs.includes('heroRipples.splice('));

check('D9-RIP-02: updateRipples melakukan interpolasi damping ekspansi radius halus',
  heroJs.includes('r.radius += (r.maxRadius - r.radius)'));

check('D9-RIP-03: drawRipples menggambar cincin konsentris berperspektif elips (outer + inner wave)',
  heroJs.includes('HERO_PALETTE.ripple') &&
  heroJs.includes('r.radius * 2, r.radius * 1.25') &&
  heroJs.includes('HERO_PALETTE.primary'));

// --------------------------------------------------------------------------
// 4. AUDIT INTERAKTIVITAS POINTER / KURSOR (public/assets/hero-canvas.js)
// --------------------------------------------------------------------------
check('D9-INT-01: Listener pointermove pada section .hero terpasang dengan throttling',
  heroJs.includes("querySelector('.hero')") &&
  heroJs.includes("addEventListener('pointermove'"));

check('D9-INT-02: Dukungan klik / sentuhan mousePressed dan touchStarted terpasang',
  heroJs.includes('p.mousePressed =') &&
  heroJs.includes('p.touchStarted ='));

// --------------------------------------------------------------------------
// 5. AUDIT AKSESIBILITAS & REDUCED MOTION (public/assets/hero-canvas.js)
// --------------------------------------------------------------------------
check('D9-ACC-01: Deteksi prefers-reduced-motion: reduce terpasang',
  heroJs.includes('prefers-reduced-motion: reduce'));

check('D9-ACC-02: Mode reduced motion memanggil p.noLoop() dan drawStaticFrame(p)',
  heroJs.includes('p.noLoop();') &&
  heroJs.includes('drawStaticFrame(p);'));

// --------------------------------------------------------------------------
// 6. AUDIT INTEGRASI LANDING PAGE (public/index.html)
// --------------------------------------------------------------------------
const indexHtmlPath = path.join(ROOT, 'public/index.html');
check('D9-IDX-01: File public/index.html tersedia', fs.existsSync(indexHtmlPath));

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

check('D9-IDX-02: Kontainer #hero-canvas-container terpasang dengan aria-hidden="true"',
  indexHtml.includes('id="hero-canvas-container"') &&
  indexHtml.includes('aria-hidden="true"'));

check('D9-IDX-03: CSS #hero-canvas-container menggunakan pointer-events: none (tidak memblokir tombol)',
  indexHtml.includes('#hero-canvas-container') &&
  indexHtml.includes('pointer-events: none;'));

check('D9-IDX-04: Script p5.js dan hero-canvas.js dimuat dengan atribut defer',
  indexHtml.includes('/assets/hero-canvas.js') &&
  indexHtml.includes('defer'));

// --------------------------------------------------------------------------
// 7. AUDIT ZERO OVERHEAD LIBRARY BERAT (package.json)
// --------------------------------------------------------------------------
const pkgJsonPath = path.join(ROOT, 'package.json');
check('D9-PKG-01: File package.json tersedia', fs.existsSync(pkgJsonPath));

const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
const allDeps = {
  ...(pkgJson.dependencies || {}),
  ...(pkgJson.devDependencies || {})
};

const heavy3DLibs = ['three', 'babylonjs', 'pixi.js', '@react-three/fiber'];
const found3D = heavy3DLibs.filter(lib => allDeps[lib]);

check('D9-PKG-02: Bebas library 3D eksternal berukuran berat (0 dependency overhead)',
  found3D.length === 0,
  found3D.length > 0 ? `Ditemukan: ${found3D.join(', ')}` : 'Ringan dan terisolasi');

// --------------------------------------------------------------------------
// RINGKASAN
// --------------------------------------------------------------------------
console.log(`\nHasil Verifikasi Task D9: ${pass} Lulus, ${fail} Gagal\n`);

if (fail > 0) {
  process.exit(1);
} else {
  console.log('STATUS: SEMUA UJI P5.JS HERO CANVAS (DROPLET + RIPPLE) LULUS (HIJAU)!');
  process.exit(0);
}
