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
import { withSecurityHeaders } from '../functions/_db.js';

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

      if (resp) return withSecurityHeaders(await resp);

      return withSecurityHeaders(new Response(JSON.stringify({ ok: false, msg: 'Endpoint not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    // Serve static assets from public directory
    if (env.ASSETS) {
      // Handle SPA routes - serve dashboard.html for /dashboard and sub-routes
      if (path === '/dashboard' || path.startsWith('/dashboard/')) {
        const dashboardUrl = new URL(request.url);
        dashboardUrl.pathname = '/dashboard.html';
        return withSecurityHeaders(await env.ASSETS.fetch(dashboardUrl));
      }
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    return new Response('Asset not found', { status: 404 });
  }
};