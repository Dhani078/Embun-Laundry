// Harness verifikasi Fase 0.4 — Audit penghapusan hardcoded sandi admin dari tools/probe_*
// dan verifikasi bahwa direktori .tmp/ bersih serta tidak pernah terlacak git.
//
// Jalankan: node tools/verify_fase0_4_run.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';
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

// ---------------------------------------------------------------------------
// Bagian 1 — Audit Skrip tools/probe_*
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit Skrip tools/probe_*');

const probeFiles = [
  'tools/probe_b13_live.sh',
  'tools/probe_b14_live.sh',
  'tools/probe_api.py',
  'tools/probe_b8_live.mjs',
  'tools/probe_hash.mjs',
  'tools/probe_schema.mjs'
];

for (const rel of probeFiles) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const content = fs.readFileSync(full, 'utf8');

  check(
    `${rel} TIDAK memuat sandi admin123 hardcoded`,
    !content.includes('admin123'),
    `admin123 masih ditemukan di ${rel}`
  );

  check(
    `${rel} menggunakan variabel lingkungan ADMIN_PASSWORD`,
    content.includes('ADMIN_PASSWORD'),
    `ADMIN_PASSWORD tidak ditemukan di ${rel}`
  );
}

// ---------------------------------------------------------------------------
// Bagian 2 — Audit Direktori .tmp/ dan .gitignore
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Audit Direktori .tmp/ dan .gitignore');

let trackedTmp = '';
try {
  trackedTmp = execSync('git ls-files .tmp/', { cwd: ROOT, encoding: 'utf8' }).trim();
} catch (e) {
  trackedTmp = '';
}

check(
  '.tmp/ TIDAK memuat file yang terlacak di git (git ls-files)',
  trackedTmp.length === 0,
  `File terlacak ditemukan di .tmp/: ${trackedTmp}`
);

let ignoreTmp = '';
try {
  ignoreTmp = execSync('git check-ignore -v --no-index .tmp/', { cwd: ROOT, encoding: 'utf8' }).trim();
} catch (e) {
  ignoreTmp = '';
}

check(
  '.tmp/ disaring oleh aturan .gitignore',
  ignoreTmp.includes('.tmp'),
  '.tmp/ tidak cocok dengan aturan .gitignore'
);

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL FASE 0.4: HIJAU ${pass}, MERAH ${fail} (${pass}/${pass + fail})`);
if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
