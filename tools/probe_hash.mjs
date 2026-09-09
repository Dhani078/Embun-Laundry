// Pemeriksaan format hash sandi yang BENAR-BENAR tersimpan di basis data
// produksi (bukan asumsi). Dipakai untuk merancang B8 dengan aman:
// kalau formatnya bcrypt, migrasi harus tetap menerima bcrypt, bukan
// menimpa kolom.
//
// Cara pakai:
//   TIDB_DATABASE_URL='mysql://...' node tools/probe_hash.mjs
import { connect } from '@tidbcloud/serverless';
import bcrypt from 'bcryptjs';

const url = process.env.TIDB_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('TIDB_DATABASE_URL belum diset.');
  process.exit(2);
}

const conn = connect({ url });

const rows = await conn.execute(
  `SELECT id, full_name, email, role, password_hash
     FROM users
    ORDER BY id
    LIMIT 20`
);

console.log('baris:', rows.length);
for (const r of rows) {
  const h = String(r.password_hash || '');
  let kind = 'unknown';
  if (h.startsWith('$2y$') || h.startsWith('$2a$') || h.startsWith('$2b$')) kind = 'bcrypt';
  else if (/^[0-9a-f]{64}$/i.test(h)) kind = 'sha256-hex64';
  else if (h.length === 0) kind = 'EMPTY';
  else kind = `plain?(${h.length})`;
  console.log(
    String(r.id).padStart(3),
    (r.email || '').padEnd(28),
    (r.role || '').padEnd(9),
    kind.padEnd(14),
    h.slice(0, 22)
  );
}

// Uji silang: apakah bcryptjs (murni JS) bisa memverifikasi hash bcrypt di DB?
// Ini penting karena Workers hanya bisa menjalankan implementasi JS/WASM.
const sample = rows.find(r => String(r.password_hash || '').startsWith('$2'));
if (sample) {
  const t0 = Date.now();
  const ok123 = await bcrypt.compare('admin123', sample.password_hash);
  console.log(
    `bcryptjs.compare('admin123', hash id=${sample.id}) -> ${ok123}  (${Date.now() - t0} ms)`
  );
} else {
  console.log('Tidak ada hash bcrypt di 20 baris pertama.');
}
