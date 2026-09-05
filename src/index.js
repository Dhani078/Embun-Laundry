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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route API requests
    if (path.startsWith('/api/')) {
      const context = { request, env, ctx, params: {} };

      if (path === '/api/auth/login') {
        if (request.method === 'POST') return loginHandler.onRequestPost(context);
        if (request.method === 'OPTIONS') return loginHandler.onRequestOptions(context);
      }
      if (path === '/api/auth/register') {
        if (request.method === 'POST') return registerHandler.onRequestPost(context);
        if (request.method === 'OPTIONS') return registerHandler.onRequestOptions(context);
      }
      if (path === '/api/auth/logout') {
        if (request.method === 'POST') return logoutHandler.onRequestPost(context);
        if (request.method === 'OPTIONS') return logoutHandler.onRequestOptions(context);
      }
      if (path === '/api/me') {
        return meHandler.onRequestGet(context);
      }
      if (path === '/api/dashboard') {
        return dashboardHandler.onRequestGet(context);
      }
      if (path === '/api/orders') {
        return ordersHandler.onRequest(context);
      }
      if (path === '/api/customers') {
        return customersHandler.onRequest(context);
      }
      if (path === '/api/services') {
        return servicesHandler.onRequest(context);
      }
      if (path === '/api/delivery') {
        return deliveryHandler.onRequest(context);
      }
      if (path === '/api/promos') {
        return promosHandler.onRequest(context);
      }
      if (path === '/api/vouchers') {
        return vouchersHandler.onRequest(context);
      }
      if (path === '/api/reports') {
        return reportsHandler.onRequestGet(context);
      }
      if (path === '/api/profile') {
        return profileHandler.onRequest(context);
      }
      if (path === '/api/checkin') {
        return checkinHandler.onRequest(context);
      }
      if (path === '/api/pay') {
        return payHandler.onRequest(context);
      }

      return new Response(JSON.stringify({ ok: false, msg: 'Endpoint not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Serve static assets from public directory
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Asset not found', { status: 404 });
  }
};
