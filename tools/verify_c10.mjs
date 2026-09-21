// tools/verify_c10.mjs — Verifikasi Task C10: Multi-bahasa (ID/EN) Sederhana
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;

function check(desc, condition) {
  if (condition) {
    console.log(`HIJAU  ${desc}`);
    pass++;
  } else {
    console.error(`MERAH  ${desc}`);
    fail++;
  }
}

console.log('# Bagian 1 — Audit Landing Page (public/index.html)');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

check('index.html memuat tombol langToggleBtn', indexHtml.includes('id="langToggleBtn"'));
check('index.html memuat elemen langLabel', indexHtml.includes('id="langLabel"'));
check('index.html memiliki atribut data-i18n pada navigasi', indexHtml.includes('data-i18n="nav_track"') && indexHtml.includes('data-i18n="nav_login"'));
check('index.html memiliki atribut data-i18n pada hero section', indexHtml.includes('data-i18n="hero_title"') && indexHtml.includes('data-i18n="hero_lead"'));
check('index.html memiliki kamus terjemahan I18N (id dan en)', indexHtml.includes('id: {') && indexHtml.includes('en: {'));
check('index.html menyimpan preferensi bahasa di localStorage', indexHtml.includes("localStorage.setItem('embun_lang'") || indexHtml.includes('localStorage.setItem("embun_lang"'));

console.log('\n# Bagian 2 — Audit Dashboard SPA (public/app.js & dashboard.html)');
const dashboardHtml = fs.readFileSync(path.join(ROOT, 'public', 'dashboard.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');

check('dashboard.html memuat tombol langToggleBtn di topbar', dashboardHtml.includes('id="langToggleBtn"'));
check('app.js memuat method initLang()', appJs.includes('initLang() {'));
check('app.js memuat method applyLang()', appJs.includes('applyLang(lang) {'));
check('app.js memuat method toggleLang()', appJs.includes('toggleLang() {'));
check('app.js memanggil initLang() saat startup App.init()', appJs.includes('this.initLang();'));
check('app.js menangani event klik langToggleBtn', appJs.includes('langToggleBtn') && appJs.includes('this.toggleLang()'));
check('app.js renderApp() merender tombol langToggleBtn', appJs.includes('id="langToggleBtn"') && appJs.includes('this.lang === \'en\' ? \'🌐 ID\' : \'🌐 EN\''));

console.log(`\nHASIL C10: HIJAU ${pass}, MERAH ${fail} (${pass}/${pass + fail})`);
if (fail > 0) process.exit(1);
