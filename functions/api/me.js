// functions/api/me.js
import { getUserFromSession, jsonResponse, corsOptions } from '../_db.js';

export async function onRequestGet({ request, env }) {
  if (request.method === 'OPTIONS') return corsOptions('GET, OPTIONS');

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return jsonResponse({ ok: false, user: null }, 401);
    }
    return jsonResponse({ ok: true, user });
  } catch (e) {
    // Jangan bocorkan detail internal — cukup flag gagal.
    return jsonResponse({ ok: false, user: null, msg: 'Gagal memuat sesi' }, 500);
  }
}

// Preflight CORS (A4) — tanpa ini browser menerima 401 alih-alih 204.
export async function onRequestOptions() {
  return corsOptions('GET, OPTIONS');
}
