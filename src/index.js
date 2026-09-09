// src/index.js - Cloudflare Worker Entry Point with Static Assets & API Routing
import * as loginHandler from '../functions/api/auth/login.js';
import * as registerHandler from '../functions/api/auth/register.js';
import * as logoutHandler from '../functions/api/auth/logout.js';
import * as meHandler from '../functions/api/me.js';
import * as ordersHandler from '../functions/api/orders.js';
import * as customersHandler from '../functions/api/customers.js';
import * as servicesHandler from '../functions/api/services.js';
import * as deliveryHandler from '../functions/api/delivery.js';
import * as promosHandler from '../functions/api/promos.js';
import * as vouchersHandler from '../functions/api/vouchers.js';
import * as reportsHandler from '../functions/api/reports.js';
import * as profileHandler from '../functions/api/profile.js';
import * as checkinHandler from '../functions/api/checkin.js';
import * as payHandler from '../functions/api/pay.js';
import * as dashboardHandler from '../functions/api/dashboard.js';
import * as healthHandler from '../functions/api/health.js';
import { withSecurityHeaders, SECURITY_HEADERS } from '../functions/_db.js';
import { applyCors } from '../functions/_cors.js';

function rewriteImagePath(pathname) {
  // Handle case-insensitive image requests - rewrite to actual filenames
  const lower = pathname.toLowerCase();
  if (lower === '/img/logo.png' || lower === '/logo.png') return '/img/Logo.png';
  if (lower === '/img/3d.png' || lower === '/3d.png') return '/img/3d.png';
  if (lower === '/img/avatar-placeholder.png' || lower === '/avatar-placeholder.png') return '/img/avatar-placeholder.png';
  if (lower.startsWith('/assets/') && lower.endsWith('.css')) {
    // Handle CSS file references
    return pathname;
  }
  return pathname;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname;

    // Rewrite image paths for case-insensitive matching
    const rewrittenPath = rewriteImagePath(path);
    if (rewrittenPath !== path) {
      const newUrl = new URL(request.url);
      newUrl.pathname = rewrittenPath;
      return withSecurityHeaders(await env.ASSETS.fetch(newUrl));
    }

    // Route API requests
    if (path.startsWith('/api/')) {
      const context = { request, env, ctx, params: {} };
      let resp;

      // Preflight CORS: pakai handler `onRequestOptions` bila ada, supaya
      // browser tidak menerima 405/401. (A4 — kontrak respons konsisten)
      if (request.method === 'OPTIONS') {
        const optMap = {
          '/api/auth/login': loginHandler,
          '/api/auth/register': registerHandler,
          '/api/auth/logout': logoutHandler,
          '/api/health': healthHandler,
          '/api/me': meHandler
        };
        const h = optMap[path];
        if (h?.onRequestOptions) {
          // B5: preflight juga lewat applyCors agar hanya origin izin yang
          // mendapat Access-Control-Allow-Origin.
          return applyCors(withSecurityHeaders(await h.onRequestOptions(context)), request, env);
        }
        // Handler lain menangani OPTIONS di dalam tubuhnya masing-masing.
      }

      if (path === '/api/auth/login') {
        if (request.method === 'POST') resp = loginHandler.onRequestPost(context);
        else if (request.method === 'OPTIONS') resp = loginHandler.onRequestOptions(context);
      }
      else if (path === '/api/auth/register') {
        if (request.method === 'POST') resp = registerHandler.onRequestPost(context);
        else if (request.method === 'OPTIONS') resp = registerHandler.onRequestOptions(context);
      }
      else if (path === '/api/auth/logout') {
        if (request.method === 'POST') resp = logoutHandler.onRequestPost(context);
        else if (request.method === 'OPTIONS') resp = logoutHandler.onRequestOptions(context);
      }
      else if (path === '/api/me') resp = meHandler.onRequestGet(context);
      else if (path === '/api/health') resp = healthHandler.onRequestGet(context);
      else if (path === '/api/dashboard') resp = dashboardHandler.onRequestGet(context);
      else if (path === '/api/orders') resp = ordersHandler.onRequest(context);
      else if (path === '/api/customers') resp = customersHandler.onRequest(context);
      else if (path === '/api/services') resp = servicesHandler.onRequest(context);
      else if (path === '/api/delivery') resp = deliveryHandler.onRequest(context);
      else if (path === '/api/promos') resp = promosHandler.onRequest(context);
      else if (path === '/api/vouchers') resp = vouchersHandler.onRequest(context);
      else if (path === '/api/reports') resp = reportsHandler.onRequestGet(context);
      else if (path === '/api/profile') resp = profileHandler.onRequest(context);
      else if (path === '/api/checkin') resp = checkinHandler.onRequest(context);
      else if (path === '/api/pay') resp = payHandler.onRequest(context);

      // B5: satu titik pemasangan header CORS untuk SELURUH /api/*,
      // termasuk jalur 404 di bawah. Tanpa ini, respons yang dibuat
      // langsung di sini (bukan lewat handler) tidak akan pernah
      // mendapat header CORS.
      if (resp) return applyCors(withSecurityHeaders(await resp), request, env);

      return applyCors(withSecurityHeaders(new Response(JSON.stringify({ ok: false, msg: 'Endpoint not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })), request, env);
    }

    // Serve static assets from public directory
    if (env.ASSETS) {
      // Handle SPA routes - serve dashboard.html for /dashboard and sub-routes
      if (path === '/dashboard' || path.startsWith('/dashboard/')) {
        const dashboardUrl = new URL(request.url);
        dashboardUrl.pathname = '/dashboard.html';
        const dashRes = await env.ASSETS.fetch(dashboardUrl);
        const dashHeaders = new Headers(dashRes.headers);
        for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
          if (!dashHeaders.has(k)) dashHeaders.set(k, v);
        }
        return new Response(dashRes.body, {
          status: dashRes.status,
          statusText: dashRes.statusText,
          headers: dashHeaders
        });
      }

      const assetRes = await env.ASSETS.fetch(request);

      // B4: Cloudflare's static-asset binding can return an IMMUTABLE response
      // whose headers are frozen, so withSecurityHeaders() silently no-ops
      // (confirmed: / and /robots.txt served with CF-Cache-Status: HIT and NO
      // security headers, while /api/* had them). Rebuild the response so
      // headers are writable — body is streamed through untouched.
      const headers = new Headers(assetRes.headers);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
        if (!headers.has(k)) headers.set(k, v);
      }
      return new Response(assetRes.body, {
        status: assetRes.status,
        statusText: assetRes.statusText,
        headers
      });
    }

    return withSecurityHeaders(new Response('Asset not found', { status: 404 }));
  }
};