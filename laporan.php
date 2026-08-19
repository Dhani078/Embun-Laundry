<?php
require_once __DIR__ . '/config.php';
require_login();

/* =========================
   RBAC
   ========================= */
$role       = $_SESSION['user_role'] ?? 'Customer';
$isStaff    = in_array($role, ['Admin','Owner','Staff'], true);
$isCustomer = !$isStaff;
$myName     = trim($_SESSION['user_name'] ?? '');

/* =========================
   Helpers
   ========================= */
if (!function_exists('h')) {
  function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
}
if (!function_exists('rupiah')) {
  function rupiah($n){ return 'Rp '.number_format((int)$n,0,',','.'); }
}
if (!function_exists('avatar_url_dash')) {
  function avatar_url_dash($uid){
    $base = 'uploads/avatars';
    foreach (['jpg','jpeg','png','webp'] as $ext){
      $p = __DIR__ . "/$base/$uid.$ext";
      if (is_file($p)) return "$base/$uid.$ext?v=".filemtime($p);
    }
    return 'img/avatar-placeholder.png';
  }
}
$AVATAR = avatar_url_dash((int)($_SESSION['user_id'] ?? 0));

function qstring(array $extra = []) {
  $keep = ['tab','group','start','end'];
  $curr = array_intersect_key($_GET, array_flip($keep));
  return http_build_query(array_merge($curr, $extra));
}
function pct_change($now, $prev){
  $now = (float)$now; $prev = (float)$prev;
  if ($prev == 0.0) return $now>0 ? 100 : 0;
  return round((($now - $prev) / $prev) * 100, 1);
}

/* =========================
   Input filter (tanggal & tab)
   ========================= */
$tab   = $_GET['tab']   ?? 'pendapatan';              // pendapatan | pesanan | layanan | perbandingan
$group = $_GET['group'] ?? 'bulan';                   // hari | minggu | bulan
$startS = $_GET['start'] ?? '';
$endS   = $_GET['end']   ?? '';

$start = $end = null;
if ($startS!=='' && $endS!=='') {
  $start = DateTime::createFromFormat('Y-m-d',$startS);
  $end   = DateTime::createFromFormat('Y-m-d',$endS);
}
if (!$start || !$end) {
  // default: periode Tahun berjalan
  $start = new DateTime(date('Y-01-01'));
  $end   = new DateTime(date('Y-12-31'));
}
$start->setTime(0,0,0);
$end->setTime(23,59,59);

// periode sebelumnya (untuk growth)
$diffDays     = (int)$start->diff($end)->format('%a') + 1;
$prevStart    = (clone $start)->modify("-{$diffDays} days");
$prevEnd      = (clone $start)->modify('-1 day');

// string tanggal
$startStr     = $start->format('Y-m-d H:i:s');
$endStr       = $end->format('Y-m-d H:i:s');
$prevStartStr = $prevStart->format('Y-m-d H:i:s');
$prevEndStr   = $prevEnd->format('Y-m-d H:i:s');

/* =========================
   Kolom jumlah bayar & filter customer
   ========================= */
$hasPaidCol = $mysqli->query("SHOW COLUMNS FROM orders LIKE 'paid_amount'")->num_rows > 0;

/*
 * paidExpr   : nilai yang SUDAH dibayar
 * unpaidExpr : sisa tagihan (total - paid), minimal 0
 * amtExpr    : ekspresi default untuk laporan satu-metrik (kompatibel lama)
 */
if ($hasPaidCol) {
  $paidExpr    = "IFNULL(paid_amount,0)";
  $unpaidExpr  = "GREATEST(total_amount - IFNULL(paid_amount,0), 0)";
  $amtExpr     = "CASE WHEN paid_amount IS NULL OR paid_amount=0 THEN total_amount ELSE paid_amount END";
  $amtExprO    = "CASE WHEN o.paid_amount IS NULL OR o.paid_amount=0 THEN o.total_amount ELSE o.paid_amount END"; // versi alias o.
} else {
  $paidExpr    = "total_amount";
  $unpaidExpr  = "0";
  $amtExpr     = "total_amount";
  $amtExprO    = "o.total_amount";
}

$customerFilter = ($isCustomer && $myName!=='') ? " AND customer_name = ?" : "";

// Helper bind tanggal (+ nama customer bila perlu)
$bindDates = function(mysqli_stmt $st, string $a, string $b) use ($isCustomer, $myName){
  if ($isCustomer && $myName!=='') {
    $n = $myName;
    $st->bind_param('sss', $a, $b, $n);
  } else {
    $st->bind_param('ss', $a, $b);
  }
};

/* =========================
   KPI
   ========================= */
$revNow=0; $ordNow=0; $avgWeight=0;
$st=$mysqli->prepare("
  SELECT COALESCE(SUM($amtExpr),0), COUNT(*), ROUND(AVG(weight_kg),1)
  FROM orders
  WHERE created_at BETWEEN ? AND ? AND (status IS NULL OR status<>'batal') $customerFilter
");
$bindDates($st, $startStr, $endStr);
$st->execute(); $st->bind_result($revNow,$ordNow,$avgWeight); $st->fetch(); $st->close();

$revPrev=0;
$st=$mysqli->prepare("
  SELECT COALESCE(SUM($amtExpr),0)
  FROM orders
  WHERE created_at BETWEEN ? AND ? AND (status IS NULL OR status<>'batal') $customerFilter
");
$bindDates($st, $prevStartStr, $prevEndStr);
$st->execute(); $st->bind_result($revPrev); $st->fetch(); $st->close();

$hasExpenses = $isStaff && $mysqli->query("SHOW TABLES LIKE 'expenses'")->num_rows>0;
$expNow = 0;
if ($hasExpenses){
  $st=$mysqli->prepare("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE created_at BETWEEN ? AND ?");
  $st->bind_param('ss',$startStr,$endStr);
  $st->execute(); $st->bind_result($expNow); $st->fetch(); $st->close();
}
$profit = max(0, $revNow - $expNow);
$margin = $revNow>0 ? round($profit/$revNow*100,1) : 0.0;

/* =========================
   Grafik pendapatan (2 seri: Lunas & Belum Lunas)
   ========================= */
$grp = ($group==='hari'?'hari':($group==='minggu'?'minggu':'bulan'));
$sqlBase = "FROM orders WHERE created_at BETWEEN ? AND ? AND (status IS NULL OR status<>'batal') $customerFilter";

if ($grp==='hari') {
  $sql="SELECT DATE(created_at) g,
              COALESCE(SUM($paidExpr),0)   paid,
              COALESCE(SUM($unpaidExpr),0) unpaid
       $sqlBase
       GROUP BY DATE(created_at) ORDER BY g";
} elseif ($grp==='minggu') {
  $sql="SELECT CONCAT(YEAR(created_at),'-W',LPAD(WEEK(created_at,3),2,'0')) g,
              COALESCE(SUM($paidExpr),0)   paid,
              COALESCE(SUM($unpaidExpr),0) unpaid
       $sqlBase
       GROUP BY YEARWEEK(created_at,3) ORDER BY YEARWEEK(created_at,3)";
} else {
  $sql="SELECT DATE_FORMAT(created_at,'%Y-%m') g,
              COALESCE(SUM($paidExpr),0)   paid,
              COALESCE(SUM($unpaidExpr),0) unpaid
       $sqlBase
       GROUP BY DATE_FORMAT(created_at,'%Y-%m') ORDER BY DATE_FORMAT(created_at,'%Y-%m')";
}
$st=$mysqli->prepare($sql);
$bindDates($st, $startStr, $endStr);
$st->execute(); $res=$st->get_result();
$labels=[]; $seriesPaid=[]; $seriesUnpaid=[];
while($r=$res->fetch_assoc()){
  $labels[]       = $r['g'];
  $seriesPaid[]   = (int)$r['paid'];
  $seriesUnpaid[] = (int)$r['unpaid'];
}
$st->close();

/* =========================
   Tabel harian
   ========================= */
$daily=[];
$st=$mysqli->prepare("
  SELECT DATE(created_at) d,
         COUNT(*) orders,
         COALESCE(SUM($amtExpr),0) revenue,
         COALESCE(SUM(weight_kg),0) weight
  FROM orders
  WHERE created_at BETWEEN ? AND ? AND (status IS NULL OR status<>'batal') $customerFilter
  GROUP BY DATE(created_at) ORDER BY d
");
$bindDates($st, $startStr, $endStr);
$st->execute(); $res=$st->get_result();
while($r=$res->fetch_assoc()){
  $r['avg_per_order'] = $r['orders']>0 ? round($r['revenue']/$r['orders']) : 0;
  $daily[]=$r;
}
$st->close();

/* =========================
   Performa layanan (staff only)
   ========================= */
$byService=[];
if ($isStaff && $mysqli->query("SHOW TABLES LIKE 'services'")->num_rows){
  $st=$mysqli->prepare("
    SELECT s.name, COUNT(*) cnt, COALESCE(SUM($amtExprO),0) revenue
    FROM orders o JOIN services s ON s.id=o.service_id
    WHERE o.created_at BETWEEN ? AND ? AND (o.status IS NULL OR o.status<>'batal') $customerFilter
    GROUP BY s.id ORDER BY revenue DESC
  ");
  $bindDates($st, $startStr, $endStr);
  $st->execute(); $res=$st->get_result(); 
  while($r=$res->fetch_assoc()) $byService[]=$r; 
  $st->close();
}

/* =========================
   Top pelanggan (staff only)
   ========================= */
$topCust=[];
if ($isStaff){
  $st=$mysqli->prepare("
    SELECT customer_name, COUNT(*) cnt, COALESCE(SUM($amtExpr),0) revenue
    FROM orders
    WHERE created_at BETWEEN ? AND ? AND (status IS NULL OR status<>'batal')
    GROUP BY customer_name ORDER BY revenue DESC LIMIT 10
  ");
  $st->bind_param('ss',$startStr,$endStr);
  $st->execute(); $res=$st->get_result();
  while($r=$res->fetch_assoc()) $topCust[]=$r;
  $st->close();
}
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Embun Laundry · Laporan</title>
<link rel="stylesheet" href="assets/style.css"/>
</head>
<body>
<div class="wrap">
  <aside class="sidebar">
    <div class="brand">
      <img src="img/Logo.png" alt="Embun Laundry" class="logo-img" width="36" height="36" decoding="async" fetchpriority="high"/>
      <div class="name">Embun Laundry</div>
    </div>
    <nav class="nav">
      <a href="<?= base_url('dashboard.php')?>"><span>🏠</span><span>Dashboard</span></a>
      <a href="<?= base_url('pesanan.php')?>"><span>🧺</span><span>Pesanan</span></a>
      <a href="pelanggan.php"><span>👥</span><span>Pelanggan</span></a>
      <a href="layanan.php"><span>💲</span><span>Layanan & Harga</span></a>
      <a href="delivery.php"><span>🚚</span><span>Pickup & Delivery</span></a>
      <a class="active" href="<?= base_url('laporan.php')?>"><span>📑</span><span>Laporan</span></a>
      <a href="promo.php"><span>🎟️</span><span>Promo & Diskon</span></a>
    </nav>

    <!-- KIRI BAWAH: sama seperti pesanan.php -->
    <div class="side-bottom">
      <a href="profile.php"><span>👤</span> <span>Profil</span></a>
      <a href="settings.php"><span>⚙️</span> <span>Pengaturan</span></a>
      <a href="<?= base_url('auth/logout.php')?>"><span>🚪</span> <span>Keluar</span></a>
    </div>
  </aside>

  <section class="main">
    <div class="topbar">
      <div class="topbar-inner">
        <div class="search">🔎
          <form method="get" style="display:flex;gap:10px;align-items:center;width:100%">
            <input type="hidden" name="tab" value="<?= h($tab) ?>">
            <select name="group" class="btn">
              <option value="bulan"  <?= $grp==='bulan'?'selected':'' ?>>Bulanan</option>
              <option value="minggu" <?= $grp==='minggu'?'selected':'' ?>>Mingguan</option>
              <option value="hari"   <?= $grp==='hari'?'selected':'' ?>>Harian</option>
            </select>
            <input type="date" name="start" value="<?= h($start->format('Y-m-d')) ?>" class="btn" style="padding:.45rem .7rem">
            <input type="date" name="end"   value="<?= h($end->format('Y-m-d'))   ?>" class="btn" style="padding:.45rem .7rem">
            <button class="btn">Filter</button>
          </form>
        </div>
        <div class="controls">
          <button class="btn-ghost btn" id="btnCSV">⬇️ Export CSV</button>
          <button class="btn btn-primary" id="btnPDF">🖨️ Export PDF</button>
        </div>
        <!-- User area -->
        <div class="user" id="userArea">
          <img src="<?= h($AVATAR) ?>" alt="Avatar" class="avatar-img" id="userMenuBtn" width="34" height="34" loading="lazy" />
          <div>
            <div style="font-weight:800"><?= h($_SESSION['user_name']) ?></div>
            <div class="sub"><?= h($_SESSION['user_role']) ?></div>
          </div>
          <div class="user-menu" id="userMenu">
            <a href="profile.php">👤 Profil</a>
            <a href="settings.php">⚙️ Pengaturan</a>
            <a href="<?= base_url('auth/logout.php')?>">🚪 Keluar</a>
          </div>
        </div>
      </div>
    </div>

    <div class="content">
      <div class="h1">Laporan</div>
      <?php if ($isCustomer): ?>
        <div class="sub">Menampilkan transaksi atas nama: <b><?= h($myName) ?></b></div>
      <?php endif; ?>

      <div class="kpis">
        <div class="kpi" data-v="good" id="kpi-revenue">
          <div class="title"><?= $isCustomer ? 'Total Pengeluaran Saya' : 'Total Pendapatan' ?></div>
          <div class="val"><?= rupiah($revNow) ?></div>
          <div class="sub">↗ <?= h(pct_change($revNow,$revPrev)) ?>% vs periode sebelumnya</div>
          <div class="mini"><?= $isCustomer ? '💳':'💸' ?></div><div class="trend"></div>
        </div>
        <div class="kpi" id="kpi-orders">
          <div class="title">Total Pesanan</div>
          <div class="val"><?= (int)$ordNow ?></div>
          <div class="sub"><?= $grp==='bulan'?'Rata-rata ':'' ?>Berat: <?= (float)$avgWeight ?> kg</div>
          <div class="mini">📦</div><div class="trend"></div>
        </div>
        <div class="kpi" id="kpi-weight">
          <div class="title">Berat/Order (rata-rata)</div>
          <div class="val"><?= (float)$avgWeight ?> kg</div>
          <div class="sub">Estimasi periode saat ini</div>
          <div class="mini">⚖️</div><div class="trend"></div>
        </div>
        <?php if ($isStaff): ?>
        <div class="kpi" id="kpi-profit">
          <div class="title">Profit Margin</div>
          <div class="val"><?= (float)$margin ?>%</div>
          <div class="sub"><?= $hasExpenses ? 'Biaya diperhitungkan' : 'Tabel expenses tidak ditemukan' ?></div>
          <div class="mini">📈</div><div class="trend"></div>
        </div>
        <?php endif; ?>
      </div>

      <div class="tabs">
        <a class="tab <?= $tab==='pendapatan'?'active':'' ?>" href="?<?= qstring(['tab'=>'pendapatan'])?>">Pendapatan</a>
        <a class="tab <?= $tab==='pesanan'?'active':'' ?>" href="?<?= qstring(['tab'=>'pesanan'])?>">Pesanan</a>
        <?php if ($isStaff): ?>
          <a class="tab <?= $tab==='layanan'?'active':'' ?>" href="?<?= qstring(['tab'=>'layanan'])?>">Layanan</a>
          <a class="tab <?= $tab==='perbandingan'?'active':'' ?>" href="?<?= qstring(['tab'=>'perbandingan'])?>">Perbandingan</a>
        <?php endif; ?>
      </div>

      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div style="font-weight:800">Tren <?= $isCustomer ? 'Pengeluaran Saya' : 'Pendapatan' ?></div>
          <div style="display:flex; gap:14px; align-items:center">
            <span class="sub">💳 Lunas</span>
            <span class="sub">🕒 Belum Lunas</span>
            <span class="sub"><?= h($start->format('d M Y')) ?> – <?= h($end->format('d M Y')) ?> · Group: <?= ucfirst($grp) ?></span>
          </div>
        </div>
        <canvas id="chart" class="chart"></canvas>
      </div>

      <div class="grid2">
        <div class="card">
          <div style="font-weight:800; margin-bottom:8px"><?= $isCustomer ? 'Ringkasan Harian' : 'Laporan Harian' ?></div>
          <table class="table" id="tblDaily">
            <thead><tr>
              <th>Tanggal</th><th>Pesanan</th>
              <th><?= $isCustomer ? 'Pengeluaran (Rp)' : 'Pendapatan (Rp)' ?></th>
              <th>Berat Total (kg)</th><th>Avg/Order</th>
            </tr></thead>
            <tbody>
              <?php foreach ($daily as $d): ?>
                <tr>
                  <td><?= h(date('d/m/Y', strtotime($d['d']))) ?></td>
                  <td><?= (int)$d['orders'] ?></td>
                  <td><?= rupiah($d['revenue']) ?></td>
                  <td><?= (float)$d['weight'] ?></td>
                  <td><?= rupiah($d['avg_per_order']) ?></td>
                </tr>
              <?php endforeach; if(!$daily): ?>
                <tr><td colspan="5" class="sub" style="text-align:center;padding:26px">Tidak ada data pada periode ini.</td></tr>
              <?php endif; ?>
            </tbody>
          </table>
        </div>

        <?php if ($isStaff): ?>
        <div class="card">
          <div style="font-weight:800; margin-bottom:8px">Top Layanan</div>
          <table class="table">
            <thead><tr><th>Layanan</th><th>Pesanan</th><th>Pendapatan</th></tr></thead>
            <tbody>
              <?php foreach ($byService as $s): ?>
                <tr>
                  <td><?= h($s['name']) ?></td>
                  <td><?= (int)$s['cnt'] ?></td>
                  <td><?= rupiah($s['revenue']) ?></td>
                </tr>
              <?php endforeach; if(!$byService): ?>
                <tr><td colspan="3" class="sub" style="text-align:center;padding:26px">Belum ada data.</td></tr>
              <?php endif; ?>
            </tbody>
          </table>

          <div style="font-weight:800; margin:14px 0 8px">Top Pelanggan</div>
          <table class="table">
            <thead><tr><th>Pelanggan</th><th>Pesanan</th><th>Pendapatan</th></tr></thead>
            <tbody>
              <?php foreach ($topCust as $c): ?>
                <tr>
                  <td><?= h($c['customer_name']) ?></td>
                  <td><?= (int)$c['cnt'] ?></td>
                  <td><?= rupiah($c['revenue']) ?></td>
                </tr>
              <?php endforeach; if(!$topCust): ?>
                <tr><td colspan="3" class="sub" style="text-align:center;padding:26px">Belum ada data.</td></tr>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
        <?php endif; ?>
      </div>
    </div>
  </section>
</div>

<script>
// Ripple anim
document.addEventListener('click', function(e){
  const btn = e.target.closest('.btn, .btn-icon, .tab'); if(!btn) return;
  const c = document.createElement('span'); const d = Math.max(btn.clientWidth, btn.clientHeight);
  c.className='ripple'; c.style.width=c.style.height=d+'px';
  c.style.left=(e.clientX-btn.getBoundingClientRect().left-d/2)+'px';
  c.style.top =(e.clientY-btn.getBoundingClientRect().top -d/2)+'px';
  btn.appendChild(c); setTimeout(()=>c.remove(),600);
});

// Avatar dropdown
const userBtn  = document.getElementById('userMenuBtn');
const userMenu = document.getElementById('userMenu');
userBtn?.addEventListener('click', (e)=>{ e.stopPropagation(); userMenu.classList.toggle('show'); });
document.addEventListener('click', (e)=>{ if (!userMenu.contains(e.target) && !userBtn.contains(e.target)) userMenu.classList.remove('show'); });

// Data chart dari PHP (2 seri)
const CH_LABELS        = <?= json_encode($labels, JSON_UNESCAPED_UNICODE) ?>;
const CH_SERIES_PAID   = <?= json_encode($seriesPaid, JSON_UNESCAPED_UNICODE) ?>;
const CH_SERIES_UNPAID = <?= json_encode($seriesUnpaid, JSON_UNESCAPED_UNICODE) ?>;

window.reportChartData = {
  labels: CH_LABELS,
  paid: CH_SERIES_PAID,
  unpaid: CH_SERIES_UNPAID
};

// Chart canvas 2 garis (Lunas vs Belum Lunas)
(function(){
  const cvs = document.getElementById('chart');
  const ctx = cvs.getContext('2d');

  function resize(){
    const w = cvs.clientWidth || cvs.parentElement.clientWidth - 28;
    cvs.width = w; cvs.height = 320;
    draw(0); animate();
  }
  window.addEventListener('resize', resize, {passive:true});
  resize();

  window.updateReportChart = function() {
    draw(0);
    animate();
  };

  function draw(progress){
    const W = cvs.width, H = cvs.height, P = 36;
    ctx.clearRect(0,0,W,H);

    // grid
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
    for(let i=0;i<=4;i++){
      const y = P + (H-P*2) * i/4;
      ctx.beginPath(); ctx.moveTo(P,y); ctx.lineTo(W-P,y); ctx.stroke();
    }

    const labels = window.reportChartData.labels;
    const paidSeries = window.reportChartData.paid;
    const unpaidSeries = window.reportChartData.unpaid;

    const all = [...paidSeries, ...unpaidSeries, 1];
    const maxVal = Math.max(...all);
    const xStep = (W - P*2) / Math.max(labels.length-1,1);

    function plot(data, stroke, fill){
      if (!data || !data.length) return;
      ctx.beginPath();
      data.forEach((v,idx)=>{
        const x = P + xStep*idx;
        const y = H-P - (H-P*2) * (v/maxVal) * progress;
        if(idx===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();

      // area fill
      ctx.lineTo(P + xStep * (data.length - 1),H-P); ctx.lineTo(P,H-P); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
    }

    // Lunas: biru
    plot(paidSeries,   '#2563eb', 'rgba(37,99,235,.12)');
    // Belum Lunas: merah
    plot(unpaidSeries, '#ef4444', 'rgba(239,68,68,.10)');

    // labels sparse
    ctx.fillStyle = '#64748b'; ctx.font = '12px Inter, system-ui';
    const step = Math.max(1, Math.ceil(labels.length/8));
    for(let i=0;i<labels.length;i+=step){
      if (!labels[i]) continue;
      const x = P + xStep*i; const y = H-P+16;
      ctx.fillText(labels[i], x-10, y+8);
    }
  }

  function animate(){
    const D=800; const t0=performance.now();
    function tick(now){
      const p = Math.min(1, (now-t0)/D);
      draw(p);
      if(p<1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
})();

// Export CSV (tabel harian)
document.getElementById('btnCSV')?.addEventListener('click', ()=>{
  const rows = [['Tanggal','Pesanan','Jumlah (Rp)','Berat Total (kg)','Avg/Order']];
  const tb = document.querySelector('#tblDaily tbody');
  tb.querySelectorAll('tr').forEach(tr=>{
    const tds = tr.querySelectorAll('td');
    if(tds.length===5){
      rows.push([tds[0].innerText, tds[1].innerText, tds[2].innerText.replace(/[^\d]/g,''), tds[3].innerText, tds[4].innerText.replace(/[^\d]/g,'')]);
    }
  });
  const blob = new Blob([rows.map(r=>r.join(',')).join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'laporan.csv'; a.click();
});

// Export “PDF” (print)
document.getElementById('btnPDF')?.addEventListener('click', ()=>{ window.print(); });

// Polling data realtime untuk halaman laporan
async function pollReportRealtime() {
  const urlParams = new URLSearchParams(window.location.search);
  const tabVal = urlParams.get('tab') || 'pendapatan';
  const groupVal = urlParams.get('group') || 'bulan';
  const startVal = urlParams.get('start') || '';
  const endVal = urlParams.get('end') || '';

  try {
    const response = await fetch(`api_realtime.php?page=laporan&tab=${tabVal}&group=${groupVal}&start=${startVal}&end=${endVal}`);
    if (!response.ok) return;
    const data = await response.json();

    // 1) Update KPIs
    const rVal = document.querySelector('#kpi-revenue .val'); if (rVal) rVal.textContent = data.kpi.formatted_revenue;
    const rSub = document.querySelector('#kpi-revenue .sub'); if (rSub) rSub.textContent = `↗ ${data.kpi.growth_pct}% vs periode sebelumnya`;
    const oVal = document.querySelector('#kpi-orders .val'); if (oVal) oVal.textContent = data.kpi.orders;
    const wVal = document.querySelector('#kpi-weight .val'); if (wVal) wVal.textContent = `${data.kpi.avg_weight} kg`;
    const pVal = document.querySelector('#kpi-profit .val'); if (pVal) pVal.textContent = `${data.kpi.margin}%`;
    const pSub = document.querySelector('#kpi-profit .sub'); if (pSub) pSub.textContent = `Profit: ${data.kpi.formatted_profit}`;

    // 2) Update Chart Data
    window.reportChartData.labels = data.chart.labels;
    window.reportChartData.paid = data.chart.paid;
    window.reportChartData.unpaid = data.chart.unpaid;
    if (typeof window.updateReportChart === 'function') {
      window.updateReportChart();
    }

    // 3) Update Daily Table
    const dailyTbody = document.querySelector('#tblDaily tbody');
    if (dailyTbody) {
      if (data.daily && data.daily.length) {
        dailyTbody.innerHTML = data.daily.map(d => `
          <tr>
            <td>${d.formatted_d}</td>
            <td>${d.orders}</td>
            <td>${d.formatted_revenue}</td>
            <td>${d.weight}</td>
            <td>${d.formatted_avg}</td>
          </tr>
        `).join('');
      } else {
        dailyTbody.innerHTML = `<tr><td colspan="5" class="sub" style="text-align:center;padding:26px">Tidak ada data pada periode ini.</td></tr>`;
      }
    }

    // 4) Update Top Services & Top Customers (Staff only)
    const tables = document.querySelectorAll('.grid2 .card table');
    if (tables.length >= 2) {
      // Top Services
      const svcTbody = tables[0].querySelector('tbody');
      if (svcTbody && data.byService) {
        if (data.byService.length) {
          svcTbody.innerHTML = data.byService.map(s => `
            <tr>
              <td>${s.name}</td>
              <td>${s.cnt}</td>
              <td>${s.formatted_revenue}</td>
            </tr>
          `).join('');
        } else {
          svcTbody.innerHTML = `<tr><td colspan="3" class="sub" style="text-align:center;padding:26px">Belum ada data.</td></tr>`;
        }
      }

      // Top Customers
      const custTbody = tables[1].querySelector('tbody');
      if (custTbody && data.topCust) {
        if (data.topCust.length) {
          custTbody.innerHTML = data.topCust.map(c => `
            <tr>
              <td>${c.customer_name}</td>
              <td>${c.cnt}</td>
              <td>${c.formatted_revenue}</td>
            </tr>
          `).join('');
        } else {
          custTbody.innerHTML = `<tr><td colspan="3" class="sub" style="text-align:center;padding:26px">Belum ada data.</td></tr>`;
        }
      }
    }
  } catch (e) {
    console.error('Failed to poll real-time report data', e);
  }
}

// Poll every 4 seconds
setInterval(pollReportRealtime, 4000);

/* =========================
   ++ Tambahan Animasi 3D & Interaksi Keren ++
   (Tidak mengubah logic, hanya UI/UX)
========================= */

// Parallax ambient orbs (gerak mengikuti mouse)
document.addEventListener('pointermove', (e)=>{
  const mx = (e.clientX / window.innerWidth) * 2 - 1;
  const my = (e.clientY / window.innerHeight) * 2 - 1;
  document.documentElement.style.setProperty('--mx', (mx*10).toFixed(2));
  document.documentElement.style.setProperty('--my', (my*10).toFixed(2));
}, {passive:true});

// Universal 3D tilt (kartu & KPI)
function attachTilt(els, strength=12){
  els.forEach(el=>{
    let rect;
    const onEnter = ()=>{ rect = el.getBoundingClientRect(); };
    const onMove = (ev)=>{
      const x = (ev.clientX - rect.left) / rect.width;
      const y = (ev.clientY - rect.top) / rect.height;
      const rx = ((y - .5) * -strength).toFixed(2);
      const ry = ((x - .5) *  strength).toFixed(2);
      el.style.setProperty('--rx', rx+'deg');
      el.style.setProperty('--ry', ry+'deg');
      el.style.setProperty('--gx', (x*100).toFixed(1)+'%');
      el.style.setProperty('--gy', (y*100).toFixed(1)+'%');
    };
    const onLeave = ()=>{
      el.style.setProperty('--rx','0deg'); el.style.setProperty('--ry','0deg');
    };
    el.addEventListener('pointerenter', onEnter, {passive:true});
    el.addEventListener('pointermove',  onMove,  {passive:true});
    el.addEventListener('pointerleave', onLeave, {passive:true});
  });
}
attachTilt(Array.from(document.querySelectorAll('.kpi')), 10);
attachTilt(Array.from(document.querySelectorAll('.card')), 6);

// Magnetic hover untuk tombol
function magnetize(btn, radius=100, force=16){
  let r;
  const onMove = (e)=>{
    const b = btn.getBoundingClientRect();
    const x = e.clientX - (b.left + b.width/2);
    const y = e.clientY - (b.top  + b.height/2);
    const dist = Math.hypot(x,y);
    if(dist < radius){
      btn.style.transform = `translate(${(x/force).toFixed(1)}px, ${(y/force).toFixed(1)}px)`;
      btn.style.boxShadow = '0 10px 24px rgba(37,99,235,.18)';
    } else {
      btn.style.transform = '';
      btn.style.boxShadow = '';
    }
  };
  window.addEventListener('pointermove', onMove, {passive:true});
}
document.querySelectorAll('.btn, .tab').forEach(b=>magnetize(b, 120, 10));

// Chart card subtle 3D hover (ikutkan canvas)
const chartCard = document.getElementById('chart')?.closest('.card');
if(chartCard){ attachTilt([chartCard], 6); }

// Sidebar subtle wobble saat scroll
let lastY = window.scrollY;
window.addEventListener('scroll', ()=>{
  const y = window.scrollY;
  const delta = Math.max(-4, Math.min(4, y - lastY));
  document.querySelector('.sidebar')?.style.setProperty('transform', `translateZ(0) rotateX(${delta*.1}deg)`);
  lastY = y;
}, {passive:true});

// Shine pulse berkala di KPI pertama (biar hidup)
setInterval(()=>{
  const k = document.querySelector('.kpi');
  if(!k) return;
  k.style.setProperty('--gx', '30%');
  k.style.setProperty('--gy', '30%');
  k.animate([{opacity:1},{opacity:.9},{opacity:1}], {duration:900, easing:'ease-in-out'});
}, 3800);

// Hapus efek berat di mode prefers-reduced-motion
if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  document.querySelectorAll('.kpi,.card,.btn,.tab').forEach(el=>{ el.style.transition='none'; el.onpointermove=null; });
}
</script>
</body>
</html>
