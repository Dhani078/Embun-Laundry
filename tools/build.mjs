// tools/build.mjs - Build & Minification Pipeline (Task E4)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Minifikasi CSS ringan: hapus komentar dan whitespace berlebih
 */
export function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // hapus komentar
    .replace(/\s+/g, ' ')             // kompres spasi
    .replace(/\s*([\{\}\:\;\,])\s*/g, '$1') // hapus spasi di sekitar delimiter
    .replace(/\;(?=\})/g, '')         // hapus semicolon sebelum }
    .trim();
}

/**
 * Minifikasi JS aman: bersihkan komentar blok, spasi & newline berlebih
 */
export function minifyJS(js) {
  return js
    .replace(/\/\*[\s\S]*?\*\//g, '') // hapus komentar blok
    .replace(/^\s*\/\/.*$/gm, '')      // hapus baris komentar tunggal
    .replace(/\n\s*\n/g, '\n')         // hapus baris kosong ganda
    .trim();
}

export function runBuild() {
  console.log('🚀 Memulai pipeline build & minifikasi aset (Task E4)...');
  const startTime = Date.now();

  const targets = [
    {
      src: 'public/assets/design-tokens.css',
      dest: 'public/assets/design-tokens.min.css',
      type: 'css'
    },
    {
      src: 'public/assets/style.css',
      dest: 'public/assets/style.min.css',
      type: 'css'
    },
    {
      src: 'public/assets/hero-canvas.js',
      dest: 'public/assets/hero-canvas.min.js',
      type: 'js'
    },
    {
      src: 'public/app.js',
      dest: 'public/app.min.js',
      type: 'js'
    }
  ];

  let totalOriginal = 0;
  let totalMinified = 0;

  for (const t of targets) {
    const srcPath = path.join(ROOT, t.src);
    const destPath = path.join(ROOT, t.dest);

    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠️ File tidak ditemukan: ${t.src}`);
      continue;
    }

    const content = fs.readFileSync(srcPath, 'utf8');
    const minified = t.type === 'css' ? minifyCSS(content) : minifyJS(content);

    fs.writeFileSync(destPath, minified, 'utf8');

    const origBytes = Buffer.byteLength(content, 'utf8');
    const minBytes = Buffer.byteLength(minified, 'utf8');
    const saving = ((origBytes - minBytes) / origBytes * 100).toFixed(1);

    totalOriginal += origBytes;
    totalMinified += minBytes;

    console.log(`📦 ${t.src.padEnd(34)} → ${t.dest.padEnd(36)} ${(origBytes / 1024).toFixed(1)} KB → ${(minBytes / 1024).toFixed(1)} KB (-${saving}%)`);
  }

  const totalSaved = ((totalOriginal - totalMinified) / totalOriginal * 100).toFixed(1);
  const duration = Date.now() - startTime;

  console.log(`\n✨ Build selesai dalam ${duration}ms! Total penghematan: -${totalSaved}% (${(totalOriginal / 1024).toFixed(1)} KB → ${(totalMinified / 1024).toFixed(1)} KB)`);
  return { totalOriginal, totalMinified, totalSaved, duration };
}

// Jalankan otomatis jika dipanggil langsung dari CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBuild();
}
