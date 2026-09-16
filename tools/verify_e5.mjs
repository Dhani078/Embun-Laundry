/**
 * verify_e5.mjs — E5: Logging terstruktur dev-only
 */
import { readFileSync } from 'fs';

const logger = readFileSync('functions/_logger.js', 'utf8');
const index  = readFileSync('src/index.js', 'utf8');

const tests = [
  // _logger.js structure
  ['makeLogger exported',              logger.includes('export function makeLogger(')],
  ['noop in production',               logger.includes('NOOP_LOGGER')],
  ['active only when ENVIRONMENT=dev', logger.includes("env.ENVIRONMENT === 'development'")],
  ['OR when LOG_LEVEL set',            logger.includes('env.LOG_LEVEL')],
  ['levels: debug/info/warn/error',    ['debug','info','warn','error'].every(l => logger.includes(`'${l}'`))],
  ['log.req logs method+path+status',  logger.includes("'router'") && logger.includes('method') && logger.includes('status')],
  ['JSON.stringify output',            logger.includes('JSON.stringify(entry)')],
  ['NOOP methods are no-ops',          logger.includes('debug: () => {}')],
  // src/index.js integration
  ['makeLogger imported in index',     index.includes("from '../functions/_logger.js'")],
  ['makeLogger called with env',       index.includes('makeLogger(env)')],
  ['t0 = Date.now()',                  index.includes('Date.now()')],
  ['log.req called on API response',   index.includes('log.req(request,')],
  ['log.req on 404',                   (index.match(/log\.req\(request,/g) || []).length >= 2],
  // safety: no console.log in hot path outside logger
  ['no raw console.log in index.js',   !index.includes('console.log')],
];

let pass = 0;
for (const [name, ok] of tests) {
  console.log((ok ? 'HIJAU' : 'MERAH') + ' ' + name);
  if (ok) pass++;
}
console.log(`\n${pass}/${tests.length}`);
if (pass !== tests.length) process.exit(1);
