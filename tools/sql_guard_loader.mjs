// Node ESM loader: alihkan import '@tidbcloud/serverless' ke mock pencatat SQL.
// Dipakai lewat: node --import ./tools/sql_guard_register.mjs tools/verify_b7.mjs

import { pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const MOCK = pathToFileURL(path.resolve(HERE, 'mock_tidb.mjs')).href;

export async function resolve(specifier, context, next) {
  if (specifier === '@tidbcloud/serverless') {
    return { url: MOCK, shortCircuit: true, format: 'module' };
  }
  return next(specifier, context);
}
