// Harness verifikasi B8 — migrasi hash sandi ke PBKDF2.
//
// Yang diukur di sini BUKAN "fungsinya dipanggil", melainkan hasil nyatanya:
//   • hash baru berformat `pbkdf2-sha256$<iter>$<salt>$<hash>` dan MUAT di
//     kolom VARCHAR(255) yang ada di produksi (dicek probe_schema.mjs);
//   • salt ACAK → dua hash untuk sandi yang sama TIDAK pernah sama
//     (inilah inti perbaikan: dulu salt-nya global, jadi hash identik);
//   • hash lawas SHA-256('admin123'+'dhani-salt') yang BETUL-BETUL ada di
//     produksi tetap bisa login (verified against the real value);
//   • login dengan hash lawas menulis ULANG hash ke PBKDF2 (lazy upgrade) —
//     dibuktikan dengan menangkap SQL UPDATE yang dikirim;
//   • sandi salah tetap ditolak; sandi baru panjangnya wajar;
//   • biaya CPU satu hash < batas aman 10 ms (diukur, bukan dikira).
//
// Jalan: node tools/verify_b8_run.mjs
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
register('./sql_guard_loader.mjs', pathToFileURL(here + path.sep));
await import('./verify_b8.mjs');
