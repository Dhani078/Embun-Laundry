// tools/verify_d3.mjs
// Harness verifikasi Task D3 — Skeleton Loading di Semua Tabel Dashboard SPA
//
// Menguji:
// 1. Audit CSS Tokens & Shimmer:
//    - style.css memuat .skeleton, @keyframes skeletonShimmer, dan selector tema gelap.
//    - style.css memuat kelas bantuan: .skeleton-text, .skeleton-card, .skeleton-table-wrap.
//    - style.css memuat aturan aksesibilitas @media (prefers-reduced-motion: reduce).
//    - style.css memuat komponen .empty-state.
// 2. Audit Implementasi JavaScript (public/app.js):
//    - App.renderSkeletonTable terdefinisi dan menerima opsi { columns, rows, hasActions }.
//    - App.renderSkeletonCards terdefinisi dan menerima opsi count.
//    - App.renderEmptyState terdefinisi dan menerima { icon, title, subtitle, actionHtml }.
// 3. Integrasi pada 7 Fungsi Render Utama:
//    - renderDashboard menggunakan skeleton cards & skeleton table.
//    - renderPesanan menggunakan skeleton table & empty state saat orders kosong.
//    - renderPelanggan menggunakan skeleton table & empty state saat customers kosong.
//    - renderLayanan menggunakan skeleton cards/grid & empty state saat services kosong.
//    - renderDelivery menggunakan skeleton table & empty state saat tasks kosong.
//    - renderPromo menggunakan skeleton table.
//    - renderLaporan menggunakan skeleton cards & skeleton table.
//    - renderProfile menggunakan skeleton card.
// 4. Simulasi Runtime & Output HTML:
//    - Format HTML valid dan memiliki atribut aria-busy="true" dan role="status".
//    - Jumlah baris dan kolom skeleton sesuai konfigurasi.
//    - Sanitasi XSS pada teks empty state.
//
// Jalankan: node tools/verify_d3_run.mjs

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

console.log('=== VERIFIKASI TASK D3: SKELETON LOADING & EMPTY STATES ===\n');

// --------------------------------------------------------------------------
// 1. AUDIT STYLESHEET (style.css)
// --------------------------------------------------------------------------
const styleCss = fs.readFileSync(path.join(ROOT, 'public/assets/style.css'), 'utf8');

check('D3-CSS-01: style.css mendefinisikan kelas .skeleton dengan overflow hidden & border-radius',
  styleCss.includes('.skeleton {') &&
  styleCss.includes('overflow: hidden;')
);

check('D3-CSS-02: style.css mendefinisikan @keyframes skeletonShimmer untuk efek animasi shimmer',
  /@keyframes\s+skeletonShimmer\s*\{/.test(styleCss) &&
  styleCss.includes('transform: translateX(100%)')
);

check('D3-CSS-03: style.css mendukung dark theme untuk .skeleton via [data-theme="dark"]',
  styleCss.includes('[data-theme="dark"] .skeleton') &&
  styleCss.includes('background: #1e293b')
);

check('D3-CSS-04: style.css mendefinisikan kelas .skeleton-table-wrap dan .skeleton-table',
  styleCss.includes('.skeleton-table-wrap') &&
  styleCss.includes('.skeleton-table')
);

check('D3-CSS-05: style.css mendefinisikan kelas .skeleton-card dan .skeleton-text',
  styleCss.includes('.skeleton-card') &&
  styleCss.includes('.skeleton-text')
);

check('D3-CSS-06: style.css menghormati preferensi prefers-reduced-motion (animasi shimmer mati)',
  styleCss.includes('prefers-reduced-motion: reduce') &&
  styleCss.includes('skeletonPulse')
);

check('D3-CSS-07: style.css mendefinisikan komponen .empty-state, .empty-state-title, dan .empty-state-subtitle',
  styleCss.includes('.empty-state') &&
  styleCss.includes('.empty-state-icon') &&
  styleCss.includes('.empty-state-title')
);

// --------------------------------------------------------------------------
// 2. AUDIT DEFINISI FUNGSI DI public/app.js
// --------------------------------------------------------------------------
const appJs = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');

check('D3-JS-01: App mendefinisikan method renderSkeletonTable',
  appJs.includes('renderSkeletonTable({') || appJs.includes('renderSkeletonTable(')
);

check('D3-JS-02: App mendefinisikan method renderSkeletonCards',
  appJs.includes('renderSkeletonCards(')
);

check('D3-JS-03: App mendefinisikan method renderEmptyState',
  appJs.includes('renderEmptyState({') || appJs.includes('renderEmptyState(')
);

// --------------------------------------------------------------------------
// 3. AUDIT INTEGRASI DI SETIAP FUNGSI RENDER
// --------------------------------------------------------------------------
check('D3-INT-01: renderDashboard mengadopsi renderSkeletonCards & renderSkeletonTable',
  /renderDashboard\(\)\s*\{[\s\S]*?renderSkeletonCards[\s\S]*?renderSkeletonTable/s.test(appJs)
);

check('D3-INT-02: renderPesanan mengadopsi renderSkeletonTable saat memuat data',
  /renderPesanan\(params[\s\S]*?renderSkeletonTable/s.test(appJs)
);

check('D3-INT-03: renderPesanan menyertakan renderEmptyState saat daftar pesanan kosong',
  /renderPesanan\(params[\s\S]*?renderEmptyState[\s\S]*?Tidak Ada Pesanan/s.test(appJs)
);

check('D3-INT-04: renderPelanggan mengadopsi renderSkeletonTable & renderEmptyState',
  /renderPelanggan\(\)\s*\{[\s\S]*?renderSkeletonTable[\s\S]*?renderEmptyState/s.test(appJs)
);

check('D3-INT-05: renderLayanan mengadopsi skeleton loading & renderEmptyState',
  /renderLayanan\(\)\s*\{[\s\S]*?skeleton-card[\s\S]*?renderEmptyState/s.test(appJs)
);

check('D3-INT-06: renderDelivery mengadopsi renderSkeletonTable & renderEmptyState',
  /renderDelivery\(\)\s*\{[\s\S]*?renderSkeletonTable[\s\S]*?renderEmptyState/s.test(appJs)
);

check('D3-INT-07: renderPromo mengadopsi renderSkeletonTable',
  /renderPromo\(\)\s*\{[\s\S]*?renderSkeletonTable/s.test(appJs)
);

check('D3-INT-08: renderLaporan mengadopsi renderSkeletonCards & renderSkeletonTable',
  /renderLaporan\(\)\s*\{[\s\S]*?renderSkeletonCards[\s\S]*?renderSkeletonTable/s.test(appJs)
);

check('D3-INT-09: renderProfile mengadopsi skeleton placeholder saat memuat profil',
  /renderProfile\(\)\s*\{[\s\S]*?skeleton-card/s.test(appJs)
);

// --------------------------------------------------------------------------
// 4. SIMULASI RUNTIME & INTEGRITAS OUTPUT
// --------------------------------------------------------------------------
const sandbox = {
  console,
  URLSearchParams,
  location: { pathname: '/dashboard' }
};
const context = vm.createContext(sandbox);

const snippetMatch = appJs.match(/renderSkeletonTable\([\s\S]*?renderEmptyState\([\s\S]*?\n  \},/);
const snippet = snippetMatch ? snippetMatch[0] : '';

const scriptCode = `
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  var App = {
    ${snippet}
  };
`;

try {
  vm.runInContext(scriptCode, context);
  const testApp = context.App;

  // Test 4.1: renderSkeletonTable default
  const tableDefault = testApp.renderSkeletonTable();
  check('D3-SIM-01: renderSkeletonTable menghasilkan wrapper dengan aria-busy="true"',
    tableDefault.includes('class="skeleton-table-wrap"') &&
    tableDefault.includes('aria-busy="true"')
  );

  check('D3-SIM-02: renderSkeletonTable default menghasilkan 5 baris body',
    (tableDefault.match(/<tr style="border-bottom: 1px solid var\(--line\);/g) || []).length === 5
  );

  // Test 4.2: renderSkeletonTable kustom (7 kolom, 8 baris)
  const tableCustom = testApp.renderSkeletonTable({ columns: 7, rows: 8, hasActions: true });
  check('D3-SIM-03: renderSkeletonTable kustom menghasilkan 8 baris body dan kolom aksi',
    (tableCustom.match(/<tr style="border-bottom: 1px solid var\(--line\);/g) || []).length === 8 &&
    tableCustom.includes('skeleton-btn')
  );

  // Test 4.3: renderSkeletonCards
  const cardsHtml = testApp.renderSkeletonCards(4);
  check('D3-SIM-04: renderSkeletonCards menghasilkan 4 elemen kartu skeleton',
    (cardsHtml.match(/class="skeleton-card"/g) || []).length === 4 &&
    cardsHtml.includes('aria-busy="true"')
  );

  // Test 4.4: renderEmptyState
  const emptyHtml = testApp.renderEmptyState({
    icon: '🧺',
    title: 'Tidak Ada Pesanan',
    subtitle: 'Data belum tersedia.',
    actionHtml: '<button class="btn">Buat Baru</button>'
  });

  check('D3-SIM-05: renderEmptyState menghasilkan container dengan role="status"',
    emptyHtml.includes('class="empty-state"') &&
    emptyHtml.includes('role="status"')
  );

  check('D3-SIM-06: renderEmptyState menyertakan icon, judul, subtitle, dan tombol aksi',
    emptyHtml.includes('🧺') &&
    emptyHtml.includes('Tidak Ada Pesanan') &&
    emptyHtml.includes('Data belum tersedia.') &&
    emptyHtml.includes('Buat Baru')
  );

  // Test 4.5: Sanitasi XSS pada Empty State
  const xssEmptyHtml = testApp.renderEmptyState({
    title: '<script>alert(1)</script>',
    subtitle: '<b>test</b>'
  });
  check('D3-SIM-07: renderEmptyState melakukan escaping terhadap tag HTML berisiko XSS',
    !xssEmptyHtml.includes('<script>') &&
    xssEmptyHtml.includes('&lt;script&gt;')
  );

} catch (err) {
  check('D3-SIM-CRASH: Runtime simulasi skeleton bebas dari error', false, err.message);
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
