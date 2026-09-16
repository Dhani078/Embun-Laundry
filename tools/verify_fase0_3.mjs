// Harness verifikasi Fase 0.3 — Dump database yang memuat data pribadi (PII) dikeluarkan dari pelacakan git,
// disaring oleh .gitignore, dan DDL template aman tetap dipertahankan.
//
// Jalankan: node tools/verify_fase0_3_run.mjs

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
// Bagian 1 — Audit File Terlacak Git (git ls-files)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit File Terlacak Git (git ls-files db/)');

let trackedFiles = '';
try {
  trackedFiles = execSync('git ls-files db/', { cwd: ROOT, encoding: 'utf8' });
} catch (e) {
  trackedFiles = '';
}

check(
  'db/embun_laundry.sql TIDAK terlacak di git (git ls-files)',
  !trackedFiles.includes('db/embun_laundry.sql'),
  'db/embun_laundry.sql masih terlacak di git index'
);

check(
  'db/dhani_laundry.sql TIDAK terlacak di git (git ls-files)',
  !trackedFiles.includes('db/dhani_laundry.sql'),
  'db/dhani_laundry.sql masih terlacak di git index'
);

check(
  'db/init.sql TETAP terlacak sebagai DDL aman (git ls-files)',
  trackedFiles.includes('db/init.sql'),
  'db/init.sql hilang dari git index'
);

check(
  'db/migrations/0001_cleanup_debug_accounts.sql TETAP terlacak (git ls-files)',
  trackedFiles.includes('0001_cleanup_debug_accounts.sql'),
  '0001_cleanup_debug_accounts.sql hilang dari git index'
);

// ---------------------------------------------------------------------------
// Bagian 2 — Audit Aturan .gitignore (git check-ignore)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Audit Aturan .gitignore');

function checkIgnore(filePath) {
  try {
    const out = execSync(`git check-ignore -v --no-index "${filePath}"`, { cwd: ROOT, encoding: 'utf8' });
    return out.trim();
  } catch (e) {
    return null;
  }
}

const ignoreEmbun = checkIgnore('db/embun_laundry.sql');
check(
  '.gitignore memfilter db/embun_laundry.sql',
  ignoreEmbun !== null && ignoreEmbun.length > 0,
  'db/embun_laundry.sql tidak cocok dengan aturan .gitignore'
);

const ignoreDhani = checkIgnore('db/dhani_laundry.sql');
check(
  '.gitignore memfilter db/dhani_laundry.sql',
  ignoreDhani !== null && ignoreDhani.length > 0,
  'db/dhani_laundry.sql tidak cocok dengan aturan .gitignore'
);

const ignoreRandomSql = checkIgnore('db/dump_rahasia.sql');
check(
  '.gitignore memfilter sembarang file *.sql baru di folder db/',
  ignoreRandomSql !== null && ignoreRandomSql.length > 0,
  'db/*.sql tidak aktif di .gitignore'
);

// init.sql harus diecualikan (tidak boleh di-ignore)
const ignoreInit = checkIgnore('db/init.sql');
check(
  '.gitignore TIDAK memfilter db/init.sql (whitelisted via !db/init.sql)',
  ignoreInit === null || ignoreInit.includes('!db/init.sql'),
  'db/init.sql terblokir oleh aturan .gitignore'
);

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL FASE 0.3: HIJAU ${pass}, MERAH ${fail} (${pass}/${pass + fail})`);
if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
