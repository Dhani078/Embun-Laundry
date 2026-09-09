// Pembuktian PASCA-DEPLOY B8 — baca hash admin dari TiDB produksi dan
// laporkan formatnya. Dipakai untuk memastikan lazy upgrade benar-benar
// menulis PBKDF2 ke basis data, bukan cuma lolos uji lokal.
//
// Cara pakai:
//   TIDB_DATABASE_URL='mysql://...' node tools/probe_b8_live.mjs
import { connect } from '@tidbcloud/serverless';
import { verifyPassword, isPbkdf2Hash } from '../functions/_password.js';

const url = process.env.TIDB_DATABASE_URL || process.env.DATABASE_URL;
if (!url) { console.error('TIDB_DATABASE_URL belum diset.'); process.exit(2); }
const conn = connect({ url });

const rows = await conn.execute(
  `SELECT id, email, password_hash FROM users
    WHERE email IN ('admin@gmail.com','staff@gmail.com','user@gmail.com')
    ORDER BY id`
);

for (const r of rows) {
  const h = String(r.password_hash || '');
  const kind = isPbkdf2Hash(h) ? 'PBKDF2 (BARU)' : (h.startsWith('$2') ? 'bcrypt' : 'LAWAS');
  const ok = await verifyPassword('admin123', h);
  console.log(String(r.id).padStart(6), (r.email || '').padEnd(20), kind.padEnd(14), h.slice(0, 30) + '…');
  if (r.email === 'admin@gmail.com') {
    console.log(`        verifyPassword('admin123') -> ${ok}`);
  }
}

const pb = rows.filter(r => isPbkdf2Hash(String(r.password_hash))).length;
console.log(`\nPBKDF2: ${pb}/${rows.length} dari sampel`);
