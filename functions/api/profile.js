// functions/api/profile.js
import { getDb, jsonResponse, getUserFromSession, hashPassword, readJson, corsOptions } from '../_db.js';
// B8 — verifikasi sandi lama lewat SATU fungsi yang sama dengan login.
// Dulu baris ini cuma `hash === oldPass || sha256(oldPass + salt) === hash`,
// jadi setiap format baru harus disalin ke sini — sumber dua algoritma.
import { verifyPassword } from '../_password.js';
// B13 — validasi & sanitasi. Sebelum tick ini, `update_profile` hanya memeriksa
// `if (!name)`, sehingga: nama 100.000 karakter diteruskan mentah ke TiDB, dan
// `phone` yang bukan string (`(body.phone || '').trim()`) melempar TypeError
// → 500. Modul `_validate.js` sudah ada sejak B2, hanya belum dipakai di sini.
import { validateOr400, COL_SPEC } from '../_validate.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  if (request.method === 'OPTIONS') return corsOptions('GET, POST, OPTIONS');

  const user = await getUserFromSession(request, env);
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  if (request.method === 'GET') {
    try {
      const rows = await db.query('SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = ? LIMIT 1', [user.id]);
      if (rows.length === 0) return jsonResponse({ ok: false, msg: 'User not found' }, 404);
      return jsonResponse({ ok: true, user: rows[0] });
    } catch (e) {
      // B13 — dulu `msg: e.message`. Pesan dari driver DB dapat berisi
      // connection string, nama tabel, dan nomor baris. Kontrak A4: klien
      // cukup tahu bahwa permintaan gagal.
      return jsonResponse({ ok: false, msg: 'Gagal memuat profil' }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      const parsed = await readJson(request);
      if (!parsed.ok) return parsed.response;
      const body = parsed.data;
      const act = body.action || '';

      if (act === 'update_profile') {
        // B13 — batas panjang & pembersihan karakter kontrol. Dulu hanya
        // `if (!name)`, jadi string 100.000 karakter dikirim mentah ke TiDB
        // (kolom VARCHAR(120) → 500 dari DB, bukan 400 dari kita), dan
        // `phone` non-string membuat `.trim()` melempar → 500.
        //
        // B16 — `full_name` 120 -> 100. Terbukti di produksi: 100 char ->
        // 200, **101 char -> 500**. (Komentar di atas menyebut VARCHAR(120)
        // karena itu yang tertulis di skema lama; yang menentukan adalah
        // hasil ukur terhadap TiDB.)
        const v = validateOr400(body, {
          // Label "Nama", bukan "Nama lengkap": di halaman profil kolomnya
          // memang hanya bertuliskan "Nama". (COL_SPEC.userName dipakai
          // register.js, yang formulirnya bertuliskan "Nama lengkap".)
          full_name: { ...COL_SPEC.userName, label: 'Nama' },
          phone: COL_SPEC.userPhone
        });
        if (!v.ok) return v.response;
        const { full_name: name, phone } = v.data;

        await db.execute('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [name, phone, user.id]);
        return jsonResponse({ ok: true, user_name: name, phone });
      }

      if (act === 'change_password') {
        const oldPass = body.old_password || '';
        const newPass = body.new_password || '';
        const repPass = body.repeat_password || '';

        if (!newPass || !repPass) return jsonResponse({ ok: false, msg: 'Sandi baru wajib diisi' }, 400);
        if (newPass !== repPass) return jsonResponse({ ok: false, msg: 'Konfirmasi sandi berbeda' }, 400);

        const rows = await db.query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [user.id]);
        if (rows.length === 0) return jsonResponse({ ok: false, msg: 'User not found' }, 404);

        // B8 — bandingkan lewat verifyPassword(): menerima PBKDF2, bcrypt,
        // plaintext, dan SHA-256 lawas. Catatan: `oldPass` sengaja TIDAK
        // dibatasi panjangnya (kecocokan persis terhadap kolom lawas
        // 'testhash' harus tetap mungkin), jadi jangan ditambah validasi
        // min/max di sini tanpa memikirkan hash lawas.
        if (!await verifyPassword(oldPass, rows[0].password_hash)) {
          return jsonResponse({ ok: false, msg: 'Sandi lama salah' }, 400);
        }

        // Sandi baru WAJIB panjangnya wajar — dulu `newPass` bisa 1 karakter
        // dan langsung ditulis ke DB.
        if (String(newPass).length < 6 || String(newPass).length > 128) {
          return jsonResponse({ ok: false, msg: 'Sandi baru harus 6-128 karakter' }, 400);
        }

        const newHash = await hashPassword(newPass);
        await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
        return jsonResponse({ ok: true, msg: 'Sandi berhasil diganti' });
      }

      return jsonResponse({ ok: false, msg: 'Unknown action' }, 400);
    } catch (e) {
      // B13 — lihat alasan di jalur GET: jangan pernah mengirim `e.message`
      // ke klien. Detailnya cukup di log server.
      return jsonResponse({ ok: false, msg: 'Gagal menyimpan profil' }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}