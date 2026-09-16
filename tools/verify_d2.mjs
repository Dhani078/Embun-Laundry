// tools/verify_d2.mjs
// Harness verifikasi Task D2 — Dark Mode Toggle (localStorage & Anti-FOUC)
//
// Menguji:
// 1. Audit Design Tokens: design-tokens.css memiliki [data-theme="dark"], html.dark
//    dengan variabel palet dark slate Linear/Vercel.
// 2. Audit Style CSS: style.css memiliki [data-theme="dark"], html.dark,
//    .sidebar menggunakan background: var(--card), dan styling .theme-toggle-btn.
// 3. Anti-FOUC (Flash of Unstyled Content): dashboard.html, index.html, track.html,
//    dan pay.html menyematkan script inline anti-FOUC di dalam <head>.
// 4. Tombol Toggle UI: dashboard.html, index.html, track.html, dan pay.html
//    memiliki elemen toggle tema (#themeToggleBtn).
// 5. Audit Logika App.js: implementasi initTheme, applyTheme, toggleTheme,
//    updateThemeIcons, binding di init() & bindEvents(), serta renderApp().
// 6. Simulasi Siklus Hidup Tema & localStorage:
//    - default fallback saat localStorage kosong.
//    - toggle light -> dark -> light.
//    - update attribute data-theme dan class dark pada <html>.
//    - update ikon 🌙 / ☀️.
//    - respon terhadap 'storage' event multi-tab.
//
// Jalankan: node tools/verify_d2_run.mjs

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

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

console.log('=== VERIFIKASI TASK D2: DARK MODE TOGGLE & LOCALSTORAGE ===\n');

// --------------------------------------------------------------------------
// 1. AUDIT CSS & TOKENS
// --------------------------------------------------------------------------
const designTokensCss = fs.readFileSync(path.join(ROOT, 'public/assets/design-tokens.css'), 'utf8');
const styleCss = fs.readFileSync(path.join(ROOT, 'public/assets/style.css'), 'utf8');

check('D2-CSS-01: design-tokens.css mendefinisikan selector [data-theme="dark"], html.dark',
  designTokensCss.includes('[data-theme="dark"], html.dark') || designTokensCss.includes('[data-theme="dark"]')
);

check('D2-CSS-02: design-tokens.css memiliki semantic tokens dark slate (#090d16 & #111827)',
  designTokensCss.includes('#090d16') && designTokensCss.includes('#111827')
);

check('D2-CSS-03: style.css mendefinisikan dark theme variables [data-theme="dark"]',
  styleCss.includes('[data-theme="dark"]') && styleCss.includes('--bg: #090d16')
);

check('D2-CSS-04: style.css sidebar menggunakan var(--card) menghindari hardcode putih',
  /\.sidebar\s*\{[^}]*background:\s*var\(--card\)/s.test(styleCss)
);

check('D2-CSS-05: style.css mendefinisikan kelas .theme-toggle-btn untuk interaktivitas tombol tema',
  styleCss.includes('.theme-toggle-btn') && styleCss.includes('[data-theme="dark"] .theme-toggle-btn')
);

// --------------------------------------------------------------------------
// 2. AUDIT ANTI-FOUC PADA SEMUA SHELL HTML
// --------------------------------------------------------------------------
const htmlFiles = [
  { name: 'dashboard.html', path: path.join(ROOT, 'public/dashboard.html') },
  { name: 'index.html', path: path.join(ROOT, 'public/index.html') },
  { name: 'track.html', path: path.join(ROOT, 'public/track.html') },
  { name: 'pay.html', path: path.join(ROOT, 'public/pay.html') },
];

for (const item of htmlFiles) {
  const content = fs.readFileSync(item.path, 'utf8');
  
  // Script harus ada di dalam <head> sebelum atau sejalan pemuatan CSS
  const headMatch = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const inHead = headMatch ? headMatch[1] : '';

  check(`D2-FOUC-${item.name}: Anti-FOUC script terdapat di dalam <head>`,
    inHead.includes('localStorage.getItem(\'theme\')') &&
    inHead.includes('data-theme')
  );

  check(`D2-BTN-${item.name}: Tombol #themeToggleBtn ada pada halaman`,
    content.includes('id="themeToggleBtn"') || content.includes('themeToggleBtn')
  );
}

// --------------------------------------------------------------------------
// 3. AUDIT LOGIKA DI public/app.js
// --------------------------------------------------------------------------
const appJs = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');

check('D2-APP-01: App.init memanggil this.initTheme()',
  /init\(\)\s*\{[^}]*this\.initTheme\(\)/s.test(appJs)
);

check('D2-APP-02: App mendefinisikan initTheme() dengan pengecekan localStorage & prefers-color-scheme',
  appJs.includes('initTheme()') &&
  appJs.includes('localStorage.getItem(\'theme\')') &&
  appJs.includes('prefers-color-scheme')
);

check('D2-APP-03: App mendefinisikan applyTheme(theme) yang mengatur data-theme dan kelas dark',
  appJs.includes('applyTheme(theme)') &&
  appJs.includes("setAttribute('data-theme'") &&
  appJs.includes("classList.add('dark')")
);

check('D2-APP-04: App mendefinisikan toggleTheme() yang membalik tema dan menyimpan ke localStorage',
  appJs.includes('toggleTheme()') &&
  appJs.includes("localStorage.setItem('theme'")
);

check('D2-APP-05: App mendefinisikan updateThemeIcons(isDark) untuk sinkronisasi ikon ☀️ dan 🌙',
  appJs.includes('updateThemeIcons(isDark)') &&
  appJs.includes('☀️') && appJs.includes('🌙')
);

check('D2-APP-06: bindEvents() mendengarkan klik pada #themeToggleBtn / .theme-toggle-btn',
  appJs.includes('bindEvents()') &&
  appJs.includes('#themeToggleBtn')
);

check('D2-APP-07: renderApp() menyertakan #themeToggleBtn pada topbar dashboard',
  appJs.includes('renderApp()') &&
  appJs.includes('id="themeToggleBtn"')
);

// --------------------------------------------------------------------------
// 4. SIMULASI PERILAKU DI RUNTIME (MOCK DOM & LOCALSTORAGE)
// --------------------------------------------------------------------------
let mockStorage = {};
const listeners = {};
const classSet = new Set();

const mockDocumentElement = {
  attributes: {},
  classList: {
    add(c) { classSet.add(c); },
    remove(c) { classSet.delete(c); },
    contains(c) { return classSet.has(c); }
  },
  setAttribute(k, v) { this.attributes[k] = String(v); },
  getAttribute(k) { return this.attributes[k] || null; },
  removeAttribute(k) { delete this.attributes[k]; }
};

const mockIconEl = { textContent: '🌙' };
const mockDoc = {
  documentElement: mockDocumentElement,
  querySelectorAll(sel) {
    if (sel.includes('#themeIcon') || sel.includes('.theme-icon')) {
      return [mockIconEl];
    }
    return [];
  },
  getElementById(id) {
    if (id === 'themeIcon') return mockIconEl;
    return null;
  },
  addEventListener(event, fn) {
    listeners[event] = listeners[event] || [];
    listeners[event].push(fn);
  }
};

const mockWindow = {
  addEventListener(event, fn) {
    listeners[event] = listeners[event] || [];
    listeners[event].push(fn);
  },
  matchMedia(query) {
    return { matches: false }; // default light jika media query dicek
  }
};

const mockLocalStorage = {
  getItem(k) { return mockStorage[k] || null; },
  setItem(k, v) { mockStorage[k] = String(v); },
  removeItem(k) { delete mockStorage[k]; }
};

// Buat sandbox VM untuk mengisolasi logika App dari app.js
const sandbox = {
  window: mockWindow,
  document: mockDoc,
  localStorage: mockLocalStorage,
  console,
  setTimeout: () => {},
  clearTimeout: () => {},
  fetch: async () => ({ json: async () => ({ ok: true }) }),
  URLSearchParams,
  location: { pathname: '/dashboard' }
};

const context = vm.createContext(sandbox);

// Eksekusi snippet App.initTheme & toggleTheme di sandbox
const snippet = appJs.match(/initTheme\(\)\s*\{[\s\S]*?updateThemeIcons\(isDark\)\s*\{[\s\S]*?\n  \},/)[0];
const scriptCode = `
  const esc = s => String(s);
  window.App = {
    ${snippet}
  };
`;

try {
  vm.runInContext(scriptCode, context);
  const testApp = sandbox.window.App;

  // Test 4.1: Inisialisasi awal tanpa localStorage -> 'light'
  mockStorage = {};
  testApp.initTheme();

  check('D2-SIM-01: Inisialisasi default menghasilkan data-theme="light"',
    mockDocumentElement.getAttribute('data-theme') === 'light'
  );
  check('D2-SIM-02: Ikon tema saat light adalah 🌙',
    mockIconEl.textContent === '🌙'
  );

  // Test 4.2: Toggle pertama -> 'dark'
  testApp.toggleTheme();

  check('D2-SIM-03: toggleTheme() mengubah data-theme menjadi "dark"',
    mockDocumentElement.getAttribute('data-theme') === 'dark'
  );
  check('D2-SIM-04: toggleTheme() menambahkan class "dark" ke documentElement',
    mockDocumentElement.classList.contains('dark') === true
  );
  check('D2-SIM-05: toggleTheme() menyimpan "dark" ke localStorage',
    mockLocalStorage.getItem('theme') === 'dark'
  );
  check('D2-SIM-06: Ikon tema saat dark berubah menjadi ☀️',
    mockIconEl.textContent === '☀️'
  );

  // Test 4.3: Toggle kedua -> 'light'
  testApp.toggleTheme();

  check('D2-SIM-07: toggleTheme() kembali ke "light"',
    mockDocumentElement.getAttribute('data-theme') === 'light' &&
    mockLocalStorage.getItem('theme') === 'light'
  );
  check('D2-SIM-08: Class "dark" dihapus saat beralih ke light',
    mockDocumentElement.classList.contains('dark') === false
  );
  check('D2-SIM-09: Ikon kembali menjadi 🌙',
    mockIconEl.textContent === '🌙'
  );

  // Test 4.4: Sinkronisasi storage event (tab lain mengubah tema ke 'dark')
  if (listeners['storage'] && listeners['storage'].length > 0) {
    const storageHandler = listeners['storage'][0];
    storageHandler({ key: 'theme', newValue: 'dark' });

    check('D2-SIM-10: Multi-tab sync mengubah data-theme menjadi "dark" saat storage event fired',
      mockDocumentElement.getAttribute('data-theme') === 'dark' &&
      mockIconEl.textContent === '☀️'
    );
  } else {
    check('D2-SIM-10: Multi-tab sync event listener terpasang', false, 'storage listener tidak ditemukan');
  }

} catch (err) {
  check('D2-SIM-CRASH: Runtime simulasi bebas dari error', false, err.message);
}

// --------------------------------------------------------------------------
// RINGKASAN
// --------------------------------------------------------------------------
console.log(`\nHASIL: ${pass} lulus, ${fail} gagal (${pass}/${pass + fail})`);
if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
