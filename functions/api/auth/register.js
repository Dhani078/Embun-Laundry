// functions/api/auth/register.js
import { getDb, hashPassword, jsonResponse, createSessionToken, readJson, SERVER_ERROR } from '../../_db.js';
import { validateOr400, COL_SPEC } from '../../_validate.js';

export async function onRequestPost({ request, env }) {
  const db = await getDb(env);
  if (!db) {
    return jsonResponse({ ok: false, msg: 'Database tidak terhubung' }, 500);
  }

  try {
    const parsed = await readJson(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // B2 — validasi & sanitasi. Sebelumnya hanya `!full_name || !email ||
    // !password` dengan regex email longgar; nama/telepon tak dibatasi
    // panjangnya dan kata sandi tak punya batas minimal sama sekali.
    //
    // B16 — `full_name` 120 -> 100 (VARCHAR(100) di TiDB; nama 101 char
    // berujung 500 saat INSERT). `phone` 30 -> 32 (VARCHAR(32)).
    const v = validateOr400(body, {
      full_name: COL_SPEC.userName,
      email: { type: 'email', required: true, label: 'Email' },
      phone: COL_SPEC.userPhone,
      // 'raw': sandi TIDAK dibersihkan — hanya panjangnya yang dibatasi.
      password: { type: 'raw', required: true, min: 6, max: 128, label: 'Kata sandi' },
      confirm: { type: 'raw', max: 128, label: 'Konfirmasi sandi' }
    });
    if (!v.ok) return v.response;

    const { full_name, email, phone, password, confirm } = v.data;

    if (confirm !== password) {
      return jsonResponse({ ok: false, msg: 'Konfirmasi sandi tidak sama' }, 400);
    }

    if (body.agree === false) {
      return jsonResponse({ ok: false, msg: 'Anda harus menyetujui Syarat & Ketentuan' }, 400);
    }

    // Check if email already exists
    const existing = await db.query(
      `SELECT id FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (existing.length > 0) {
      return jsonResponse({ ok: false, msg: 'Email sudah terdaftar. Silakan gunakan email lain atau masuk.' }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert new user (always Customer role)
    await db.execute(
      `INSERT INTO users (full_name, email, phone, role, password_hash, created_at)
       VALUES (?, ?, ?, 'Customer', ?, NOW())`,
      [full_name, email, phone || '', passwordHash]
    );

    // Fetch newly created user
    const newlyCreated = await db.query(
      `SELECT id, full_name, email, role FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (newlyCreated.length === 0) {
      return jsonResponse({ ok: false, msg: 'Registrasi gagal dibuat' }, 500);
    }

    const user = newlyCreated[0];
    const userId = user.id;

    // Create customer record if customers table exists
    try {
      const custCode = 'CUST-' + Math.floor(1000 + Math.random() * 9000);
      await db.execute(
        `INSERT INTO customers (code, full_name, phone, address, tag, created_at, updated_at)
         VALUES (?, ?, ?, '', 'Baru', NOW(), NOW())`,
        [custCode, full_name, phone || '']
      );
    } catch (e) {
      // Ignore if customer entry fails
    }

    // Create session token
    const token = await createSessionToken(user, env);

    const headers = new Headers();
    headers.set('Set-Cookie', `session_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`);

    return new Response(JSON.stringify({
      ok: true,
      msg: 'Registrasi berhasil!',
      user: { id: userId, user_name: full_name, user_role: 'Customer', email }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...Object.fromEntries(headers.entries())
      }
    });

  } catch (e) {
    return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
  }
}

export async function onRequestOptions() {
  // B5: `Access-Control-Allow-Origin: *` DIHAPUS. Header yang bergantung
  // pada origin dipasang terpusat oleh applyCors() di src/index.js.
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
