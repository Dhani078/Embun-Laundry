// tools/verify_c_pay_sync_run.mjs
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./tools/sql_guard_loader.mjs', pathToFileURL('./'));
await import('./verify_c_pay_sync.mjs');
