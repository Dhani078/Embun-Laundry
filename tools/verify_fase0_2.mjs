// Harness verifikasi Fase 0.2 — Kredensial default dibersihkan dari dokumentasi publik (README.md & TIDB_SETUP.md),
// dan skrip migrasi pembersihan baris debug (testhash) serta akun uji disediakan.
//
// Jalankan: node tools/verify_fase0_2_run.mjs

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

// ---------------------------------------------------------------------------
// Bagian 1 — Audit README.md
// ---------------------------------------------------------------------------
console.log('\n# Bagian 1 — Audit README.md');
const readmePath = path.join(ROOT, 'README.md');
const readmeContent = fs.readFileSync(readmePath, 'utf8');

check(
  'README.md TIDAK memuat sandi default admin123',
  !readmeContent.includes('admin123'),
  'admin123 ditemukan di README.md'
);

check(
  'README.md TIDAK memuat sandi default staff123',
  !readmeContent.includes('staff123'),
  'staff123 ditemukan di README.md'
);

check(
  'README.md TIDAK memuat sandi default user123',
  !readmeContent.includes('user123'),
  'user123 ditemukan di README.md'
);

check(
  'README.md TIDAK memuat tabel kredensial default',
  !/Akun Default untuk Login/i.test(readmeContent),
  'Bagian Akun Default masih ada di README.md'
);

// ---------------------------------------------------------------------------
// Bagian 2 — Audit TIDB_SETUP.md
// ---------------------------------------------------------------------------
console.log('\n# Bagian 2 — Audit TIDB_SETUP.md');
const tidbSetupPath = path.join(ROOT, 'TIDB_SETUP.md');
const tidbSetupContent = fs.readFileSync(tidbSetupPath, 'utf8');

check(
  'TIDB_SETUP.md TIDAK memuat sandi default admin123',
  !tidbSetupContent.includes('admin123'),
  'admin123 ditemukan di TIDB_SETUP.md'
);

check(
  'TIDB_SETUP.md TIDAK memuat sandi default staff123',
  !tidbSetupContent.includes('staff123'),
  'staff123 ditemukan di TIDB_SETUP.md'
);

check(
  'TIDB_SETUP.md TIDAK memuat sandi default user123',
  !tidbSetupContent.includes('user123'),
  'user123 ditemukan di TIDB_SETUP.md'
);

// ---------------------------------------------------------------------------
// Bagian 3 — Verifikasi Skrip Migrasi Pembersihan Debug (db/migrations)
// ---------------------------------------------------------------------------
console.log('\n# Bagian 3 — Verifikasi Skrip Migrasi 0001_cleanup_debug_accounts.sql');
const migrationPath = path.join(ROOT, 'db', 'migrations', '0001_cleanup_debug_accounts.sql');

check(
  'File migrasi 0001_cleanup_debug_accounts.sql ada di db/migrations',
  fs.existsSync(migrationPath),
  '0001_cleanup_debug_accounts.sql tidak ditemukan'
);

if (fs.existsSync(migrationPath)) {
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  check(
    'Migrasi memuat perintah pembersihan baris debug testhash',
    /DELETE\s+FROM\s+users\s+WHERE\s+password_hash\s*=\s*'testhash'/i.test(migrationSql),
    'Query pembersihan testhash tidak ditemukan'
  );
  check(
    'Migrasi memuat perintah pembersihan akun probe/test',
    /DELETE\s+FROM\s+users\s+WHERE\s+email\s+LIKE/i.test(migrationSql),
    'Query pembersihan akun probe tidak ditemukan'
  );
  check(
    'Migrasi memuat catatan rollback / panduan rotasi',
    /ROLLBACK/i.test(migrationSql) && /password_hash/i.test(migrationSql),
    'Catatan rollback atau panduan rotasi tidak lengkap'
  );
}

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log(`\nHASIL FASE 0.2: HIJAU ${pass}, MERAH ${fail} (${pass}/${pass + fail})`);
if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
