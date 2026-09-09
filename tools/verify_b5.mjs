// Verifikasi B5 — CORS ketat.
//
// TIDAK menguji `functions/_cors.js` secara terisolasi (itu cuma membuktikan
// fungsi mengembalikan apa yang tertulis di sumber). Yang diuji di sini
// adalah `src/index.js` — entry point sungguhan — dengan `env.ASSETS`
// tiruan, lalu diukur header yang BENAR-BENAR keluar dari worker.
//
// Ini mengikuti pelajaran B1: uji lokal hijau tidak berarti produksi hijau.
// Jadi selain uji lokal, produksi tetap harus di-preflight dengan curl.
//
// Jalankan:  node tools/verify_b5_run.mjs

import worker from '../src/index.js';

const BASE = 'https://embun-laundry.dhanisepeda.workers.dev';
const PROD = 'https://embun-laundry.dhanisepeda.workers.dev';
const EVIL = 'https://evil.example.com';
const LOCAL = 'http://localhost:8787';

let pass = 0;
let fail = 0;

function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  [HIJAU] ${name}`);
  } else {
    fail++;
    console.log(`  [MERAH] ${name}${detail ? ' — ' + detail : ''}`);
  }
}

// --- env tiruan -----------------------------------------------------------
const env = {
  ASSETS: {
    async fetch(req) {
      return new Response('<html></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
};

function req(path, { origin = null, method = 'GET', headers = {} } = {}) {
  const h = { ...headers };
  if (origin) h.Origin = origin;
  return new Request(BASE + path, { method, headers: h });
}

async function call(path, opts) {
  return worker.fetch(req(path, opts), env, {});
}

// ==========================================================================
// 1. Origin jahat TIDAK boleh mendapat Access-Control-Allow-Origin
// ==========================================================================
console.log('\n[1] Origin tidak dikenal — tidak boleh ada ACAO');

for (const p of ['/api/health', '/api/services', '/api/orders', '/api/profile']) {
  const res = await call(p, { origin: EVIL });
  const acao = res.headers.get('Access-Control-Allow-Origin');
  check(
    `GET ${p} dari ${EVIL} tanpa ACAO`,
    acao === null,
    `dapat ACAO=${acao}`
  );
}

// Preflight dari origin jahat juga tidak boleh dapat ACAO.
{
  const res = await call('/api/health', {
    origin: EVIL,
    method: 'OPTIONS',
    headers: { 'Access-Control-Request-Method': 'GET' }
  });
  const acao = res.headers.get('Access-Control-Allow-Origin');
  check('OPTIONS /api/health dari origin jahat tanpa ACAO', acao === null, `ACAO=${acao}`);
  check(
    'OPTIONS /api/health tetap 204 (tidak 405)',
    res.status === 204 || res.status === 200,
    `status=${res.status}`
  );
}

// ==========================================================================
// 2. Origin sendiri HARUS mendapat ACAO yang persis (bukan `*`)
// ==========================================================================
console.log('\n[2] Origin produksi — ACAO harus persis, bukan wildcard');

for (const p of ['/api/health', '/api/services', '/api/orders']) {
  const res = await call(p, { origin: PROD });
  const acao = res.headers.get('Access-Control-Allow-Origin');
  check(`GET ${p} dari produksi → ACAO=${PROD}`, acao === PROD, `ACAO=${acao}`);
}

{
  const res = await call('/api/health', {
    origin: PROD,
    method: 'OPTIONS',
    headers: { 'Access-Control-Request-Method': 'GET' }
  });
  check(
    'OPTIONS preflight produksi → ACAO ada',
    res.headers.get('Access-Control-Allow-Origin') === PROD
  );
  check(
    'OPTIONS preflight produksi → Allow-Methods ada',
    !!res.headers.get('Access-Control-Allow-Methods')
  );
  check(
    'OPTIONS preflight produksi → Max-Age ada',
    res.headers.get('Access-Control-Max-Age') === '86400'
  );
}

// ==========================================================================
// 3. Origin dev lokal diizinkan
// ==========================================================================
console.log('\n[3] Origin dev lokal diizinkan');

{
  const res = await call('/api/health', { origin: LOCAL });
  check(`GET /api/health dari ${LOCAL} → ACAO ada`, res.headers.get('Access-Control-Allow-Origin') === LOCAL);
}

// ==========================================================================
// 4. Vary: Origin wajib ada jika ada header Origin (cegah cache campur)
// ==========================================================================
console.log('\n[4] Vary: Origin');

{
  const res = await call('/api/health', { origin: PROD });
  const vary = res.headers.get('Vary') || '';
  check('Vary memuat Origin (produksi)', vary.includes('Origin'), `Vary=${vary}`);
}
{
  const res = await call('/api/health', { origin: EVIL });
  const vary = res.headers.get('Vary') || '';
  check('Vary memuat Origin (origin jahat)', vary.includes('Origin'), `Vary=${vary}`);
}

// ==========================================================================
// 5. Tanpa header Origin (same-origin / curl) — tidak ada header CORS,
//    tetapi endpoint TETEP berfungsi. Ini mencegah regresi: jangan sampai
//    "CORS ketat" malah mematikan request biasa.
// ==========================================================================
console.log('\n[5] Tanpa Origin — endpoint tetap jalan, tanpa header CORS');

{
  const res = await call('/api/health');
  check('GET /api/health tanpa Origin → 200', res.status === 200, `status=${res.status}`);
  check(
    'GET /api/health tanpa Origin → tanpa ACAO (tidak perlu)',
    res.headers.get('Access-Control-Allow-Origin') === null
  );
  const body = await res.json();
  check('GET /api/health tanpa Origin → body ok:true', body.ok === true);
}

// ==========================================================================
// 6. Tidak ada lagi `*` di mana pun pada seluruh endpoint
// ==========================================================================
console.log('\n[6] Sapu semua endpoint — tidak boleh ada ACAO=*');

const ENDPOINTS = [
  '/api/health', '/api/services', '/api/orders', '/api/customers',
  '/api/dashboard', '/api/delivery', '/api/promos', '/api/vouchers',
  '/api/reports', '/api/profile', '/api/checkin', '/api/pay', '/api/me'
];

for (const p of ENDPOINTS) {
  for (const origin of [PROD, EVIL]) {
    const res = await call(p, { origin });
    const acao = res.headers.get('Access-Control-Allow-Origin');
    check(
      `${p} (Origin=${origin === PROD ? 'produksi' : 'jahat'}) ACAO != *`,
      acao !== '*',
      `ACAO=${acao}`
    );
  }
}

// ==========================================================================
// 7. Regresi: security headers (B4) masih terpasang setelah applyCors
// ==========================================================================
console.log('\n[7] Regresi B4 — security headers masih ada');

{
  const res = await call('/api/health', { origin: PROD });
  check('X-Content-Type-Options masih ada', res.headers.get('X-Content-Type-Options') === 'nosniff');
  check('X-Frame-Options masih ada', res.headers.get('X-Frame-Options') === 'DENY');
  check('Referrer-Policy masih ada', !!res.headers.get('Referrer-Policy'));
}

// ==========================================================================
// 8. Regresi: status tidak berubah (CORS tidak boleh mengubah kontrak)
// ==========================================================================
console.log('\n[8] Regresi kontrak — status respons tidak berubah');

{
  const a = await call('/api/health');
  const b = await call('/api/health', { origin: PROD });
  const c = await call('/api/health', { origin: EVIL });
  check(
    'status /api/health identik untuk semua Origin',
    a.status === b.status && b.status === c.status,
    `${a.status}/${b.status}/${c.status}`
  );

  const d = await call('/api/tidak-ada');
  const e = await call('/api/tidak-ada', { origin: EVIL });
  check('404 endpoint tetap 404', d.status === 404 && e.status === 404);
  check('404 dari origin jahat tanpa ACAO', e.headers.get('Access-Control-Allow-Origin') === null);
}

// ==========================================================================
console.log(`\nHASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} — ${pass} lulus, ${fail} gagal`);
process.exit(fail === 0 ? 0 : 1);
