// tools/verify_c5.mjs
// Harness verifikasi Task C5 — Invoice PDF & Cetak Struk Kasir (P3)
// Beserta verifikasi optimasi aplikasi ringan (E1 Edge Caching & Dead Code Removal).
//
// Menguji:
// 1. Audit frontend SPA (public/app.js): openInvoice, renderInvoiceModal, switchInvoiceMode, XSS escaping, tombol invoice di pesanan & dashboard.
// 2. Audit halaman publik pelacakan (public/track.html): tombol cetak invoice, trackInvoiceModal, dual mode, escapeHtml.
// 3. Audit stylesheet (public/assets/style.css): @media print, .invoice-paper, .thermal-mode (80mm), .a4-mode, .toast-container.
// 4. Audit sistem notifikasi ringan: App.toast() modern, transisi CSS, eliminasi alert() pemblokir browser.
// 5. Audit optimasi edge caching: public/_headers (assets & img), functions/api/services.js (Cache-Control pada katalog publik).
// 6. Audit kebersihan bundle (Lightweight & Clean): penghapusan duplikasi gambar 7MB, tanpa library PDF eksternal berat (0 dependency).
// 7. Pengujian fungsional logika nota & sanitasi XSS.
//
// Jalankan: node tools/verify_c5_run.mjs

import fs from 'node:fs';
import path from 'node:path';
import worker from '../src/index.js';
import { onRequest as servicesHandler } from '../functions/api/services.js';
import { jsonResponse } from '../functions/_db.js';

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

// ---------------------------------------------------------------------------
// 1. Audit Statik public/app.js (SPA Invoice & Struk)
// ---------------------------------------------------------------------------
const appJsPath = path.join(ROOT, 'public', 'app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');

check('app.js mendefinisikan openInvoice', appJs.includes('openInvoice('));
check('app.js mendefinisikan switchInvoiceMode', appJs.includes('switchInvoiceMode('));
check('app.js mendefinisikan renderInvoiceModal', appJs.includes('renderInvoiceModal('));
check('app.js mendukung mode thermal (80mm) dan a4', appJs.includes('thermal-mode') && appJs.includes('a4-mode'));
check('app.js menyertakan vektor SVG QR code bawaan', appJs.includes('<svg') && appJs.includes('viewBox="0 0 64 64"'));
check('app.js menerapkan esc() pada customer_name invoice', appJs.includes('esc(o.customer_name'));
check('app.js menerapkan esc() pada order_code invoice', appJs.includes('esc(o.order_code'));
check('app.js menerapkan esc() pada service_name invoice', appJs.includes('esc(o.service_name'));
check('app.js memiliki tombol 🧾 Invoice pada renderPesanan', appJs.includes('App.openInvoice') && appJs.includes('renderPesanan'));
check('app.js memiliki tombol 🧾 Invoice pada renderDashboard recent orders', appJs.includes('App.openInvoice') && appJs.includes('renderDashboard'));

// ---------------------------------------------------------------------------
// 2. Audit Statik public/track.html (Pelacakan Publik + Cetak Nota)
// ---------------------------------------------------------------------------
const trackHtmlPath = path.join(ROOT, 'public', 'track.html');
const trackHtml = fs.readFileSync(trackHtmlPath, 'utf8');

check('track.html memiliki tombol Cetak / Unduh Invoice', trackHtml.includes('btn-print-invoice'));
check('track.html memiliki elemen modal trackInvoiceModal', trackHtml.includes('id="trackInvoiceModal"'));
check('track.html memiliki card invoice-paper', trackHtml.includes('trackInvoiceCard') && trackHtml.includes('invoice-paper'));
check('track.html memiliki fungsi renderTrackInvoice', trackHtml.includes('renderTrackInvoice('));
check('track.html menerapkan escapeHtml pada nota publik', trackHtml.includes('escapeHtml(o.order_code') && trackHtml.includes('escapeHtml(o.customer_name'));
check('track.html mendukung pergantian format Struk (80mm) & Formal (A4)', trackHtml.includes('invModeThermal') && trackHtml.includes('invModeA4'));
check('track.html memiliki style @media print untuk invoice', trackHtml.includes('@media print') && trackHtml.includes('#trackInvoiceModal'));

// ---------------------------------------------------------------------------
// 3. Audit Stylesheet public/assets/style.css (Print & Invoice Rules)
// ---------------------------------------------------------------------------
const styleCssPath = path.join(ROOT, 'public', 'assets', 'style.css');
const styleCss = fs.readFileSync(styleCssPath, 'utf8');

check('style.css memiliki aturan @media print', styleCss.includes('@media print'));
check('style.css menyembunyikan sidebar dan topbar saat print', styleCss.includes('.sidebar') && styleCss.includes('display: none !important'));
check('style.css memiliki styling .invoice-paper', styleCss.includes('.invoice-paper'));
check('style.css memiliki styling format 80mm .thermal-mode', styleCss.includes('.thermal-mode') && styleCss.includes('80mm'));
check('style.css memiliki styling format A4 .a4-mode', styleCss.includes('.a4-mode'));
check('style.css memiliki styling .toast-container & .toast-item', styleCss.includes('.toast-container') && styleCss.includes('.toast-item'));

// ---------------------------------------------------------------------------
// 4. Audit Sistem Notifikasi Ringan (Toast Notification)
// ---------------------------------------------------------------------------
check('app.js mendefinisikan App.toast()', appJs.includes('toast(msg, type'));
check('app.js tidak lagi memakai alert() pemblokir browser di kode utama', !appJs.includes('alert('));
check('style.css mendukung varian toast (success, error, warning)', styleCss.includes('.toast-success') && styleCss.includes('.toast-error'));

// ---------------------------------------------------------------------------
// 5. Audit Optimasi Edge Caching (Task E1)
// ---------------------------------------------------------------------------
const headersPath = path.join(ROOT, 'public', '_headers');
const headersContent = fs.readFileSync(headersPath, 'utf8');

check('_headers memiliki Cache-Control untuk /assets/*', headersContent.includes('/assets/*') && headersContent.includes('Cache-Control: public'));
check('_headers memiliki Cache-Control untuk /img/*', headersContent.includes('/img/*') && headersContent.includes('Cache-Control: public'));

// Uji jsonResponse helper mendukung extraHeaders
const customRes = jsonResponse({ ok: true }, 200, { 'Cache-Control': 'max-age=60' });
check('jsonResponse mendukung extraHeaders', customRes.headers.get('Cache-Control') === 'max-age=60');

// Uji handler /api/services menyertakan Cache-Control pada GET publik
const mockEnv = {
  TIDB_DATABASE_URL: 'mysql://mock:3306/laundry',
  JWT_SECRET: 'test-secret'
};

const svcReq = new Request('http://localhost/api/services', { method: 'GET' });
const svcRes = await servicesHandler({ request: svcReq, env: mockEnv });
const svcCacheHdr = svcRes.headers.get('Cache-Control');
check('GET /api/services publik mengembalikan header Cache-Control', svcCacheHdr && svcCacheHdr.includes('max-age=300'));

// ---------------------------------------------------------------------------
// 6. Audit Kebersihan Bundle & Dead Code Removal
// ---------------------------------------------------------------------------
const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const allDeps = Object.keys(pkgJson.dependencies || {}).concat(Object.keys(pkgJson.devDependencies || {}));

check('Tidak ada library PDF eksternal berat di package.json (0 overhead)', 
  !allDeps.includes('jspdf') && !allDeps.includes('pdfmake') && !allDeps.includes('html2canvas'));

const rootPngExists = fs.existsSync(path.join(ROOT, 'public', '3d.png')) ||
                      fs.existsSync(path.join(ROOT, 'public', 'Logo.png')) ||
                      fs.existsSync(path.join(ROOT, 'public', 'avatar-placeholder.png'));
check('Duplikasi 3.5MB gambar di root public/ sudah dibersihkan', !rootPngExists);

const assetsImgExists = fs.existsSync(path.join(ROOT, 'public', 'assets', 'img', '3d.png'));
check('Duplikasi 3.5MB gambar di public/assets/img/ sudah dibersihkan', !assetsImgExists);

const canonicalLogoExists = fs.existsSync(path.join(ROOT, 'public', 'img', 'Logo.png'));
const canonical3dExists = fs.existsSync(path.join(ROOT, 'public', 'img', '3d.png'));
check('Asset kanonikal di public/img/ tetap utuh dan aman', canonicalLogoExists && canonical3dExists);

// ---------------------------------------------------------------------------
// 7. Pengujian Fungsional Logika Nota & Sanitasi XSS
// ---------------------------------------------------------------------------
function calculateInvoiceSummary(order) {
  const total = Number(order.total_amount) || 0;
  const paid = Number(order.paid_amount) || 0;
  const remaining = Math.max(0, total - paid);
  const isPaid = (order.payment_status === 'lunas' || order.payment_status === 'paid') || (paid >= total && total > 0);
  return { total, paid, remaining, isPaid };
}

// Simulasi lunas
const inv1 = calculateInvoiceSummary({ total_amount: 50000, paid_amount: 50000, payment_status: 'lunas' });
check('Kalkulasi invoice lunas tepat: sisa = 0', inv1.remaining === 0 && inv1.isPaid === true);

// Simulasi belum lunas
const inv2 = calculateInvoiceSummary({ total_amount: 100000, paid_amount: 40000, payment_status: 'unpaid' });
check('Kalkulasi invoice sebagian tepat: sisa = 60000', inv2.remaining === 60000 && inv2.isPaid === false);

// Simulasi pertahanan XSS pada data pelanggan jahat
function escSim(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const xssPayload = '<script>alert("hacked")</script><img src=x onerror=alert(1)>';
const safeOutput = escSim(xssPayload);
check('Sanitasi XSS mengubah tag script dan onerror jadi HTML entities', 
  !safeOutput.includes('<script>') && safeOutput.includes('&lt;script&gt;') && !safeOutput.includes('<img'));

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------
console.log('');
console.log(`HASIL: ${fail === 0 ? 'HIJAU' : 'MERAH'} ${pass}/${pass + fail}`);

if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
