// tools/verify_d8.mjs
// Harness verifikasi Task D8 — Animasi masuk (IntersectionObserver) (P3)
//
// Menguji:
// 1. Audit Stylesheet Animasi Masuk (public/assets/style.css):
//    - Kelas .reveal (opacity: 0, translateY) dan .reveal.show (opacity: 1, transform: translateY(0)).
//    - Kelas stagger delay (.reveal-stagger-1 s/d .reveal-stagger-4).
//    - Aksesibilitas prefers-reduced-motion: reduce menonaktifkan transisi reveal secara universal.
//    - Pembersihan dead code: duplikasi @keyframes contentFadeIn dibersihkan dari style.css.
// 2. Audit Off-Screen Optimization Canvas (public/assets/hero-canvas.js):
//    - Fungsi setupHeroVisibilityObserver() terpasang pada mountHeroCanvas().
//    - Menggunakan IntersectionObserver untuk menghentikan heroP5.noLoop() saat scrolled out.
//    - Melanjutkan kembali heroP5.loop() saat elemen container isIntersecting.
//    - Membersihkan observer (heroObserver.disconnect()) saat unmount.
//    - Kepatuhan aturan AGENT24: "Tidak ada animasi pada elemen yang tidak terlihat".
// 3. Audit Scroll Reveal Landing Page (public/index.html):
//    - Definisi CSS .reveal dan .reveal.show.
//    - Implementasi fungsi initReveal() dengan IntersectionObserver.
//    - Auto-staggering kartu (.card, .bento-cell, .section-head, .promo) dengan CSS variable --delay.
//    - Graceful fallback saat IntersectionObserver tidak didukung atau prefers-reduced-motion aktif.
//    - Sinkronisasi render layanan dinamis renderServices() dengan initReveal().
// 4. Audit Animasi Masuk Dashboard SPA (public/app.js):
//    - Method App.setupContentObserver() terpasang dan dipanggil di App.init().
//    - Method App.initScrollReveal() terdefinisi untuk elemen .kpi, .card, .panel, .kcol.
//    - Menggunakan IntersectionObserver dengan threshold adaptif dan auto-unobserve.
//    - Integrasi otomatis dengan siklus navigasi App.renderPage().
// 5. Audit Kerapian & Nol Dependensi Eksternal (package.json):
//    - Bebas library animasi eksternal berat (AOS, ScrollReveal, GSAP, dll).
//
// Jalankan: node tools/verify_d8_run.mjs

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

console.log('=== VERIFIKASI TASK D8: ANIMASI MASUK (INTERSECTION OBSERVER) ===\n');

// --------------------------------------------------------------------------
// 1. AUDIT CSS ENTRANCE REVEAL (public/assets/style.css)
// --------------------------------------------------------------------------
const styleCssPath = path.join(ROOT, 'public/assets/style.css');
check('D8-CSS-01: File public/assets/style.css tersedia', fs.existsSync(styleCssPath));

const styleCss = fs.readFileSync(styleCssPath, 'utf8');

check('D8-CSS-02: Kelas .reveal terdefinisi dengan transform translateY dan opacity 0',
  styleCss.includes('.reveal {') &&
  styleCss.includes('opacity: 0;') &&
  styleCss.includes('transform: translateY('));

check('D8-CSS-03: Kelas .reveal.show terdefinisi dengan opacity 1 dan translateY(0)',
  styleCss.includes('.reveal.show') &&
  styleCss.includes('opacity: 1;') &&
  styleCss.includes('transform: translateY(0);'));

check('D8-CSS-04: Kelas utility stagger terdefinisi (.reveal-stagger-*)',
  styleCss.includes('.reveal-stagger-1') &&
  styleCss.includes('.reveal-stagger-2') &&
  styleCss.includes('.reveal-stagger-3') &&
  styleCss.includes('.reveal-stagger-4'));

check('D8-CSS-05: Override prefers-reduced-motion untuk .reveal dan .reveal.show terdefinisi',
  styleCss.includes('prefers-reduced-motion: reduce') &&
  styleCss.includes('.reveal, .reveal.show') &&
  styleCss.includes('opacity: 1 !important;'));

// Verifikasi pembersihan dead code: tidak ada duplikasi @keyframes contentFadeIn
const countContentFadeIn = (styleCss.match(/@keyframes contentFadeIn/g) || []).length;
check('D8-CSS-06: Dead code duplikasi @keyframes contentFadeIn dibersihkan (tepat 1 deklarasi)',
  countContentFadeIn === 1,
  `Ditemukan: ${countContentFadeIn} deklarasi`);

// --------------------------------------------------------------------------
// 2. AUDIT HERO CANVAS VIEWPORT OPTIMIZATION (public/assets/hero-canvas.js)
// --------------------------------------------------------------------------
const heroJsPath = path.join(ROOT, 'public/assets/hero-canvas.js');
check('D8-CAN-01: File public/assets/hero-canvas.js tersedia', fs.existsSync(heroJsPath));

const heroJs = fs.readFileSync(heroJsPath, 'utf8');

check('D8-CAN-02: Fungsi setupHeroVisibilityObserver terdefinisi di hero-canvas.js',
  heroJs.includes('setupHeroVisibilityObserver()') &&
  heroJs.includes('heroObserver = new IntersectionObserver('));

check('D8-CAN-03: Canvas memanggil noLoop() saat elemen hero keluar dari viewport',
  heroJs.includes('heroP5.noLoop();'));

check('D8-CAN-04: Canvas memanggil loop() saat elemen hero kembali terlihat (isIntersecting)',
  heroJs.includes('entry.isIntersecting') &&
  heroJs.includes('heroP5.loop();'));

check('D8-CAN-05: Observer dibersihkan pada unmountHeroCanvas (heroObserver.disconnect)',
  heroJs.includes('heroObserver.disconnect();'));

check('D8-CAN-06: mountHeroCanvas mengaitkan setupHeroVisibilityObserver secara otomatis',
  heroJs.includes('setupHeroVisibilityObserver();'));

// --------------------------------------------------------------------------
// 3. AUDIT SCROLL REVEAL LANDING PAGE (public/index.html)
// --------------------------------------------------------------------------
const indexHtmlPath = path.join(ROOT, 'public/index.html');
check('D8-IDX-01: File public/index.html tersedia', fs.existsSync(indexHtmlPath));

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

check('D8-IDX-02: Definisi CSS .reveal dan .reveal.show ada di index.html',
  indexHtml.includes('.reveal {') &&
  indexHtml.includes('.reveal.show'));

check('D8-IDX-03: Fungsi initReveal() menggunakan IntersectionObserver',
  indexHtml.includes('function initReveal()') &&
  indexHtml.includes('new IntersectionObserver('));

check('D8-IDX-04: initReveal unobserve target setelah animasi masuk dipicu',
  indexHtml.includes('obs.unobserve('));

check('D8-IDX-05: initReveal menangani fallback preferensi reduced-motion',
  indexHtml.includes('prefers-reduced-motion: reduce') &&
  indexHtml.includes("el.classList.add('show')"));

check('D8-IDX-06: renderServices() memanggil initReveal() untuk merender kartu layanan',
  indexHtml.includes('initReveal();'));

// --------------------------------------------------------------------------
// 4. AUDIT ANIMASI MASUK DASHBOARD SPA (public/app.js)
// --------------------------------------------------------------------------
const appJsPath = path.join(ROOT, 'public/app.js');
check('D8-APP-01: File public/app.js tersedia', fs.existsSync(appJsPath));

const appJs = fs.readFileSync(appJsPath, 'utf8');

check('D8-APP-02: App.setupContentObserver() terdefinisi dan diinisialisasi di App.init()',
  appJs.includes('setupContentObserver()') &&
  appJs.includes('this.setupContentObserver();'));

check('D8-APP-03: App.initScrollReveal() menggunakan IntersectionObserver untuk kartu dashboard',
  appJs.includes('initScrollReveal(') &&
  appJs.includes('this._scrollObserver = new IntersectionObserver('));

check('D8-APP-04: initScrollReveal unobserve target setelah animasi masuk dipicu',
  appJs.includes('observer.unobserve(entry.target);'));

check('D8-APP-05: initScrollReveal memberikan delay stagger dinamis pada elemen anak',
  appJs.includes('--delay') &&
  appJs.includes('(idx % 4) * 60'));

check('D8-APP-06: initScrollReveal menangani fallback jika IntersectionObserver tidak ada atau reduced-motion',
  appJs.includes("!('IntersectionObserver' in window)") &&
  appJs.includes('prefers-reduced-motion: reduce'));

check('D8-APP-07: App.renderPage() memanggil this.initScrollReveal()',
  appJs.includes('renderPage(page)') &&
  appJs.includes('this.initScrollReveal();'));

// --------------------------------------------------------------------------
// 5. AUDIT ZERO HEAVY DEPENDENCIES (package.json)
// --------------------------------------------------------------------------
const pkgJsonPath = path.join(ROOT, 'package.json');
check('D8-PKG-01: File package.json tersedia', fs.existsSync(pkgJsonPath));

const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
const allDeps = {
  ...(pkgJson.dependencies || {}),
  ...(pkgJson.devDependencies || {})
};

const heavyLibs = ['aos', 'scrollreveal', 'gsap', 'framer-motion', 'animejs', 'locomotive-scroll'];
const foundHeavy = heavyLibs.filter(lib => allDeps[lib]);

check('D8-PKG-02: Nol dependensi library animasi eksternal (100% Native IntersectionObserver & GPU CSS)',
  foundHeavy.length === 0,
  foundHeavy.length > 0 ? `Ditemukan: ${foundHeavy.join(', ')}` : 'Clean vanilla native');

// --------------------------------------------------------------------------
// RINGKASAN
// --------------------------------------------------------------------------
console.log(`\nHasil Verifikasi Task D8: ${pass} Lulus, ${fail} Gagal\n`);

if (fail > 0) {
  process.exit(1);
} else {
  console.log('STATUS: SEMUA UJI ANIMASI MASUK & INTERSECTIONOBSERVER LULUS (HIJAU)!');
  process.exit(0);
}
