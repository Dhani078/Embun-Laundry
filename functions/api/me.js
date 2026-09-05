// functions/api/me.js
import { getUserFromSession, jsonResponse } from '../_db.js';

export async function onRequestGet({ request, env }) {
  const user = await getUserFromSession(request, env);
  if (!user) {
    return jsonResponse({ ok: false, user: null }, 401);
  }
  return jsonResponse({ ok: true, user });
}