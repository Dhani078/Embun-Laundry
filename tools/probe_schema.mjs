// Uji cepat: (1) panjang kolom password_hash di produksi, (2) apakah
// hash lawas benar-benar sha256(password + 'dhani-salt').
// Dipakai untuk memastikan format baru PBKDF2 MUAT di kolom yang ada.
import { connect } from '@tidbcloud/serverless';
import { webcrypto } from 'node:crypto';

const url = process.env.TIDB_DATABASE_URL || process.env.DATABASE_URL;
if (!url) { console.error('TIDB_DATABASE_URL belum diset.'); process.exit(2); }
const conn = connect({ url });

const cols = await conn.execute(
  `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH
     FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'password_hash'`
);
console.log('kolom:', JSON.stringify(cols));

async function sha256hex(s) {
  const b = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

const admin = await conn.execute(
  `SELECT id, email, password_hash FROM users WHERE email = 'admin@gmail.com' LIMIT 1`
);
if (admin.length) {
  const stored = String(admin[0].password_hash);
  const guess = await sha256hex('admin123' + 'dhani-salt');
  console.log('stored :', stored);
  console.log('sha256(\'admin123dhani-salt\') :', guess);
  console.log('COCOK   :', stored === guess);
}
