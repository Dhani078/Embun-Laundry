// tools/verify_e4.mjs — Verifikasi Task E4: Minifikasi CSS/JS & Build Pipeline
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { minifyCSS, minifyJS, runBuild } from './build.mjs';

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

console.log('# Bagian 1 — Audit Modul Minifikasi & Helper');
check('tools/build.mjs ada di direktori tools/', fs.existsSync(path.join(ROOT, 'tools', 'build.mjs')));
check('minifyCSS menghapus komentar CSS', !minifyCSS('/* comment */ body { color: red; }').includes('comment'));
check('minifyCSS memadatkan spasi berlebih', minifyCSS('body {\n  margin: 0;\n  padding: 0;\n}').includes('body{margin:0;padding:0}'));
check('minifyJS menghapus komentar satu baris', !minifyJS('// line comment\nconst x = 1;').includes('// line comment'));
check('minifyJS menghapus komentar blok', !minifyJS('/* block */ const y = 2;').includes('block'));

console.log('\n# Bagian 2 — Eksekusi Pipeline Build (Runtime)');
const result = runBuild();
check('runBuild mengembalikan durasi dan total penghematan', typeof result.duration === 'number' && typeof result.totalSaved === 'string');
check('Aset design-tokens.min.css dihasilkan', fs.existsSync(path.join(ROOT, 'public', 'assets', 'design-tokens.min.css')));
check('Aset style.min.css dihasilkan', fs.existsSync(path.join(ROOT, 'public', 'assets', 'style.min.css')));
check('Aset hero-canvas.min.js dihasilkan', fs.existsSync(path.join(ROOT, 'public', 'assets', 'hero-canvas.min.js')));
check('Aset app.min.js dihasilkan', fs.existsSync(path.join(ROOT, 'public', 'app.min.js')));

const dtOrig = fs.statSync(path.join(ROOT, 'public', 'assets', 'design-tokens.css')).size;
const dtMin = fs.statSync(path.join(ROOT, 'public', 'assets', 'design-tokens.min.css')).size;
check('Ukuran design-tokens.min.css lebih kecil dari aslinya', dtMin < dtOrig);

const styleOrig = fs.statSync(path.join(ROOT, 'public', 'assets', 'style.css')).size;
const styleMin = fs.statSync(path.join(ROOT, 'public', 'assets', 'style.min.css')).size;
check('Ukuran style.min.css lebih kecil dari aslinya', styleMin < styleOrig);

console.log('\n# Bagian 3 — Verifikasi Konfigurasi package.json');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
check('package.json memiliki script build', pkg.scripts && pkg.scripts.build && pkg.scripts.build.includes('tools/build.mjs'));
check('package.json memiliki script test', pkg.scripts && pkg.scripts.test && pkg.scripts.test.includes('run_all_verifiers'));

console.log(`\nHASIL E4: HIJAU ${pass}, MERAH ${fail} (${pass}/${pass + fail})`);
if (fail > 0) process.exit(1);
