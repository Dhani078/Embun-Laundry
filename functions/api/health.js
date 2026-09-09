// functions/api/health.js
// Liveness probe — no DB access, always fast and reliable.
// Used by uptime monitors and the agent baseline check.
import { jsonResponse } from '../_db.js';

export async function onRequestGet() {
  return jsonResponse({
    ok: true,
    status: 'healthy',
    service: 'embun-laundry',
    timestamp: new Date().toISOString()
  });
}

export async function onRequest() {
  return onRequestGet();
}

export async function onRequestOptions() {
  // B5: `Access-Control-Allow-Origin: *` DIHAPUS. Header yang bergantung
  // pada origin dipasang terpusat oleh applyCors() di src/index.js.
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
