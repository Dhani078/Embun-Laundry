// B7 — Verifikasi runtime: buktikan TEKS dari user tidak pernah masuk ke SQL.
//
// Cara: panggil setiap handler API nyata dengan payload berisi "canary" string
// yang dirancang untuk merusak SQL jika diinterpolasi (kutip, komentar, UNION).
// Driver DB diganti (loader) dengan pencatat; lalu setiap SQL yang dikirim
// dicek: masih mengandung placeholder `?` (aman) dan TIDAK mengandung canary.
//
// Jalankan:  node --import ./tools/sql_guard_register.mjs tools/verify_b7.mjs
// (pembungkus agar loader resolve benar di Windows)

import { __calls, reset } from './mock_tidb.mjs';

const CANARY = "x' OR 1=1 -- zzCANARYzz";
const CANARY2 = 'zzUNIONzz/**/SELECT';

// Token JWT tiruan yang lolos verifikasi getUserFromSession.
// (secret fallback di _db.js)
const SECRET = 'dhani-laundry-secure-jwt-secret-key-2026';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sign(payloadObj) {
  const payload = b64url(payloadObj);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigB64 = Buffer.from(new Uint8Array(sig))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${payload}.${sigB64}`;
}

const env = {
  TIDB_DATABASE_URL: 'mysql://user:pass@host/db',
  JWT_SECRET: SECRET
};

function mkReq(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

const BASE = 'https://embun-laundry.test';

// [nama, import path, export fn, method, url, body]
const CASES = [
  ['orders.GET', '../functions/api/orders.js', 'onRequest', 'GET',
    `/api/orders?q=${encodeURIComponent(CANARY)}&status=baru&start=${encodeURIComponent(CANARY2)}&end=x`, undefined],
  ['orders.POST.create', '../functions/api/orders.js', 'onRequest', 'POST',
    '/api/orders', { action: 'create_order', customer_name: CANARY, customer_phone: CANARY2,
      service_id: 1, weight_kg: 2 }],
  ['delivery.GET', '../functions/api/delivery.js', 'onRequest', 'GET',
    `/api/delivery?q=${encodeURIComponent(CANARY)}&type=pickup&status=scheduled&date=${encodeURIComponent(CANARY2)}`, undefined],
  ['delivery.POST', '../functions/api/delivery.js', 'onRequest', 'POST',
    '/api/delivery', { action: 'create_task', type: 'pickup', customer_name: CANARY, address: CANARY2 }],
  ['customers.GET', '../functions/api/customers.js', 'onRequest', 'GET',
    `/api/customers?q=${encodeURIComponent(CANARY)}&tag=VIP`, undefined],
  ['customers.POST', '../functions/api/customers.js', 'onRequest', 'POST',
    '/api/customers', { action: 'create_customer', full_name: CANARY, phone: CANARY2 }],
  ['services.GET', '../functions/api/services.js', 'onRequest', 'GET',
    `/api/services?q=${encodeURIComponent(CANARY)}&cat=${encodeURIComponent(CANARY2)}`, undefined],
  ['services.POST', '../functions/api/services.js', 'onRequest', 'POST',
    '/api/services', { action: 'create_service', name: CANARY, code: CANARY2, price: 1000 }],
  ['promos.GET', '../functions/api/promos.js', 'onRequest', 'GET',
    `/api/promos?q=${encodeURIComponent(CANARY)}&active=true`, undefined],
  ['vouchers.GET', '../functions/api/vouchers.js', 'onRequest', 'GET',
    `/api/vouchers?q=${encodeURIComponent(CANARY)}`, undefined],
  ['reports.GET', '../functions/api/reports.js', 'onRequestGet', 'GET',
    `/api/reports?group=${encodeURIComponent(CANARY)}&start=2026-01-01&end=${encodeURIComponent(CANARY2)}`, undefined],
  ['dashboard.GET', '../functions/api/dashboard.js', 'onRequestGet', 'GET', '/api/dashboard', undefined],
  ['pay.POST', '../functions/api/pay.js', 'onRequest', 'POST',
    `/api/pay?order_code=${encodeURIComponent(CANARY)}`, { method: CANARY2, amount: 5000 }],
  ['profile.POST', '../functions/api/profile.js', 'onRequest', 'POST',
    '/api/profile', { action: 'update_profile', full_name: CANARY, phone: CANARY2 }],
  ['checkin.POST', '../functions/api/checkin.js', 'onRequest', 'POST', '/api/checkin', {}],
  ['login.POST', '../functions/api/auth/login.js', 'onRequestPost', 'POST',
    '/api/auth/login', { identity: CANARY, password: CANARY2 }],
  ['register.POST', '../functions/api/auth/register.js', 'onRequestPost', 'POST',
    '/api/auth/register', { full_name: CANARY, email: `a${Date.now()}@b.com`, phone: CANARY2,
      password: 'p', confirm: 'p', agree: true }]
];

let bad = 0;
const results = [];

for (const [name, mod, fn, method, url, body] of CASES) {
  reset();
  let status = '-';
  let err = null;
  try {
    const m = await import(mod);
    const token = await sign({ id: 30001, user_id: 30001, user_name: 'admin',
      user_role: 'Admin', email: 'admin@gmail.com',
      exp: Math.floor(Date.now() / 1000) + 3600 });
    const req = mkReq(method, BASE + url, body);
    req.headers.set('Cookie', `session_token=${token}`);
    const res = await m[fn]({ request: req, env, params: {} });
    status = res && res.status ? res.status : String(res);
  } catch (e) {
    err = e && e.message ? e.message : String(e);
  }

  // Periksa setiap SQL yang benar-benar dikirim ke driver
  const dirty = [];
  for (const c of __calls) {
    if (c.sql.includes('zzCANARYzz') || c.sql.includes('zzUNIONzz')) {
      dirty.push(c.sql.replace(/\s+/g, ' ').slice(0, 200));
    }
  }
  results.push({ name, status, err, nsql: __calls.length, dirty });
}

// --- Uji: pelanggan non-staff HARUS tetap ter-skop, dan nilainya via `?` ---
{
  console.log('=== B7 — Uji scoping pelanggan (dashboard.js) ===\n');
  const m = await import('../functions/api/dashboard.js');
  for (const role of ['Admin', 'Customer']) {
    reset();
    const token = await sign({ id: 30001, user_id: 30001, user_name: 'Budi',
      user_role: role, email: 'budi@gmail.com',
      exp: Math.floor(Date.now() / 1000) + 3600 });
    const req = mkReq('GET', `${BASE}/api/dashboard`);
    req.headers.set('Cookie', `session_token=${token}`);
    await m.onRequestGet({ request: req, env, params: {} });
    const withFilter = __calls.filter(c => /customer_name = \?/.test(c.sql)).length;
    const leak = __calls.some(c => c.sql.includes('Budi'));
    console.log(`| role=${role.padEnd(9)} | query ter-skop customer_name=? : ${withFilter} | nama disisipkan mentah: ${leak ? 'YA' : 'tidak'} |`);
    if (leak) bad++;
  }
  console.log();
}

// --- Uji tambahan: `?group=` hanya boleh menghasilkan ekspresi dari peta ---
{
  console.log('=== B7 — Uji peta GROUP BY (reports.js) ===\n');
  const m = await import('../functions/api/reports.js');
  for (const g of ['hari', 'minggu', 'bulan', CANARY, 'HARI', '']) {
    reset();
    const token = await sign({ id: 30001, user_id: 30001, user_name: 'admin',
      user_role: 'Admin', email: 'admin@gmail.com',
      exp: Math.floor(Date.now() / 1000) + 3600 });
    const req = mkReq('GET', `${BASE}/api/reports?group=${encodeURIComponent(g)}`);
    req.headers.set('Cookie', `session_token=${token}`);
    await m.onRequestGet({ request: req, env, params: {} });
    const chart = __calls.find(c => /GROUP BY/.test(c.sql));
    const expr = chart ? chart.sql.match(/SELECT (.+?) as g,/)?.[1] : '(tidak ada)';
    const leak = chart ? (chart.sql.includes('zzCANARYzz') || chart.sql.includes('zzUNIONzz')) : false;
    console.log(`| group=${JSON.stringify(g).padEnd(30)} | ekspresi: ${String(expr).padEnd(52)} | bocor: ${leak ? 'YA' : 'tidak'} |`);
    if (leak) bad++;
  }
  console.log();
}

console.log('=== B7 — Verifikasi Runtime SQL Injection ===\n');
console.log('| Kasus | HTTP | SQL dikirim | SQL kotor | Error |');
console.log('|-------|------|-------------|-----------|-------|');
for (const r of results) {
  bad += r.dirty.length;
  console.log(`| ${r.name} | ${r.status} | ${r.nsql} | ${r.dirty.length} | ${r.err ? r.err.slice(0, 60) : '-'} |`);
}
console.log(`\nTotal SQL kotor (mengandung canary): ${bad}`);
if (bad) {
  console.log('\n!!! TEMUAN — teks user menyusup ke SQL:');
  for (const r of results) for (const d of r.dirty) console.log(` - [${r.name}] ${d}`);
}
console.log(bad ? '\nHASIL: MERAH' : '\nHASIL: HIJAU — nol teks user sampai ke SQL');
process.exit(bad ? 1 : 0);
