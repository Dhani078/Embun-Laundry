// functions/api/reports.js
import { getDb, jsonResponse, getUserFromSession, corsOptions, SERVER_ERROR } from '../_db.js';
// B11 — rentang tanggal divalidasi oleh satu penjaga (functions/_reportfilter.js).
import { dateRange } from '../_reportfilter.js';

// B7 — Peta ekspresi GROUP BY yang DIIZINKAN.
//
// Nilai `?group=` dari user TIDAK pernah disisipkan mentah ke SQL: ia hanya
// dipakai sebagai kunci pencarian di peta ini. Menambah cara pengelompokan
// = menambah entri di sini, bukan menyambung string.
const GROUP_EXPR = Object.freeze({
  hari: 'DATE(created_at)',
  minggu: "CONCAT(YEAR(created_at), '-W', LPAD(WEEK(created_at, 3), 2, '0'))",
  bulan: "DATE_FORMAT(created_at, '%Y-%m')"
});

export async function onRequestGet({ request, env }) {
  if (request.method === 'OPTIONS') return corsOptions('GET, OPTIONS');

  const db = await getDb(env);
  if (!db) return jsonResponse({ ok: false, msg: 'Database not configured' }, 500);

  const user = await getUserFromSession(request, env);
  if (!user) return jsonResponse({ ok: false, msg: 'Unauthorized' }, 401);

  const isStaff = ['Admin', 'Owner', 'Staff'].includes(user.user_role);

  // B11 — ISOLASI DATA LAPORAN (P0).
  //
  // Laporan adalah agregat SELURUH bisnis: omzet, piutang, rata-rata berat,
  // urutan hari teramai. Sebelumnya endpoint ini BISA dipanggil akun Customer
  // dan dijawab 200 — bedanya hanya WHERE tambahan `customer_name = ?`.
  // Itu bukan kebocoran baris orang lain (setiap query sudah disaring), jadi
  // jangan diklaim sebagai IDOR: ini HARDENING hak paling rendah. Alasannya
  // nyata: tidak ada satu pun halaman pelanggan yang memanggil /api/reports
  // (menu Laporan hanya dirender untuk staf — lihat `isStaff` di app.js),
  // jadi kemampuan itu murni sisa yang tak terpakai. Menutupnya menghemat
  // tiga query agregat per permintaan dan menghapus satu permukaan yang
  // tak perlu diuji setiap kali skema laporan berubah.
  //
  // Peringatan untuk tick berikutnya: kalau suatu saat pelanggan MEMANG
  // perlu "riwayat + total belanjaku" (backlog C6), itu endpoint baru dengan
  // agregat per pelanggan — BUKAN membuka kembali /api/reports.
  //
  // Menu Laporan hanya dirender untuk staf (`isStaff` di public/app.js), jadi
  // 403 di sini tidak merusak satu pun antarmuka. Fail-closed: bukan staf =
  // tidak ada angka, dan TIDAK ada query agregat yang sia-sia dijalankan.
  if (!isStaff) {
    return jsonResponse({
      ok: false,
      msg: 'Laporan hanya tersedia untuk Admin, Owner, dan Staff'
    }, 403);
  }

  const url = new URL(request.url);
  const group = url.searchParams.get('group') || 'bulan';

  // B11 — SATU penjaga untuk `?start=`/`?end=`.
  //
  // Dulu kedua nilai ini diambil mentah lalu DISAMBUNG ke string
  // `' 00:00:00'` / `' 23:59:59'` sebelum masuk ke `BETWEEN ? AND ?`.
  // Placeholder memang mencegah injeksi (B7), tetapi bukan mencegah nilai
  // ngawur: rentang terbalik, tanggal yang tidak pernah ada, atau rentang
  // 10.000 tahun yang menyapu seluruh tabel dalam satu permintaan.
  // Sekarang: format salah -> 400, terbalik -> 400, >3660 hari -> 400.
  const range = dateRange(url.searchParams);
  if (!range.ok) return jsonResponse({ ok: false, msg: `Validasi gagal: ${range.msg}` }, 400);

  try {
    // Staf melihat seluruh toko, jadi tidak ada filter per pelanggan.
    // Baris ini sengaja dibiarkan ada supaya pembaca tahu data TIDAK
    // dipersempit untuk staf (kebalikan dari orders.js, yang justru wajib
    // menambahkan `customer_name = ?` untuk pelanggan).
    const dateCond = range.cond;
    const dateParams = range.params;

    // KPI: Rev, Orders, Avg Weight
    const kpiSql = `
      SELECT COALESCE(SUM(total_amount), 0) as rev, COUNT(*) as ord, ROUND(AVG(weight_kg), 1) as avg_wt
      FROM orders
      WHERE (status IS NULL OR status<>'batal') ${dateCond}
    `;
    const kpiRes = await db.query(kpiSql, dateParams);

    // Chart grouping — kunci asing jatuh kembali ke 'bulan', tidak pernah
    // dipakai untuk menyusun SQL.
    const groupExpr = GROUP_EXPR[group] || GROUP_EXPR.bulan;

    const chartSql = `
      SELECT ${groupExpr} as g,
             COALESCE(SUM(paid_amount), 0) as paid,
             COALESCE(SUM(GREATEST(total_amount - paid_amount, 0)), 0) as unpaid
      FROM orders
      WHERE (status IS NULL OR status<>'batal') ${dateCond}
      GROUP BY ${groupExpr}
      ORDER BY g ASC
    `;
    const chartRows = await db.query(chartSql, dateParams);

    // Daily breakdown table
    const dailySql = `
      SELECT DATE(created_at) as d,
             COUNT(*) as orders,
             COALESCE(SUM(total_amount), 0) as revenue,
             COALESCE(SUM(weight_kg), 0) as weight
      FROM orders
      WHERE (status IS NULL OR status<>'batal') ${dateCond}
      GROUP BY DATE(created_at)
      ORDER BY d DESC
      LIMIT 60
    `;
    const dailyRows = await db.query(dailySql, dateParams);

    return jsonResponse({
      ok: true,
      kpi: kpiRes[0] || { rev: 0, ord: 0, avg_wt: 0 },
      chart: chartRows,
      daily: dailyRows
    });
  } catch (e) {
    return jsonResponse({ ok: false, msg: SERVER_ERROR }, 500);
  }
}