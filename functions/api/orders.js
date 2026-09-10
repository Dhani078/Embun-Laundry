// functions/api/orders.js
import { getDb, jsonResponse, getUserFromSession, readJson, corsOptions, SERVER_ERROR } from '../_db.js';
import { validateOr400, cleanStr, STATUS_ORDER } from '../_validate.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  if (request.method === 'OPTIONS') return corsOptions('GET, POST, OPTIONS');

  const user = await getUserFromSession(request, env);

  // B10 — ISOLASI DATA (IDOR).
  // Sebelumnya handler ini sengaja mengizinkan `user === null`: tanpa sesi,
  // `myName` menjadi '' sehingga cabang `!isStaff && myName` TIDAK menambahkan
  // filter `customer_name` — akibatnya `GET /api/orders` TANPA cookie
  // mengembalikan SELURUH pesanan (nama, telepon, alamat, nominal) milik
  // semua pelanggan. Terbukti di produksi: 3 order dari 3 pelanggan berbeda
  // tampil untuk permintawanonim.
  // Tidak ada satu pun halaman yang mengambil /api/orders tanpa sesi
  // (hanya dashboard, setelah /api/me ok), jadi 401 di sini tidak merusak UI.
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  const isStaff = ['Admin', 'Owner', 'Staff'].includes(user.user_role);
  const myName = user.user_name || '';

  // Gagal tertutup (fail-closed): pelanggan yang sesinya tidak memuat nama
  // TIDAK boleh jatuh ke "lihat semua". Sebelumnya kondisi ini justru
  // menjadi jalan pintas menuju seluruh tabel.
  if (!isStaff && !myName) {
    return jsonResponse({ ok: false, msg: 'Sesi tidak lengkap' }, 401);
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  // GET - list orders
  if (request.method === 'GET' && !action) {
    try {
      const view = cleanStr(url.searchParams.get('view') || '').slice(0, 20) || 'table';
      const q = cleanStr(url.searchParams.get('q') || '').slice(0, 100);
      const status = cleanStr(url.searchParams.get('status') || '').slice(0, 20);
      const start = cleanStr(url.searchParams.get('start') || '').slice(0, 10);
      const end = cleanStr(url.searchParams.get('end') || '').slice(0, 10);

      // B2 — tanggal harus benar-benar berformat YYYY-MM-DD. Sebelumnya nilai
      // apa pun digabung mentah ke 'YYYY-MM-DD HH:MM:SS' lalu dikirim ke TiDB.
      // Filter hanya dipakai kalau keduanya ada (sama seperti sebelumnya),
      // tetapi nilai yang DIBERIKAN kini wajib berformat benar.
      for (const [name, val] of [['start', start], ['end', end]]) {
        if (val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
          return jsonResponse({ ok: false, msg: `Validasi gagal: ${name} tanggal tidak valid (YYYY-MM-DD)` }, 400);
        }
      }

      let sql = `
        SELECT o.*, s.name AS service_name
        FROM orders o
        JOIN services s ON s.id = o.service_id
        WHERE 1=1
      `;
      const params = [];

      if (!isStaff && myName) {
        sql += ' AND o.customer_name = ?';
        params.push(myName);
      }
      if (q) {
        sql += ` AND (o.order_code LIKE ? OR o.customer_name LIKE ? OR s.name LIKE ? OR o.customer_phone LIKE ? OR o.customer_address LIKE ?)`;
        const likeQ = `%${q}%`;
        params.push(likeQ, likeQ, likeQ, likeQ, likeQ);
      }
      if (STATUS_ORDER.includes(status)) {
        sql += ' AND o.status = ?';
        params.push(status);
      }
      if (start && end) {
        sql += ' AND o.created_at BETWEEN ? AND ?';
        params.push(start + ' 00:00:00', end + ' 23:59:59');
      }

      sql += ' ORDER BY o.created_at DESC LIMIT 300';

      const orders = await db.query(sql, params);
      return jsonResponse({ ok: true, orders });
    } catch (e) {
      return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
    }
  }

  // POST - handle actions
  if (request.method === 'POST') {
    try {
      const parsed = await readJson(request);
      if (!parsed.ok) return parsed.response;
      const body = parsed.data;
      const act = body.action || action;

      if (act === 'create_order') {
        // B2 — berat 1..1000 kg, harga & diskon non-negatif, teks dibatasi.
        // Sebelumnya `Math.max(1, parseInt(...)||1)` mengizinkan 100000 kg dan
        // `body.customer_*` dikirim apa adanya tanpa batas panjang.
        const v = validateOr400(body, {
          customer_name: { type: 'str', max: 120, label: 'Nama pelanggan' },
          customer_phone: { type: 'str', max: 30, label: 'Telepon pelanggan' },
          customer_address: { type: 'str', max: 500, label: 'Alamat pelanggan' },
          service_id: { type: 'int', required: true, min: 1, label: 'Layanan' },
          weight_kg: { type: 'int', min: 1, max: 1000, default: 1, label: 'Berat (kg)' },
          price_per_kg: { type: 'int', min: 0, max: 10000000, default: 0, label: 'Harga per kg' },
          discount: { type: 'int', min: 0, max: 100000000, default: 0, label: 'Diskon' },
          voucher_code: { type: 'str', max: 40, label: 'Kode voucher' },
          status: { type: 'enum', values: STATUS_ORDER, default: 'baru', label: 'Status' }
        });
        if (!v.ok) return v.response;

        const d = v.data;
        const customer = isStaff ? (d.customer_name || myName) : myName;
        const phone = d.customer_phone;
        const address = d.customer_address;
        const serviceId = d.service_id;
        const kg = d.weight_kg;
        const disc = d.discount;
        let priceKg = d.price_per_kg;
        const voucherCode = d.voucher_code.toUpperCase();
        const status = isStaff ? d.status : 'baru';

        if (!customer || !serviceId) {
          return jsonResponse({ ok: false, msg: 'Data tidak lengkap' }, 400);
        }

        // Get price if not provided
        if (priceKg <= 0) {
          const svc = await db.query('SELECT price FROM services WHERE id = ?', [serviceId]);
          priceKg = svc[0]?.price || 20000;
        }

        const subtotal = kg * priceKg;
        let finalDisc = disc;

        // Validate voucher if provided
        if (voucherCode) {
          // Check user_vouchers first
          const uv = await db.query(
            `SELECT id, promo_id, code, name, type, value, min_spend, max_discount, expires_at, used_at
             FROM user_vouchers WHERE user_id = ? AND code = ? LIMIT 1`,
            [user.id, voucherCode]
          );
          if (uv.length > 0) {
            const v = uv[0];
            if (v.used_at) return jsonResponse({ ok: false, msg: 'Kode sudah digunakan' }, 400);
            if (v.expires_at && new Date(v.expires_at) < new Date()) return jsonResponse({ ok: false, msg: 'Kode kedaluwarsa' }, 400);
            if ((v.min_spend || 0) > 0 && subtotal < v.min_spend) return jsonResponse({ ok: false, msg: 'Belum memenuhi minimum belanja' }, 400);

            if (v.type === 'percent') {
              finalDisc = Math.floor(subtotal * (v.value / 100));
              if (v.max_discount > 0) finalDisc = Math.min(finalDisc, v.max_discount);
            } else {
              finalDisc = v.value;
            }
            finalDisc = Math.max(0, Math.min(finalDisc, subtotal));
          }
        }

        if (finalDisc > subtotal) finalDisc = subtotal;
        const total = subtotal - finalDisc;

        const code = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const finished = status === 'selesai' ? now : null;

        await db.execute(
          `INSERT INTO orders
           (order_code, customer_name, customer_phone, customer_address, service_id, weight_kg, price_per_kg, discount, total_amount, status, created_at, finished_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [code, customer, phone, address, serviceId, kg, priceKg, finalDisc, total, status, now, finished]
        );

        const newOrder = await db.query('SELECT * FROM orders WHERE order_code = ?', [code]);
        
        // Mark voucher as used
        if (voucherCode) {
          await db.execute(
            `UPDATE user_vouchers SET used_at = NOW() WHERE user_id = ? AND code = ? AND used_at IS NULL`,
            [user.id, voucherCode]
          );
          await db.execute(
            `INSERT INTO voucher_claims (user_id, promo_id, voucher_id, source, amount)
             SELECT ?, promo_id, id, 'code', ? FROM user_vouchers WHERE user_id = ? AND code = ?`,
            [user.id, finalDisc, user.id, voucherCode]
          );
        }

        return jsonResponse({ ok: true, order: newOrder[0] });
      }

      if (act === 'move_status' && isStaff) {
        const v = validateOr400(body, {
          id: { type: 'int', required: true, min: 1, label: 'ID' },
          status: { type: 'enum', values: STATUS_ORDER, required: true, label: 'Status' }
        });
        if (!v.ok) return v.response;
        const id = v.data.id;
        const newStatus = v.data.status;
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute(
          `UPDATE orders SET status = ?, finished_at = IF(? = 'selesai', IFNULL(finished_at, ?), finished_at) WHERE id = ?`,
          [newStatus, newStatus, now, id]
        );
        return jsonResponse({ ok: true });
      }

      if (act === 'update_order' && isStaff) {
        const v = validateOr400(body, {
          id: { type: 'int', required: true, min: 1, label: 'ID' },
          customer_name: { type: 'str', required: true, min: 2, max: 120, label: 'Nama pelanggan' },
          customer_phone: { type: 'str', max: 30, label: 'Telepon pelanggan' },
          customer_address: { type: 'str', max: 500, label: 'Alamat pelanggan' },
          service_id: { type: 'int', required: true, min: 1, label: 'Layanan' },
          weight_kg: { type: 'int', min: 1, max: 1000, default: 1, label: 'Berat (kg)' },
          price_per_kg: { type: 'int', min: 0, max: 10000000, default: 0, label: 'Harga per kg' },
          discount: { type: 'int', min: 0, max: 100000000, default: 0, label: 'Diskon' },
          status: { type: 'enum', values: STATUS_ORDER, default: 'baru', label: 'Status' }
        });
        if (!v.ok) return v.response;

        const d = v.data;
        const { id, customer_name: customer, customer_phone: phone, customer_address: address, service_id: serviceId } = d;
        const kg = d.weight_kg;
        const disc = d.discount;
        let priceKg = d.price_per_kg;
        const status = d.status;

        if (priceKg <= 0) {
          const svc = await db.query('SELECT price FROM services WHERE id = ?', [serviceId]);
          priceKg = svc[0]?.price || 20000;
        }

        const total = Math.max(0, kg * priceKg - disc);
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await db.execute(
          `UPDATE orders SET
            customer_name=?, customer_phone=?, customer_address=?, service_id=?, weight_kg=?,
            price_per_kg=?, discount=?, total_amount=?, status=?, finished_at=IF(?='selesai',IFNULL(finished_at,?),finished_at)
            WHERE id=?`,
          [customer, phone, address, serviceId, kg, priceKg, disc, total, status, status, now, id]
        );

        return jsonResponse({ ok: true });
      }

      if (act === 'delete_order') {
        const v = validateOr400(body, { id: { type: 'int', required: true, min: 1, label: 'ID' } });
        if (!v.ok) return v.response;
        const id = v.data.id;

        if (isStaff) {
          await db.execute('DELETE FROM orders WHERE id = ?', [id]);
        } else {
          const order = await db.query('SELECT status, customer_name FROM orders WHERE id = ?', [id]);
          if (order.length > 0 && order[0].status === 'baru' && order[0].customer_name === myName) {
            await db.execute('DELETE FROM orders WHERE id = ?', [id]);
          } else {
            return jsonResponse({ ok: false, msg: 'Tidak diizinkan' }, 403);
          }
        }
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: false, msg: 'Unknown action' }, 400);
    } catch (e) {
      return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
    }
  }

  return jsonResponse({ ok: false, msg: 'Method not allowed' }, 405);
}