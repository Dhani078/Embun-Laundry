// functions/api/auth/logout.js
import { jsonResponse } from '../../_db.js';

export async function onRequestPost({ request, env }) {
  const headers = new Headers();
  headers.set('Set-Cookie', 'session_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...Object.fromEntries(headers.entries())
    }
  });
}

export async function onRequestOptions() {
  // B5: `Access-Control-Allow-Origin: *` DIHAPUS. Header yang bergantung
  // pada origin dipasang terpusat oleh applyCors() di src/index.js.
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}