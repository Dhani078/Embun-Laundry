// functions/api/auth/logout.js
import { getDb, getUserFromSession } from '../../_db.js';

export async function onRequestPost({ request, env }) {
  // K7 — pencabutan sesi: selain menghapus cookie di browser klien,
  // naikkan session_version di DB agar token lama yang mungkin disalin/dicuri
  // tidak dapat lagi dipakai di perangkat manapun.
  try {
    const user = await getUserFromSession(request, env);
    if (user) {
      const userId = user.id || user.user_id;
      const db = await getDb(env);
      if (db && userId) {
        await db.execute('UPDATE users SET session_version = session_version + 1 WHERE id = ?', [userId]);
      }
    }
  } catch (e) {
    // Gagal kontak DB tidak boleh menggagalkan pembersihan cookie pada klien
  }

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