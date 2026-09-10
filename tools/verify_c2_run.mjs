// tools/verify_c2_run.mjs
// Pembungkus register loader untuk Windows (pola sama dengan verify_b11_run).
// Jalankan:  node tools/verify_c2_run.mjs
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
register('./sql_guard_loader.mjs', pathToFileURL(here + path.sep));
await import('./verify_c2.mjs');
