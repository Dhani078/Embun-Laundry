// Pembungkus register loader untuk Windows: import loader lalu jalankan verify_b17.
// Jalankan:  node tools/verify_b17_run.mjs
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
register('./sql_guard_loader.mjs', pathToFileURL(here + path.sep));
await import('./verify_b17.mjs');
