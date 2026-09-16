/**
 * _logger.js — Structured dev-only logger for Cloudflare Workers
 *
 * Active when env.ENVIRONMENT === 'development' OR env.LOG_LEVEL is set.
 * No-op in production (zero overhead).
 *
 * Usage:
 *   import { makeLogger } from '../_logger.js';
 *   const log = makeLogger(env);
 *   log.info('orders', 'create_order', { user_id: 1 });
 *   log.warn('pay', 'overpay attempt', { order_id: 42 });
 *   log.error('auth', 'login failed', { identity });
 *   log.req(request, 200, 12);  // request log with status + ms
 */

export function makeLogger(env) {
  const active =
    (env && env.ENVIRONMENT === 'development') ||
    (env && env.LOG_LEVEL && env.LOG_LEVEL !== 'off');

  if (!active) return NOOP_LOGGER;

  const level = (env && env.LOG_LEVEL) ? env.LOG_LEVEL.toLowerCase() : 'debug';
  const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
  const minLevel = LEVELS[level] ?? 0;

  function emit(lvl, module, msg, data) {
    if ((LEVELS[lvl] ?? 0) < minLevel) return;
    const entry = {
      ts: new Date().toISOString(),
      lvl,
      mod: module,
      msg,
      ...(data && typeof data === 'object' ? data : {}),
    };
    // console.log is the only output available in Workers
    // ponytail: no external sink; add when Workers Analytics Engine is bound
    console.log(JSON.stringify(entry));
  }

  return {
    debug: (mod, msg, data) => emit('debug', mod, msg, data),
    info:  (mod, msg, data) => emit('info',  mod, msg, data),
    warn:  (mod, msg, data) => emit('warn',  mod, msg, data),
    error: (mod, msg, data) => emit('error', mod, msg, data),
    req:   (request, status, ms) => emit('info', 'router', 'request', {
      method: request.method,
      path: new URL(request.url).pathname,
      status,
      ms: ms ?? null,
    }),
  };
}

const NOOP_LOGGER = {
  debug: () => {},
  info:  () => {},
  warn:  () => {},
  error: () => {},
  req:   () => {},
};
