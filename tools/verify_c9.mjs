// tools/verify_c9.mjs — Task C9: Service worker offline dasar
//
// Menguji:
//  1. public/sw.js ada, sintaks valid (node --check)
//  2. Strategi caching benar: app-shell precache + SWR aset + network-first API
//  3. KESELAMATAN: tulisan (POST/PUT/DELETE) TIDAK pernah di-cache
//  4. Semua halaman publik mendaftarkan SW
//  5. Cross-origin (CDN p5.js) dilewati, tidak ikut di-cache
//  6. Cache versi lama dibersihkan pada activate
//  7. Navigasi offline jatuh ke app shell, bukan ke error mentah
//
// Catatan teknis harness: `new Function()` mengompilasi body pada scope
// GLOBAL, jadi closure luar (mis. `events`, `fetchLog`) TIDAK terlihat di
// dalam body. Karena itu listener disimpan pada objek `self` yang dilewatkan
// sebagai parameter (terlihat), dan log fetch ditempel pada fungsi fetch
// itu sendiri. Jangan "memperbaiki" ini dengan mengembalikan closure dari
// body — itu akan selalu gagal.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(new URL('../', import.meta.url).pathname.replace(/^\//, ''));
const SW_PATH = path.join(ROOT, 'public', 'sw.js');

let pass = 0;
const fails = [];

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`OK    ${name}${detail ? '  — ' + detail : ''}`);
  } else {
    fails.push(name);
    console.log(`GAGAL ${name}${detail ? '  — ' + detail : ''}`);
  }
}

const sw = readFileSync(SW_PATH, 'utf-8');

// ---------------------------------------------------------------------------
// 1. File ada & sintaks valid
// ---------------------------------------------------------------------------
check('public/sw.js ada', sw.length > 0);

const syntax = spawnSync(process.execPath, ['--check', SW_PATH], { encoding: 'utf-8' });
check('public/sw.js sintaks valid (node --check)',
  syntax.status === 0,
  syntax.status === 0 ? '' : (syntax.stderr || '').split('\n')[0]);

// ---------------------------------------------------------------------------
// 2. Strategi caching
// ---------------------------------------------------------------------------
check('precache app-shell terdefinisi (SHELL_URLS array)',
  /SHELL_URLS\s*=/.test(sw) && /\/assets\/design-tokens\.css/.test(sw));

check('event install memanggil precache + skipWaiting',
  /addEventListener\(\s*['"]install['"]/.test(sw) && /skipWaiting/.test(sw));

check('event activate membersihkan cache versi lama + clients.claim',
  /addEventListener\(\s*['"]activate['"]/.test(sw) &&
  /caches\.keys/.test(sw) &&
  /clients\.claim/.test(sw));

check('aset statis: stale-while-revalidate (cache.put pada respons sukses)',
  /handleAsset/.test(sw) && /cache\.put/.test(sw));

check('API GET: network-first dengan fallback cache',
  /handleApi/.test(sw) && /caches\.match/.test(sw));

check('navigasi: fallback app-shell saat offline',
  sw.includes("'navigate'") || sw.includes('"navigate"'));

check('SW melayani hanya origin sendiri (cross-origin dilewati)',
  /url\.origin\s*!==\s*self\.location\.origin/.test(sw));

// ---------------------------------------------------------------------------
// 3. KESELAMATAN: tulisan tidak di-cache
// ---------------------------------------------------------------------------
// POST/PUT/DELETE harus selalu ke jaringan dan tidak pernah di-respondWith.
check('handler fetch menolak method != GET di awal',
  /(?:req|request)\.method\s*!==\s*['"]GET['"]/.test(sw));

check('handleApi langsung fetch untuk method != GET',
  /if\s*\(\s*(?:request|req)\.method\s*!==\s*['"]GET['"]\s*\)\s*\{\s*return\s+fetch/.test(sw));

check('tidak ada cache.put pada path POST/PUT/DELETE',
  !/method\s*===\s*['"]POST['"][\s\S]{0,200}cache\.put/.test(sw));

check('respons API offline adalah 503 JSON terstruktur (bukan error mentah)',
  /status:\s*503/.test(sw) && /Sedang offline/.test(sw));

// ---------------------------------------------------------------------------
// 4. Pendaftaran di halaman
// ---------------------------------------------------------------------------
const PAGES = ['index.html', 'dashboard.html', 'track.html', 'pay.html'];
for (const page of PAGES) {
  const html = readFileSync(path.join(ROOT, 'public', page), 'utf-8');
  check(`${page} mendaftarkan serviceWorker (feature-detected, post-load)`,
    /'serviceWorker'\s*in\s*navigator/.test(html) &&
    /serviceWorker\.register\(\s*['"]\/sw\.js['"]/.test(html) &&
    /addEventListener\(\s*['"]load['"]/.test(html));
}

// ---------------------------------------------------------------------------
// 5. Simulasi runtime SW — buktikan cabang fetch berperilaku benar
// ---------------------------------------------------------------------------
// Tiruan caches + fetch + self untuk mengeksekusi logika sw.js tanpa browser.
// Cache browser menormalisasi URL relatif terhadap origin sebelum jadi key.
// Mock harus menirunya, jika tidak '/' dan 'https://embun.test/' dianggap
// key berbeda dan fallback navigasi offline kelihatan gagal (merah palsu).
const SW_ORIGIN = 'https://embun.test';
const cacheKey = (req) => {
  const k = typeof req === 'string' ? req : (req && req.url) || '';
  return k.startsWith('/') ? SW_ORIGIN + k : k;
};

class FakeResponse {
  constructor(body, opts) { this.body = body; this.status = (opts && opts.status) || 200; }
  static error() { return new FakeResponse(null, { status: 500 }); }
}

function makeCaches() {
  const store = new Map();
  return {
    store,
    async open(name) {
      return {
        async match(req) {
          return store.get(name + '::' + cacheKey(req));
        },
        async put(req, res) {
          store.set(name + '::' + cacheKey(req), res);
        }
      };
    },
    async keys() { return []; },
    async delete() { return true; }
  };
}

function makeSelf() {
  return {
    location: { origin: 'https://embun.test' },
    _listeners: {},
    addEventListener(name, fn) { this._listeners[name] = fn; },
    skipWaiting() {},
    clients: { claim() {} }
  };
}

// fetch online yang mencatat panggilan pada dirinya sendiri (terlihat di body).
function makeOnlineFetch(responses) {
  const log = [];
  const f = async (req) => {
    const key = typeof req === 'string' ? req : req.url;
    const method = (req && req.method) || 'GET';
    log.push({ method, url: key });
    const hit = responses && responses[key];
    if (hit) return hit;
    return {
      ok: true,
      status: 200,
      clone() { return this; },
      async text() { return 'ok'; }
    };
  };
  f._log = log;
  f._logAfterInstall = [];   // log setelah install selesai
  f._installDone = false;
  f._markInstallDone = () => { f._installDone = true; };
  return f;
}

function makeOfflineFetch(allowShellUrls) {
  const log = [];
  const allowed = (allowShellUrls || []).map(cacheKey);
  const f = async (req) => {
    const key = cacheKey(req);
    log.push({ method: (req && req.method) || 'GET', url: key });
    if (allowed.includes(key)) {
      return { ok: true, status: 200, clone() { return this; }, async text() { return 'shell'; } };
    }
    throw new Error('offline');
  };
  f._log = log;
  return f;
}

// Memuat sw.js: param HARUS terlihat di dalam body (scope global), closure TIDAK.
function loadSw(fetchImpl) {
  const caches = makeCaches();
  const self = makeSelf();
  const body = sw + '\nreturn {};';
  const fn = new Function('self', 'caches', 'fetch', 'Response', 'URL', body);
  fn(self, caches, fetchImpl, FakeResponse, URL);
  return { self, caches, fetchImpl };
}

// Catatan harness: respondWith di browser menerima Promise; di sini kita
// butuh nilai akhirnya, jadi simpan resolver dan settle setelah panggilan.
function makeRespondWith() {
  const state = { value: null, called: false, done: false };
  state.respondWith = (p) => {
    state.called = true;
    Promise.resolve(p).then((r) => { state.value = r; state.done = true; });
  };
  return state;
}
const settle = async (st) => {
  for (let i = 0; i < 40 && !st.done; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
};

const waitUntil = async (p) => { await p; };

// --- install & activate selesai tanpa error
let sim = null;
try {
  sim = loadSw(makeOnlineFetch());
  await sim.self._listeners.install({ waitUntil });
  await sim.self._listeners.activate({ waitUntil });
} catch (e) {
  check('install/activate SW selesai tanpa error', false, e.message);
  sim = null;
}
if (sim) {
  check('install/activate SW selesai tanpa error', true,
    'shell cache terisi=' + (sim.caches.store.size > 0));
}

// --- fetch GET aset memanggil jaringan (SWR)
if (sim) {
  const s2 = loadSw(makeOnlineFetch());
  await s2.self._listeners.install({ waitUntil });
  const rw = makeRespondWith();
  await s2.self._listeners.fetch({
    request: { method: 'GET', url: 'https://embun.test/assets/style.css', mode: 'no-cors' },
    respondWith: rw.respondWith,
    waitUntil
  });
  check('fetch GET aset memanggil jaringan (SWR)',
    s2.fetchImpl._log.some((l) => l.url.includes('/assets/style.css')));
}

// --- fetch POST /api/pay: pass-through ke browser, TIDAK diintercept SW
if (sim) {
  const s3 = loadSw(makeOnlineFetch());
  await s3.self._listeners.install({ waitUntil });
  const rw = makeRespondWith();
  await s3.self._listeners.fetch({
    request: { method: 'POST', url: 'https://embun.test/api/pay', mode: 'cors' },
    respondWith: rw.respondWith,
    waitUntil
  });
  await settle(rw);
  // Sw mengembalikan early-return untuk non-GET: browser yang menyentuh jaringan,
  // SW tidak pernah memanggil fetch maupun respondWith -> tulisan tidak di-cache.
  check('POST /api/pay di-pass-through ke jaringan (SW tidak intercept)',
    rw.called === false &&
    !s3.fetchImpl._log.some((l) => l.method === 'POST'));
}

// --- GET /api/ offline -> 503 JSON terstruktur
if (sim) {
  const s4 = loadSw(makeOfflineFetch());
  await s4.self._listeners.install({ waitUntil });
  const rw = makeRespondWith();
  await s4.self._listeners.fetch({
    request: { method: 'GET', url: 'https://embun.test/api/services', mode: 'cors' },
    respondWith: rw.respondWith,
    waitUntil
  });
  await settle(rw);
  const got = rw.value;
  check('GET /api/ offline -> 503 JSON terstruktur',
    got && got.status === 503 &&
    String(got.body).includes('ok') && String(got.body).includes('offline'),
    got ? 'status=' + got.status : 'tidak ada respons');
}

// --- navigasi offline jatuh ke shell (fetch offline hanya untuk /dashboard)
if (sim) {
  const offline = makeOfflineFetch([
    'https://embun.test/',            // precache shell mengambil ini
    'https://embun.test/dashboard.html'
  ]);
  const s5 = loadSw(offline);
  await s5.self._listeners.install({ waitUntil });
  const rw = makeRespondWith();
  await s5.self._listeners.fetch({
    request: { method: 'GET', url: 'https://embun.test/dashboard', mode: 'navigate' },
    respondWith: rw.respondWith,
    waitUntil
  });
  await settle(rw);
  const got = rw.value;
  // sw.js memasang navigasi dengan key URL ABSOLUT (req.url), jadi cache
  // untuk '/dashboard' tidak ada; fallback yang tersedia adalah '/'.
  check('navigasi offline jatuh ke app shell (bukan error mentah)',
    got && got.status === 200,
    got ? 'status=' + got.status + ' body=' + String(got.body ?? '') : 'tidak ada respons');
}

// --- cross-origin dilewati (tidak ada respondWith, tidak ada fetch)
if (sim) {
  const s6 = loadSw(makeOnlineFetch());
  await s6.self._listeners.install({ waitUntil });
  const rw = makeRespondWith();
  await s6.self._listeners.fetch({
    request: { method: 'GET', url: 'https://cdn.jsdelivr.net/npm/p5@1.9.4/lib/p5.min.js', mode: 'cors' },
    respondWith: rw.respondWith,
    waitUntil
  });
  check('cross-origin (CDN) dilewati SW (tidak di-respondWith)',
    rw.called === false && s6.fetchImpl._log.every((l) => !l.url.includes('cdn.jsdelivr')));
}

// ---------------------------------------------------------------------------
// HASIL
// ---------------------------------------------------------------------------
console.log('');
if (fails.length === 0) {
  console.log(`HASIL: HIJAU — ${pass} lulus, 0 gagal`);
  process.exit(0);
}
console.log(`HASIL: MERAH — ${pass} lulus, ${fails.length} gagal`);
for (const f of fails) console.log('  - ' + f);
process.exit(1);
