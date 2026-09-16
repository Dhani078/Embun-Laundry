/**
 * verify_e6.mjs — E6: Error boundary global SPA
 */
import { readFileSync } from 'fs';

const app = readFileSync('public/app.js', 'utf8');
const css = readFileSync('public/assets/style.css', 'utf8');

const tests = [
  // renderError method
  ['renderError method defined',         app.includes('renderError(')],
  ['renderError writes to mainContent',  app.includes("getElementById('mainContent')")],
  ['renderError uses .err class',        app.includes('class="err"') || app.includes("class='err'")],
  ['renderError shows err-title',        app.includes('err-title')],
  ['renderError shows err-detail',       app.includes('err-detail')],
  ['renderError escapes message',        app.includes('esc(msg')],
  ['renderError has retry button',       app.includes('Coba Lagi')],
  // renderPage try/catch
  ['renderPage wrapped in try/catch',    app.includes('try {') && app.includes('catch (e)')],
  ['renderPage catch calls renderError', app.includes('this.renderError(')],
  // global handlers
  ['window error listener',             app.includes("addEventListener('error'")],
  ['unhandledrejection listener',       app.includes("addEventListener('unhandledrejection'")],
  ['global handler calls renderError',  (app.match(/App\.renderError/g) || []).length >= 2],
  // CSS
  ['.err style in CSS',                 css.includes('.err {')],
  ['.err-title style in CSS',           css.includes('.err-title')],
  ['.err-detail style in CSS',          css.includes('.err-detail')],
  // safety: renderError guards null mainContent
  ['renderError null guard',            app.includes('if (!c) return')],
];

let pass = 0;
for (const [name, ok] of tests) {
  console.log((ok ? 'HIJAU' : 'MERAH') + ' ' + name);
  if (ok) pass++;
}
console.log(`\n${pass}/${tests.length}`);
if (pass !== tests.length) process.exit(1);
