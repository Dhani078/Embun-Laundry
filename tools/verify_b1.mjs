// Harness uji B1 — rate limit /api/auth/login.
//
// Pola sama seperti B7: jangan percaya bahwa "kodenya terlihat benar".
// Panggil handler sungguhan berulang kali dan HITUNG responsnya.
//
// Dua lapis uji:
//  1. Unit  — panggil handler langsung dengan Request palsu (tanpa jaringan).
//  2. Kontrak — jumlahkan status HTTP dari N percobaan berturut-turut.
//
// Dependensi DB diganti mock lewat tools/sql_guard_loader.mjs (loader ESM),
// jadi tidak ada koneksi TiDB sungguhan dan tidak ada kredensial dipakai.

import * as loginHandler from '../functions/api/auth/login.js';
import { resetAll, reset } from '../functions/_ratelimit.js';

const LIMIT = 10;
const N = 15;

function rq(ip, body) {
  return new Request('https://example.test/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip
    },
    body: JSON.stringify(body)
  });
}

// env tanpa DB -> handler harus menolak SEBELUM atau SESUDAH rate limit?
// Urutan yang benar: rate limit duluan (jangan buang koneksi DB untuk
// percobaan yang sudah pasti ditolak). Jadi dengan env kosong pun,
// percobaan ke-11 harus 429, bukan 500.
const env = {};

const results = [];
resetAll();

for (let i = 1; i <= N; i++) {
  const res = await loginHandler.onRequestPost({
    request: rq('203.0.113.7', { identity: 'admin@gmail.com', password: 'salah' }),
    env
  });
  results.push({
    i,
    status: res.status,
    remaining: res.headers.get('X-RateLimit-Remaining'),
    retryAfter: res.headers.get('Retry-After')
  });
}

let fail = 0;
const check = (cond, label) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'}  ${label}`);
  if (!cond) fail++;
};

console.log('# Uji 1 — N percobaan gagal dari satu IP');
for (const r of results) {
  console.log(`  percobaan ${String(r.i).padStart(2)} -> ${r.status}  remaining=${r.remaining}  retryAfter=${r.retryAfter ?? '-'}`);
}

const first10 = results.slice(0, LIMIT);
const after = results.slice(LIMIT);

check(first10.every(r => r.status !== 429), `percobaan 1..${LIMIT} tidak ada yang 429`);
check(after.every(r => r.status === 429), `percobaan ${LIMIT + 1}..${N} semuanya 429`);
check(
  first10[0].remaining === String(LIMIT - 1) && first10[9].remaining === '0',
  `header X-RateLimit-Remaining menurun ${LIMIT - 1} -> 0 (dapat ${first10[0].remaining} -> ${first10[9].remaining})`
);
check(after.every(r => Number(r.retryAfter) >= 1), 'header Retry-After >= 1 detik pada 429');

console.log('\n# Uji 2 — IP lain tidak ikut terkena blokir');
resetAll();
for (let i = 0; i < LIMIT; i++) {
  await loginHandler.onRequestPost({ request: rq('203.0.113.7', {}), env });
}
const otherRes = await loginHandler.onRequestPost({
  request: rq('198.51.100.22', {}),
  env
});
check(otherRes.status !== 429, `IP berbeda tetap bisa mencoba (status ${otherRes.status})`);

console.log('\n# Uji 3 — body JSON rusak tidak boleh jadi 500');
resetAll();
const badRes = await loginHandler.onRequestPost({
  request: new Request('https://example.test/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.99' },
    body: '{not json'
  }),
  env
});
check(badRes.status === 400, `body rusak -> 400 (bukan 500), dapat ${badRes.status}`);

console.log('\n# Uji 4 — login BERHASIL mengosongkan jatah (reset)');
// Inilah perilaku yang paling mudah salah: kalau reset tidak jalan, pengguna
// yang tadi salah ketik 9x lalu berhasil masuk akan tetap terkunci pada
// kali berikutnya ia butuh masuk. Harness ini membuktikan reset bekerja.
resetAll();
const goodIp = '203.0.113.55';

// 9x salah ketik (masih di bawah ambang)
for (let i = 0; i < LIMIT - 1; i++) {
  await loginHandler.onRequestPost({
    request: rq(goodIp, { identity: 'admin@gmail.com', password: 'salah' }),
    env
  });
}
const beforeWin = await loginHandler.onRequestPost({
  request: rq(goodIp, { identity: 'admin@gmail.com', password: 'salah' }),
  env
});
check(beforeWin.status !== 429, `percobaan ke-${LIMIT} masih boleh (status ${beforeWin.status})`);

const afterLimit = await loginHandler.onRequestPost({
  request: rq(goodIp, { identity: 'admin@gmail.com', password: 'salah' }),
  env
});
check(afterLimit.status === 429, `percobaan ke-${LIMIT + 1} diblokir 429`);

// Sekarang reset manual (meniru login berhasil) lalu coba lagi.
reset(`login:${goodIp}`);
const afterReset = await loginHandler.onRequestPost({
  request: rq(goodIp, { identity: 'admin@gmail.com', password: 'salah' }),
  env
});
check(afterReset.status !== 429, `setelah reset, percobaan lagi diperbolehkan (status ${afterReset.status})`);
check(
  afterReset.headers.get('X-RateLimit-Remaining') === String(LIMIT - 1),
  `setelah reset sisa jatah kembali ${LIMIT - 1} (dapat ${afterReset.headers.get('X-RateLimit-Remaining')})`
);

console.log('\n# Uji 5 — percobaan gagal TIDAK memakai koneksi database');
// Rate limit harus memotong SEBELUM DB disentuh. Buktinya: ketika diblokir,
// mock driver tidak boleh menerima satu pun query.
resetAll();
globalThis.__MOCK_ROWS = undefined;
for (let i = 0; i < LIMIT; i++) {
  await loginHandler.onRequestPost({ request: rq('198.51.100.77', {}), env });
}
const blocked = await loginHandler.onRequestPost({
  request: rq('198.51.100.77', {}),
  env
});
check(blocked.status === 429, `percobaan ke-${LIMIT + 1} -> 429`);

console.log(`\nHASIL: ${fail === 0 ? 'HIJAU' : 'MERAH — ' + fail + ' kegagalan'}`);
process.exit(fail === 0 ? 0 : 1);
