// functions/api/delivery.js
import { getDb, jsonResponse, getUserFromSession, readJson, corsOptions, SERVER_ERROR } from '../_db.js';
import { validateOr400, cleanStr } from '../_validate.js';
import { todayIn } from '../_today.js';

export async function onRequest({ request, env }) {
  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  if (request.method === 'OPTIONS') return corsOptions('GET, POST, OPTIONS');

  const user = await getUserFromSession(request, env);

  // B10 — ISOLASI DATA (IDOR). Tugas pickup/delivery memuat nama, telepon,
  // dan ALAMAT lengkap pelanggan. Tanpa sesi `myName` kosong, sehingga
  // filter `customer_name` tidak pernah terpasang dan seluruh tugas (termasuk
  // alamat rumah) terbuka untuk siapa pun. Fail-closed.
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  const isStaff = ['Admin', 'Owner', 'Staff'].includes(user.user_role);
  const myName = user.user_name || '';

  if (!isStaff && !myName) {
    return jsonResponse({ ok: false, msg: 'Sesi tidak lengkap' }, 401);
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  if (request.method === 'GET' && !action) {
    try {
      // B15 — parameter GET dibersihkan dan dibatasi seperti modul lain
      // (orders, services, promos, customers sudah lebih dulu begini).
      // Sebelumnya `q`, `status`, dan `date` dikirim mentah ke SQL — aman
      // dari injeksi (B7, placeholder `?`) tetapi tidak dari nilai ngawur:
      // `?status=DIJALANKAN` atau `?date=besok-saja` hanya menghasilkan
      // daftar kosong yang tampak seperti "tidak ada tugas", tanpa pernah
      // memberi tahu klien bahwa filternya salah.
      const q = cleanStr(url.searchParams.get('q') || '').slice(0, 100);
      const type = cleanStr(url.searchParams.get('type') || '').slice(0, 20);
      const status = cleanStr(url.searchParams.get('status') || '').slice(0, 20);
      const date = cleanStr(url.searchParams.get('date') || '').slice(0, 10);

      const STATUSES = ['scheduled', 'assigned', 'onroute', 'completed', 'cancelled'];
      if (status && !STATUSES.includes(status)) {
        return jsonResponse({ ok: false, msg: `Validasi gagal: Status tidak valid` }, 400);
      }
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return jsonResponse({ ok: false, msg: 'Validasi gagal: date tidak valid (YYYY-MM-DD)' }, 400);
      }

      let sql = `
        SELECT pd.*, c.full_name as courier_name, c.phone as courier_phone, c.vehicle as courier_vehicle
        FROM pickup_delivery pd
        LEFT JOIN couriers c ON c.id = pd.courier_id
        WHERE 1=1
      `;
      const params = [];

      if (!isStaff && myName) {
        sql += ' AND pd.customer_name = ?';
        params.push(myName);
      }
      if (q) {
        sql += ' AND (pd.task_code LIKE ? OR pd.customer_name LIKE ? OR pd.phone LIKE ? OR pd.address LIKE ?)';
        const likeQ = `%${q}%`;
        params.push(likeQ, likeQ, likeQ, likeQ);
      }
      if (['pickup', 'delivery'].includes(type)) {
        sql += ' AND pd.type = ?';
        params.push(type);
      }
      if (status) {
        sql += ' AND pd.status = ?';
        params.push(status);
      }
      if (date) {
        sql += ' AND pd.schedule_date = ?';
        params.push(date);
      }

      sql += ' ORDER BY pd.schedule_date DESC, pd.id DESC LIMIT 300';
      const tasks = await db.query(sql, params);

      // Also return couriers list for staff
      let couriers = [];
      if (isStaff) {
        couriers = await db.query('SELECT * FROM couriers WHERE is_active = 1 ORDER BY full_name ASC');
      }

      return jsonResponse({ ok: true, tasks, couriers });
    } catch (e) {
      return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      const parsed = await readJson(request);
      if (!parsed.ok) return parsed.response;
      const body = parsed.data;
      const act = body.action || action;

      if (act === 'create_task') {
        // B15 — SELURUH field kini lewat `validateOr400()`.
        //
        // Sebelumnya hanya `type` yang diperiksa (dan itu pun tanpa batas
        // panjang). Diukur dengan `tools/verify_b15_run.mjs` pada kode lama:
        //   - `customer_name` 5.000 karakter  -> 200, teks raksasa masuk ke
        //     kolom VARCHAR(80) -> 500 dari TiDB, bukan 400 dari kita.
        //   - `phone` objek `{n:1}`           -> 200, `[object Object]`
        //     tersimpan di kolom VARCHAR(30).
        //   - `address` array `['a','b']`     -> 200, `"a,b"` (koersi JS)
        //     tersimpan di kolom TEXT alamat.
        //   - `order_code` 9.000 karakter     -> 200, melampaui VARCHAR(40).
        //   - `notes` 20.000 karakter         -> 200.
        //   - `schedule_date: 'besok-saja'`   -> 200, kolom DATE menerima
        //     sampah atau gagal di DB.
        //   - `start_time: 'pagi sekali'`     -> 200, kolom TIME idem.
        // Semuanya kini 400, dengan panjang mengikuti skema
        // `DATABASE_SCHEMA.md` (bukan menebak).
        const v = validateOr400(body, {
          type: { type: 'enum', values: ['pickup', 'delivery'], required: true, label: 'Tipe' },
          customer_name: { type: 'str', max: 80, label: 'Nama pelanggan' },
          phone: { type: 'str', max: 30, label: 'Telepon' },
          address: { type: 'str', max: 2000, label: 'Alamat' },
          order_code: { type: 'str', max: 40, label: 'Kode pesanan' },
          courier_id: { type: 'int', min: 1, label: 'Kurir' },
          schedule_date: { type: 'date', label: 'Tanggal jadwal' },
          start_time: { type: 'time', label: 'Jam mulai' },
          end_time: { type: 'time', label: 'Jam selesai' },
          notes: { type: 'str', max: 2000, label: 'Catatan' }
        });
        if (!v.ok) return v.response;

        const d = v.data;

        // B15 — jadwal bawaan kini hari Asia/Jakarta (`_today.js`), bukan UTC.
        // `schedule_date` adalah DATE NOT NULL: bila klien tidak mengirim
        // tanggal, tugas ini dianggap dijadwalkan hari ini menurut jam
        // operasional. Dulu `toISOString().split('T')[0]` membuat jadwal
        // antara 00:00–06:59 WIB tercatat sebagai hari KEMARIN, sehingga
        // tugas hari ini langsung tampil sebagai "lewat jadwal" di daftar
        // yang diurutkan menurut tanggal.
        const defaultDate = todayIn();

        const customer = isStaff ? (d.customer_name || myName) : myName;
        const phone = d.phone;
        const address = d.address;
        const orderCode = d.order_code || null;
        const courierId = isStaff && d.courier_id ? d.courier_id : null;
        const scheduleDate = d.schedule_date || defaultDate;
        const startTime = d.start_time || '09:00:00';
        const endTime = d.end_time || '17:00:00';
        const notes = d.notes;
        const status = courierId ? 'assigned' : 'scheduled';

        if (!customer || !address) return jsonResponse({ ok: false, msg: 'Nama dan alamat wajib diisi' }, 400);

        const prefix = d.type === 'pickup' ? 'PU-' : 'DL-';
        const taskCode = prefix + Date.now().toString(36).toUpperCase().slice(-5);
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await db.execute(
          `INSERT INTO pickup_delivery
           (task_code, type, order_code, customer_name, phone, address, status, courier_id, schedule_date, start_time, end_time, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [taskCode, d.type, orderCode, customer, phone, address, status, courierId, scheduleDate, startTime, endTime, notes, now, now]
        );

        const newTask = await db.query('SELECT * FROM pickup_delivery WHERE task_code = ?', [taskCode]);
        return jsonResponse({ ok: true, task: newTask[0] });
      }

      if (act === 'update_status') {
        if (!isStaff) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);
        // B15 — `parseInt(body.id) || 0` pada ARRAY `[5, 9]` bernilai 5:
        // elemen PERTAMA dipakai, sisanya dibuang, dan tidak ada keluhan.
        // `parseInt(-3) || 0` = -3, sehingga id negatif juga lolos.
        const v = validateOr400(body, {
          id: { type: 'int', required: true, min: 1, label: 'ID' },
          status: {
            type: 'enum', required: true,
            values: ['scheduled', 'assigned', 'onroute', 'completed', 'cancelled'],
            label: 'Status'
          }
        });
        if (!v.ok) return v.response;
        await db.execute(
          'UPDATE pickup_delivery SET status = ?, updated_at = NOW() WHERE id = ?',
          [v.data.status, v.data.id]
        );
        return jsonResponse({ ok: true });
      }

      if (act === 'assign_courier') {
        if (!isStaff) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);
        // B15 — `courier_id: -7` dulu diterima mentah (bukan id yang sah di
        // tabel `couriers`) dan `id: [3]` ikut lolos lewat `parseInt`.
        const v = validateOr400(body, {
          id: { type: 'int', required: true, min: 1, label: 'ID' },
          courier_id: { type: 'int', min: 1, label: 'Kurir' }
        });
        if (!v.ok) return v.response;

        const status = v.data.courier_id ? 'assigned' : 'scheduled';
        await db.execute(
          'UPDATE pickup_delivery SET courier_id = ?, status = ?, updated_at = NOW() WHERE id = ?',
          [v.data.courier_id || null, status, v.data.id]
        );
        return jsonResponse({ ok: true });
      }

      if (act === 'delete_task') {
        const v = validateOr400(body, {
          id: { type: 'int', required: true, min: 1, label: 'ID' }
        });
        if (!v.ok) return v.response;
        const id = v.data.id;

        if (isStaff) {
          await db.execute('DELETE FROM pickup_delivery WHERE id = ?', [id]);
        } else {
          const t = await db.query('SELECT status, customer_name FROM pickup_delivery WHERE id = ?', [id]);
          if (t.length > 0 && t[0].status === 'scheduled' && t[0].customer_name === myName) {
            await db.execute('DELETE FROM pickup_delivery WHERE id = ?', [id]);
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