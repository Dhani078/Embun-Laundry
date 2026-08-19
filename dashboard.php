<?php
require_once __DIR__ . '/config.php';
require_login();

/* ===== Helper Avatar untuk dashboard ===== */
function avatar_url_dash($uid){
  $base = 'uploads/avatars';
  foreach (['jpg','jpeg','png','webp'] as $ext){
    $p = __DIR__ . "/$base/$uid.$ext";
    if (is_file($p)) return "$base/$uid.$ext?v=".filemtime($p); // cache-buster
  }
  return 'img/avatar-placeholder.png';
}
$AVATAR = avatar_url_dash((int)($_SESSION['user_id'] ?? 0));
$userId = (int)($_SESSION['user_id'] ?? 0);

/* ============ ROLE ============ */
$role       = $_SESSION['user_role'] ?? 'Customer';
$isStaff    = in_array($role, ['Admin','Owner','Staff'], true);
$isCustomer = !$isStaff;
$myName     = trim($_SESSION['user_name'] ?? ''); // dipakai untuk filter customer

/* ============ FILTER ============ */
/*
 * Simpan pilihan range di session.
 * Kalau hari sudah ganti dan terakhir pakai "today",
 * otomatis balik ke "7d" supaya dashboard nggak kelihatan kosong terus.
 */
$allowedRanges = ['today','7d','30d'];

$todayKey  = (new DateTime('today'))->format('Y-m-d');
$lastKey   = $_SESSION['dash_last_date'] ?? null;
$lastRange = $_SESSION['dash_range'] ?? null;

// Kalau hari baru & kemarin range-nya "today" → paksa balik ke 7 hari
if ($lastKey !== null && $lastKey !== $todayKey && $lastRange === 'today') {
    $lastRange = '7d';
}

$range = $_GET['range'] ?? ($lastRange ?? '7d');
if (!in_array($range, $allowedRanges, true)) {
    $range = '7d';
}

$_SESSION['dash_range']     = $range;
$_SESSION['dash_last_date'] = $todayKey;

$svcFilter = isset($_GET['svc']) ? (int)$_GET['svc'] : null;

$todayStart    = (new DateTime('today'))->setTime(0,0,0);
$tomorrowStart = (clone $todayStart)->modify('+1 day');

switch ($range) {
  case '7d':  $start = (clone $todayStart)->modify('-6 days');  $end = (clone $tomorrowStart); break;
  case '30d': $start = (clone $todayStart)->modify('-29 days'); $end = (clone $tomorrowStart); break;
  default:    $range='today'; $start=$todayStart; $end=$tomorrowStart; break;
}

/* ============ UTIL ============ */
function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function rupiah($n){ return 'Rp '.number_format((int)$n,0,',','.'); }

/* ============ VALIDATOR KODE (server-side) ============ */
function validate_voucher_code(mysqli $mysqli, int $userId, string $code, int $subtotal): array {
  $code = strtoupper(trim($code));
  if ($code === '' || $subtotal <= 0) return ['ok'=>false,'msg'=>'Kode atau subtotal tidak valid'];

  // 1) user_vouchers
  $hasUV = $mysqli->query("SHOW TABLES LIKE 'user_vouchers'");
  if ($hasUV && $hasUV->num_rows) {
    $st = $mysqli->prepare("SELECT id,promo_id,code,name,type,value,min_spend,max_discount,expires_at,used_at
                            FROM user_vouchers WHERE user_id=? AND code=? LIMIT 1");
    $st->bind_param('is',$userId,$code);
    $st->execute(); $uv = $st->get_result()->fetch_assoc(); $st->close();

    if ($uv) {
      if (!empty($uv['used_at'])) return ['ok'=>false,'msg'=>'Kode sudah digunakan'];
      if (!empty($uv['expires_at']) && strtotime($uv['expires_at']) < time()) return ['ok'=>false,'msg'=>'Kode kedaluwarsa'];
      $minSpend = (int)($uv['min_spend'] ?? 0);
      if ($minSpend>0 && $subtotal < $minSpend) return ['ok'=>false,'msg'=>'Belum memenuhi minimum belanja'];

      $disc=0; $type=strtolower($uv['type'] ?? 'flat'); $val=(int)($uv['value'] ?? 0);
      $maxDisc=(int)($uv['max_discount'] ?? 0);
      if ($type==='percent'){
        $disc = (int)floor($subtotal * ($val/100));
        if ($maxDisc>0) $disc = min($disc,$maxDisc);
      } else {
        $disc = $val;
      }
      $disc = max(0, min($disc, $subtotal));
      return [
        'ok'=>true,'discount'=>$disc,'label'=>$uv['name'],'source'=>'user_vouchers',
        'voucher_id'=>(int)$uv['id'],'promo_id'=>(int)($uv['promo_id'] ?? 0),'type'=>$type,'value'=>$val,
        'min_spend'=>$minSpend,'max_discount'=>$maxDisc,'expires_at'=>$uv['expires_at'] ?? null
      ];
    }
  }

  // 2) promos
  $hasP = $mysqli->query("SHOW TABLES LIKE 'promos'");
  if ($hasP && $hasP->num_rows) {
    $colCode = $mysqli->query("SHOW COLUMNS FROM promos LIKE 'code'");
    if ($colCode && $colCode->num_rows){
      $st = $mysqli->prepare("SELECT id,name,code,
        IFNULL(type,'flat') AS type,
        IFNULL(value,0) AS value,
        IFNULL(min_spend,0) AS min_spend,
        IFNULL(max_discount,0) AS max_discount,
        IFNULL(start_at,NULL) AS start_at,
        IFNULL(end_at,NULL) AS end_at,
        IFNULL(is_active,1) AS is_active
        FROM promos WHERE code=? LIMIT 1");
      $st->bind_param('s',$code);
      $st->execute(); $pr = $st->get_result()->fetch_assoc(); $st->close();

      if ($pr) {
        if (!(int)$pr['is_active']) return ['ok'=>false,'msg'=>'Promo non-aktif'];
        $now=time();
        if (!empty($pr['start_at']) && strtotime($pr['start_at']) > $now) return ['ok'=>false,'msg'=>'Promo belum aktif'];
        if (!empty($pr['end_at'])   && strtotime($pr['end_at'])   < $now) return ['ok'=>false,'msg'=>'Promo berakhir'];

        $minSpend=(int)($pr['min_spend'] ?? 0);
        if ($minSpend>0 && $subtotal < $minSpend) return ['ok'=>false,'msg'=>'Belum memenuhi minimum belanja'];

        $disc=0; $type=strtolower($pr['type'] ?? 'flat'); $val=(int)($pr['value'] ?? 0);
        $maxDisc=(int)($pr['max_discount'] ?? 0);
        if ($type==='percent'){
          $disc=(int)floor($subtotal * ($val/100));
          if ($maxDisc>0) $disc=min($disc,$maxDisc);
        }else{
          $disc=$val;
        }
        $disc = max(0, min($disc,$subtotal));
        return [
          'ok'=>true,'discount'=>$disc,'label'=>$pr['name'],'source'=>'promos',
          'voucher_id'=>null,'promo_id'=>(int)$pr['id'],'type'=>$type,'value'=>$val,
          'min_spend'=>$minSpend,'max_discount'=>$maxDisc,'expires_at'=>$pr['end_at'] ?? null
        ];
      }
    }
  }

  return ['ok'=>false,'msg'=>'Kode tidak ditemukan'];
}

/* ============ INSERT PESANAN & AJAX ============ */
if ($_SERVER['REQUEST_METHOD']==='POST') {
  $act = $_POST['action'] ?? '';

  if ($act === 'apply_code') {
    header('Content-Type: application/json; charset=utf-8');
    $code = $_POST['code'] ?? '';
    $subtotal = (int)($_POST['subtotal'] ?? 0);
    $res = validate_voucher_code($mysqli, $userId, $code, $subtotal);
    echo json_encode($res); exit;
  }

  if ($act === 'create_order') {
    $customer = $isCustomer ? $myName : trim($_POST['customer_name'] ?? '');
    $phone    = trim($_POST['customer_phone'] ?? '');
    $addr     = trim($_POST['customer_address'] ?? '');
    $svcId    = (int)($_POST['service_id'] ?? 0);
    $kg       = max(1, (int)($_POST['weight_kg'] ?? 1));
    $disc     = max(0, (int)($_POST['discount'] ?? 0));
    $priceKg  = (int)($_POST['price_per_kg'] ?? 0);
    $codeIn   = strtoupper(trim($_POST['voucher_code'] ?? ''));

    if ($customer !== '' && $svcId > 0) {
      if ($priceKg <= 0) {
        $st = $mysqli->prepare("SELECT price FROM services WHERE id=?");
        $st->bind_param('i',$svcId); $st->execute(); $st->bind_result($priceKg); $st->fetch(); $st->close();
        if (!$priceKg) $priceKg = 20000;
      }

      $subtotal = $kg*$priceKg;

      $applied = null;
      if ($codeIn !== '') {
        $chk = validate_voucher_code($mysqli, $userId, $codeIn, $subtotal);
        if ($chk['ok'] ?? false) { $disc = (int)$chk['discount']; $applied = $chk; }
        else { $codeIn = ''; }
      }

      if ($disc > $subtotal) $disc = $subtotal;
      $total = max(0, $subtotal - $disc);

      $code = 'INV' . date('ymd') . strtoupper(substr(bin2hex(random_bytes(2)),0,4));
      $status = 'baru';
      $nowStr = (new DateTime())->format('Y-m-d H:i:s');

      $st = $mysqli->prepare("INSERT INTO orders
        (order_code,customer_name,customer_phone,customer_address,service_id,weight_kg,price_per_kg,discount,total_amount,status,created_at,finished_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL)");
      $st->bind_param('ssssiiiiiss', $code,$customer,$phone,$addr,$svcId,$kg,$priceKg,$disc,$total,$status,$nowStr);
      $st->execute(); $st->close();

      if (!empty($applied)) {
        if (($applied['source'] ?? '') === 'user_vouchers' && ($applied['voucher_id'] ?? 0)) {
          $uvId = (int)$applied['voucher_id']; $amount = (int)$applied['discount'];
          $hasUV = $mysqli->query("SHOW TABLES LIKE 'user_vouchers'");
          if ($hasUV && $hasUV->num_rows) {
            $u = $mysqli->prepare("UPDATE user_vouchers SET used_at=NOW() WHERE id=? AND user_id=? AND used_at IS NULL");
            $u->bind_param('ii', $uvId, $userId); $u->execute(); $u->close();
          }
          $hasVC = $mysqli->query("SHOW TABLES LIKE 'voucher_claims'");
          if ($hasVC && $hasVC->num_rows) {
            $c = $mysqli->prepare("INSERT INTO voucher_claims (user_id, promo_id, voucher_id, source, amount) VALUES (?,?,?,?,?)");
            $src = 'code'; $pid = (int)($applied['promo_id'] ?? 0);
            $c->bind_param('iiisi', $userId, $pid, $uvId, $src, $amount);
            $c->execute(); $c->close();
          }
        } else {
          $hasVC = $mysqli->query("SHOW TABLES LIKE 'voucher_claims'");
          if ($hasVC && $hasVC->num_rows) {
            $c = $mysqli->prepare("INSERT INTO voucher_claims (user_id, promo_id, voucher_id, source, amount) VALUES (?,?,?,?,?)");
            $src = 'promo'; $pid = (int)($applied['promo_id'] ?? 0); $vid = null; $amount=(int)$applied['discount'];
            $c->bind_param('iiisi', $userId, $pid, $vid, $src, $amount);
            $c->execute(); $c->close();
          }
        }
      }

      $qs = http_build_query(['range'=>$range,'svc'=>$svcFilter]);
      header("Location: " . base_url('dashboard.php') . ($qs?'?'.$qs:'' ));
      exit;
    }
  }
}

/* ============ MASTER LAYANAN ============ */
$svcRows = [];
$res = $mysqli->query("SELECT id,name,price FROM services WHERE is_active=1 ORDER BY id");
while ($row = $res->fetch_assoc()) $svcRows[] = $row;
$nameToId = [];
foreach ($svcRows as $r) $nameToId[$r['name']] = (int)$r['id'];

/* ============ KPI & QUERIES SCOPE ============ */
$kpi = ['orders'=>0, 'progress'=>0, 'done'=>0, 'revenue'=>0];

/* base filter untuk semua query */
$qBase   = " FROM orders WHERE created_at >= ? AND created_at < ? ";
$types   = 'ss';
$params  = [$start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s')];

if ($svcFilter) { $qBase .= " AND service_id=? "; $types .= 'i'; $params[] = $svcFilter; }
if ($isCustomer && $myName !== '') { $qBase .= " AND customer_name=? "; $types .= 's'; $params[] = $myName; }

$stmt = $mysqli->prepare("SELECT COUNT(*) ".$qBase);
$stmt->bind_param($types, ...$params); $stmt->execute(); $stmt->bind_result($kpi['orders']); $stmt->fetch(); $stmt->close();

$stmt = $mysqli->prepare("SELECT COUNT(*) ".$qBase." AND status='proses'");
$stmt->bind_param($types, ...$params); $stmt->execute(); $stmt->bind_result($kpi['progress']); $stmt->fetch(); $stmt->close();

/* selesai pakai finished_at dan status=selesai */
$qDoneBase   = " FROM orders WHERE finished_at >= ? AND finished_at < ? AND status='selesai' ";
$typesDone   = 'ss';
$paramsDone  = [$start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s')];
if ($svcFilter) { $qDoneBase .= " AND service_id=? "; $typesDone.='i'; $paramsDone[]=$svcFilter; }
if ($isCustomer && $myName!=='') { $qDoneBase .= " AND customer_name=? "; $typesDone.='s'; $paramsDone[]=$myName; }

$stmt = $mysqli->prepare("SELECT COUNT(*) ".$qDoneBase);
$stmt->bind_param($typesDone, ...$paramsDone); $stmt->execute(); $stmt->bind_result($kpi['done']); $stmt->fetch(); $stmt->close();

$stmt = $mysqli->prepare("SELECT COALESCE(SUM(total_amount),0) ".$qBase." AND status!='batal'");
$stmt->bind_param($types, ...$params); $stmt->execute(); $stmt->bind_result($kpi['revenue']); $stmt->fetch(); $stmt->close();

/* ============ BAR: per jam / per hari ============ */
$barLabels = []; $barData = [];
if ($range === 'today') {
  // 24 jam penuh (00–23)
  for ($h=0; $h<=23; $h++) { $barLabels[] = sprintf('%02d:00', $h); }
  $barData = array_fill(0, count($barLabels), 0);

  $stmt = $mysqli->prepare("SELECT HOUR(created_at) h, COUNT(*) c ".$qBase." GROUP BY h");
  $stmt->bind_param($types, ...$params);
  $stmt->execute(); $res = $stmt->get_result();
  while ($r = $res->fetch_assoc()) {
    $h = (int)$r['h'];
    if ($h >= 0 && $h <= 23) $barData[$h] = (int)$r['c'];
  }
  $stmt->close();
  $barData = array_values($barData);
} else {
  $days = ($range==='7d') ? 7 : 30;
  for ($i=$days-1; $i>=0; $i--) $barLabels[] = (new DateTime("-$i days"))->format('d M');
  $barData = array_fill(0, count($barLabels), 0);
  $stmt = $mysqli->prepare("SELECT DATE(created_at) d, COUNT(*) c ".$qBase." GROUP BY d ORDER BY d");
  $stmt->bind_param($types, ...$params); $stmt->execute(); $res = $stmt->get_result();
  $map=[]; while ($r=$res->fetch_assoc()) $map[(new DateTime($r['d']))->format('d M')] = (int)$r['c'];
  foreach ($barLabels as $i=>$lab) if (isset($map[$lab])) $barData[$i] = $map[$lab];
  $stmt->close();
  $barData = array_values($barData);
}

/* ============ PIE: komposisi layanan ============ */
$pieLabels=[]; $pieData=[]; $totalCnt = 0;
$sqlPie = "
  SELECT s.name, COUNT(*) cnt
  FROM orders o JOIN services s ON s.id=o.service_id
  WHERE o.created_at >= ? AND o.created_at < ? " .
  ($svcFilter?" AND o.service_id=? ":"") .
  ($isCustomer && $myName!=='' ? " AND o.customer_name=? " : "") .
  " GROUP BY o.service_id ORDER BY cnt DESC";
$stmt = $mysqli->prepare($sqlPie);

$typesPie  = 'ss'; $paramsPie = [$start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s')];
if ($svcFilter) { $typesPie.='i'; $paramsPie[]=$svcFilter; }
if ($isCustomer && $myName!=='') { $typesPie.='s'; $paramsPie[]=$myName; }

$stmt->bind_param($typesPie, ...$paramsPie);
$stmt->execute(); $res = $stmt->get_result();
while ($r=$res->fetch_assoc()){ $pieLabels[]=$r['name']; $pieData[]=(int)$r['cnt']; $totalCnt += (int)$r['cnt']; }
$stmt->close();

/* ============ LINE: pendapatan harian ============ */
$lineLabels=[]; $lineRevenue=[];
$periodDays = ($range==='30d') ? 30 : 7;
for ($i=$periodDays-1; $i>=0; $i--) $lineLabels[] = (new DateTime("-$i days"))->format('d M');
$lineRevenue = array_fill(0,count($lineLabels),0);

$stmt = $mysqli->prepare("SELECT DATE(created_at) d, COALESCE(SUM(total_amount),0) rev ".$qBase." GROUP BY d ORDER BY d");
$stmt->bind_param($types, ...$params); $stmt->execute(); $res = $stmt->get_result();
$map=[]; while ($r=$res->fetch_assoc()) $map[(new DateTime($r['d']))->format('d M')] = (int)$r['rev'];
foreach ($lineLabels as $i=>$lab) if (isset($map[$lab])) $lineRevenue[$i] = $map[$lab];
$stmt->close();
$lineRevenue = array_values($lineRevenue);
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Embun Laundry · Dashboard</title>
<link rel="stylesheet" href="assets/style.css"/>
</head>
<body>

<div class="wrap">
  <aside class="sidebar">
    <div>
      <div class="brand">
        <img src="img/Logo.png" alt="Embun Laundry" class="logo-img" width="36" height="36" decoding="async" fetchpriority="high" />
        <div class="name">Embun Laundry</div>
      </div>

      <nav class="nav">
        <a class="active" href="#"><span>🏠</span> <span>Dashboard</span></a>
        <a href="pesanan.php"><span>🧺</span> <span>Pesanan</span></a>
        <a href="pelanggan.php"><span>👥</span> <span>Pelanggan</span></a>
        <a href="layanan.php"><span>💲</span> <span>Layanan & Harga</span></a>
        <a href="delivery.php"><span>🚚</span> <span>Pickup & Delivery</span></a>
        <a href="laporan.php"><span>📑</span> <span>Laporan</span></a>
        <a href="promo.php"><span>🎟️</span> <span>Promo & Diskon</span></a>
      </nav>
    </div>

    <div class="side-bottom">
      <a href="profile.php"><span>👤</span> <span>Profil</span></a>
      <a href="settings.php"><span>⚙️</span><span>Settings</span></a>
      <a href="<?= base_url('auth/logout.php')?>"><span>🚪</span><span>Logout</span></a>
    </div>
  </aside>

  <section class="main">
    <div class="topbar">
      <div class="topbar-inner">
        <div class="search">🔎 <input type="text" placeholder="Cari pesanan, pelanggan, invoice..."></div>
        <select id="range" class="btn" style="padding:.55rem .8rem">
          <option value="today" <?= $range==='today'?'selected':'' ?>>Hari Ini</option>
          <option value="7d" <?= $range==='7d'?'selected':'' ?>>7 Hari</option>
          <option value="30d" <?= $range==='30d'?'selected':'' ?>>30 Hari</option>
        </select>
        <button class="btn btn-primary" id="btnAdd">+ Tambah Pesanan</button>

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
      <div class="h1">Dashboard</div>
      <div class="sub">Selamat datang kembali, <?= h($_SESSION['user_name']) ?>.</div>

      <div class="grid kpis" style="margin-top:14px">
        <div class="card kpi tilt-3d" id="kpi-orders" style="background:#f5f9ff;cursor:pointer">
          <div class="title">Pesanan</div><div class="value"><?= (int)$kpi['orders'] ?></div>
          <div class="sub">Periode dipilih</div><div class="mini">📦</div><div class="blob b-blue"></div>
        </div>
        <div class="card kpi tilt-3d" id="kpi-progress" style="background:#fffaf3">
          <div class="title">Dalam Proses</div><div class="value"><?= (int)$kpi['progress'] ?></div>
          <div class="sub">Update realtime</div><div class="mini">🕒</div><div class="blob b-amber"></div>
        </div>
        <div class="card kpi tilt-3d" id="kpi-done" style="background:#f5fffa">
          <div class="title">Selesai</div><div class="value"><?= (int)$kpi['done'] ?></div>
          <div class="sub">Finishing periode</div><div class="mini">✅</div><div class="blob b-green"></div>
        </div>
        <div class="card kpi tilt-3d" id="kpi-revenue" style="background:#fbf7ff;cursor:pointer">
          <div class="title"><?= $isCustomer ? 'Pengeluaran Saya' : 'Pendapatan' ?></div>
          <div class="value"><?= rupiah($kpi['revenue']) ?></div>
          <div class="sub">
            <?= $isCustomer
                ? 'Total yang sudah kamu keluarkan pada periode ini'
                : 'Total pendapatan (total_amount, kecuali status batal)' ?>
          </div>
          <div class="mini">💲</div><div class="blob b-violet"></div>
        </div>
      </div>

      <div class="grid panels" style="margin-top:14px">
        <div class="card tilt-3d">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h3><?= $range==='today'?'Pesanan per Jam':'Pesanan per Hari' ?></h3>
            <div class="legend"><button id="btnType" class="btn-icon" title="Ganti tipe">📊</button> <span id="lblType">Bar</span></div>
          </div>
          <div style="height:220px"><canvas id="chartBar"></canvas></div>
          <?php if (!array_sum($barData)): ?><div class="sub" style="margin-top:8px">Belum ada data pada periode/layanan ini.</div><?php endif; ?>
        </div>

        <div class="card tilt-3d">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h3>Komposisi Layanan</h3>
            <button id="btnExportPie" class="btn">Export CSV</button>
          </div>
          <div style="height:220px"><canvas id="chartPie"></canvas></div>
          <div class="legend" id="legendPie"></div>
          <?php if ($totalCnt===0): ?><div class="sub" style="margin-top:8px">Belum ada data pada periode/layanan ini.</div><?php endif; ?>
        </div>
      </div>

      <div class="grid trend" style="margin-top:14px">
        <div class="card tilt-3d">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h3><?= $isCustomer ? 'Tren Pengeluaran' : 'Tren Pendapatan' ?></h3>
            <div class="legend"><button id="btnSmooth" class="btn">Haluskan</button> <button id="btnExportLine" class="btn">Export CSV</button></div>
          </div>
          <div style="height:260px"><canvas id="chartLine"></canvas></div>
        </div>
      </div>

      <div class="footer-space"></div>
    </div>
  </section>
</div>

<!-- MODAL ADD ORDER -->
<div class="modal" id="orderModal" aria-hidden="true">
  <div class="sheet">
    <span class="badge">Tambah Pesanan</span>
    <h3>Input Pesanan Baru</h3>
    <form method="post" id="orderForm">
      <div class="row">
        <?php if ($isCustomer): ?>
          <div><label>Pelanggan</label>
            <input class="input" value="<?= h($myName) ?>" readonly>
            <input type="hidden" name="customer_name" value="<?= h($myName) ?>">
          </div>
        <?php else: ?>
          <div><label>Pelanggan</label><input class="input" name="customer_name" required placeholder="Nama pelanggan"></div>
        <?php endif; ?>
        <div>
          <label>Kontak (HP/WA)</label>
          <input class="input" name="customer_phone" id="phone" placeholder="08xxxxxxxxxx">
        </div>
      </div>

      <div class="row">
        <div>
          <label>Alamat</label>
          <textarea class="input" name="customer_address" id="addr" placeholder="Jalan, RT/RW, Kel/Desa, Kec, Kota/Kab"></textarea>
        </div>
        <div>
          <label>Layanan</label>
          <select name="service_id" id="svc" required>
            <?php foreach ($svcRows as $s): ?>
              <option value="<?= (int)$s['id'] ?>" data-price="<?= (int)$s['price'] ?>"><?= h($s['name']) ?> (<?= rupiah($s['price']) ?>/kg)</option>
            <?php endforeach; ?>
          </select>
        </div>
      </div>

      <div class="row">
        <div>
          <label>Kode Voucher/Promo</label>
          <div style="display:flex;gap:8px">
            <input class="input" id="fCode" placeholder="Masukkan kode (cth: HEMAT20)" style="flex:1">
            <button type="button" class="btn" id="btnApplyCode">Terapkan</button>
            <button type="button" class="btn" id="btnClearCode" style="display:none">Hapus</button>
          </div>
          <input type="hidden" name="voucher_code" id="fCodeHidden">
          <div class="sub" id="codeNote">Gunakan kode yang kamu punya. Diskon dihitung otomatis.</div>
        </div>
        <div>
          <label>Diskon (Rp)</label>
          <input class="input" type="number" min="0" step="1000" value="0" name="discount" id="disc" <?= $isStaff?'':'readonly' ?>>
        </div>
      </div>

      <div class="row">
        <div><label>Berat (kg)</label><input class="input" type="number" min="1" step="1" value="3" name="weight_kg" id="kg" required></div>
        <div><label>Harga/kg</label><input class="input" type="number" name="price_per_kg" id="price" readonly></div>
      </div>

      <div class="row">
        <div><label>Total</label><input class="input" type="text" id="total" readonly></div>
        <div style="display:flex;align-items:flex-end;gap:8px">
          <button type="button" class="btn" id="btnClose">Batal</button>
          <button class="btn btn-primary" type="submit">Simpan</button>
        </div>
      </div>

      <input type="hidden" name="action" value="create_order">
    </form>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1"></script>
<script>
// Ripple
document.addEventListener('click', function(e){
  const btn = e.target.closest('.btn, .btn-icon'); if(!btn) return;
  const circle = document.createElement('span');
  const d = Math.max(btn.clientWidth, btn.clientHeight);
  circle.style.width = circle.style.height = d+'px';
  circle.style.left = (e.clientX - btn.getBoundingClientRect().left - d/2) + 'px';
  circle.style.top  = (e.clientY - btn.getBoundingClientRect().top  - d/2) + 'px';
  circle.className = 'ripple';
  btn.appendChild(circle);
  setTimeout(()=>circle.remove(), 600);
});

// Range filter (tetap)
document.getElementById('range').addEventListener('change', (e)=>{
  const url = new URL(location.href);
  url.searchParams.set('range', e.target.value);
  url.searchParams.delete('svc');
  location.href = url.toString();
});

// Data PHP -> JS
const BAR_LABELS = <?= json_encode($barLabels, JSON_UNESCAPED_UNICODE) ?>;
const BAR_DATA   = <?= json_encode(array_values($barData)) ?>;
const PIE_LABELS = <?= json_encode($pieLabels, JSON_UNESCAPED_UNICODE) ?>;
const PIE_DATA   = <?= json_encode($pieData) ?>;
const LINE_LABELS= <?= json_encode($lineLabels, JSON_UNESCAPED_UNICODE) ?>;
const LINE_DATA  = <?= json_encode(array_values($lineRevenue)) ?>;
const nameToId   = <?= json_encode($nameToId, JSON_UNESCAPED_UNICODE) ?>;

if (typeof Chart !== 'undefined') {
  let barType = 'bar';
  const chartBar = new Chart(document.getElementById('chartBar'), {
    type: barType,
    data: {
      labels: BAR_LABELS,
      datasets:[{
        label:'Pesanan',
        data: BAR_LABELS.map((_,i)=> Number(BAR_DATA[i] ?? 0)),
        backgroundColor:'#2563eb',
        borderRadius:6,
        borderColor:'#2563eb'
      }]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      animation:{
        duration:800,
        easing:'easeOutCubic',
        delay:(ctx)=> ctx.dataIndex * 25
      },
      scales:{ y:{ beginAtZero:true, grid:{color:'#eef1f6'}}, x:{ grid:{display:false}}},
      plugins:{ legend:{display:false} }
    }
  });

  const colors = ['#2563eb','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ef4444','#22c55e','#f97316'];
  const chartPie = new Chart(document.getElementById('chartPie'), {
    type: 'doughnut',
    data: { labels: PIE_LABELS, datasets:[{ data: PIE_DATA, backgroundColor: colors.slice(0, PIE_LABELS.length), hoverOffset:8 }] },
    options: { cutout:'60%', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} },
      animation:{ animateRotate:true, duration:900, easing:'easeOutQuart' }
    }
  });

  let smooth=false;
  const chartLine = new Chart(document.getElementById('chartLine'), {
    type: 'line',
    data: {
      labels: LINE_LABELS,
      datasets:[{
        label:'<?= $isCustomer ? 'Pengeluaran' : 'Pendapatan' ?>',
        data: LINE_LABELS.map((_,i)=> Number(LINE_DATA[i] ?? 0)),
        borderWidth:2, pointRadius:3,
        borderColor:'#2563eb',
        backgroundColor:'rgba(37,99,235,.12)',
        fill:true, tension:.35
      }]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      animation:{
        duration:900,
        easing:'easeOutQuart',
        delay:(ctx)=> ctx.dataIndex * 30
      },
      scales:{
        y:{ beginAtZero:true, grid:{color:'#eef1f6'}, ticks:{ callback:(v)=>'Rp '+Number(v).toLocaleString('id-ID') } },
        x:{ grid:{display:false} }
      },
      plugins:{ legend:{display:false} }
    }
  });

  document.getElementById('btnType').addEventListener('click', ()=>{
    barType = (barType==='bar'?'line':'bar');
    chartBar.config.type = barType; chartBar.update();
    document.getElementById('lblType').textContent = barType==='bar'?'Bar':'Line';
  });

  document.getElementById('btnSmooth').addEventListener('click', ()=>{
    smooth = !smooth;
    chartLine.data.datasets[0].tension = smooth ? .5 : .35;
    chartLine.update();
  });

  function exportCSV(filename, labels, data, headers){
    let csv = [headers.join(',')];
    for (let i=0;i<labels.length;i++) csv.push(`"${labels[i]}",${data[i]}`);
    const blob = new Blob([csv.join('\n')],{type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  }

  window.PIE_DATA_LATEST = PIE_DATA;
  window.PIE_LABELS_LATEST = PIE_LABELS;
  window.LINE_DATA_LATEST = LINE_DATA;
  window.LINE_LABELS_LATEST = LINE_LABELS;

  document.getElementById('btnExportPie').addEventListener('click', ()=> exportCSV('komposisi_layanan.csv', window.PIE_LABELS_LATEST, window.PIE_DATA_LATEST, ['Layanan','Jumlah']));
  document.getElementById('btnExportLine').addEventListener('click',()=> exportCSV('tren_pendapatan.csv', window.LINE_LABELS_LATEST, window.LINE_DATA_LATEST, ['Tanggal','Pendapatan']));

  const legend = document.getElementById('legendPie');
  PIE_LABELS.forEach((l,i)=>{
    const a = document.createElement('a'); a.href='#'; a.className='sub';
    a.innerHTML = `<span class="dot" style="background:${colors[i]}"></span> ${l}`;
    a.addEventListener('click', (ev)=>{
      ev.preventDefault();
      const url = new URL(location.href);
      const id = nameToId[l];
      if (id) url.searchParams.set('svc', id);
      location.href = url.toString();
    });
    legend.appendChild(a);
  });

  async function pollRealtimeData() {
    const rangeVal = document.getElementById('range').value;
    const urlParams = new URLSearchParams(window.location.search);
    const svcVal = urlParams.get('svc') || '';
    
    try {
      const response = await fetch(`api_realtime.php?page=dashboard&range=${rangeVal}&svc=${svcVal}`);
      if (!response.ok) return;
      const data = await response.json();
      
      // Update KPIs
      const oVal = document.querySelector('#kpi-orders .value'); if (oVal) oVal.textContent = data.kpi.orders;
      const pVal = document.querySelector('#kpi-progress .value'); if (pVal) pVal.textContent = data.kpi.progress;
      const dVal = document.querySelector('#kpi-done .value'); if (dVal) dVal.textContent = data.kpi.done;
      const rVal = document.querySelector('#kpi-revenue .value'); if (rVal) rVal.textContent = data.kpi.formatted_revenue;
      
      // Update Charts
      chartBar.data.labels = data.bar.labels;
      chartBar.data.datasets[0].data = data.bar.data;
      chartBar.update('none');
      
      chartPie.data.labels = data.pie.labels;
      chartPie.data.datasets[0].data = data.pie.data;
      chartPie.update('none');
      
      chartLine.data.labels = data.line.labels;
      chartLine.data.datasets[0].data = data.line.data;
      chartLine.update('none');

      // Update CSV data references
      window.PIE_DATA_LATEST = data.pie.data;
      window.PIE_LABELS_LATEST = data.pie.labels;
      window.LINE_DATA_LATEST = data.line.data;
      window.LINE_LABELS_LATEST = data.line.labels;
      
    } catch(e) {
      console.error('Failed to poll real-time data', e);
    }
  }

  // Poll every 4 seconds
  setInterval(pollRealtimeData, 4000);
} else {
  console.warn('Chart.js CDN tidak termuat; halaman tetap jalan tanpa charts.');
}

// ====== Modal tambah pesanan + Voucher Code ======
const modal = document.getElementById('orderModal');
const btnAdd = document.getElementById('btnAdd');
const btnClose = document.getElementById('btnClose');
const selSvc = document.getElementById('svc');
const inputKg = document.getElementById('kg');
const inputDisc = document.getElementById('disc');
const inputPrice = document.getElementById('price');
const inputTotal = document.getElementById('total');

const fCode = document.getElementById('fCode');
const fCodeHidden = document.getElementById('fCodeHidden');
const codeNote = document.getElementById('codeNote');
const btnApplyCode = document.getElementById('btnApplyCode');
const btnClearCode = document.getElementById('btnClearCode');

function currentSubtotal(){
  const price = parseInt(selSvc.options[selSvc.selectedIndex].dataset.price||'0',10);
  const kg = parseInt(inputKg.value||'0',10);
  return price*kg;
}

function recalc(){
  const price = parseInt(selSvc.options[selSvc.selectedIndex].dataset.price||'0',10);
  const kg    = parseInt(inputKg.value||'0',10);
  const disc  = parseInt(inputDisc.value||'0',10);
  inputPrice.value = price;
  const total = Math.max(0, price*kg - (isNaN(disc)?0:disc));
  inputTotal.value = 'Rp ' + total.toLocaleString('id-ID');

  if ((fCode.value || '').trim() !== '') {
    applyCode(true);
  }
}

async function applyCode(silent=false){
  const code = (fCode.value||'').trim().toUpperCase();
  if (code===''){ if(!silent) codeNote.textContent='Masukkan kode dulu.'; return; }
  const subtotal = currentSubtotal();
  if (subtotal<=0){ if(!silent) codeNote.textContent='Subtotal harus > 0.'; return; }

  const fd = new FormData();
  fd.append('action','apply_code');
  fd.append('code',code);
  fd.append('subtotal',String(subtotal));

  try{
    const res = await fetch('<?= h(base_url('dashboard.php')) ?>',{method:'POST',body:fd});
    const js = await res.json();
    if (js.ok){
      inputDisc.value = parseInt(js.discount||0,10);
      fCodeHidden.value = code;
      btnClearCode.style.display = '';
      codeNote.textContent = `Kode diterapkan: ${js.label} • Potongan Rp ${Number(js.discount).toLocaleString('id-ID')}`;
      inputDisc.readOnly = true;
    }else{
      if (!silent){
        inputDisc.value = 0;
        fCodeHidden.value = '';
        btnClearCode.style.display = 'none';
        codeNote.textContent = js.msg || 'Kode tidak valid.';
        inputDisc.readOnly = <?= $isStaff ? 'false' : 'true' ?>;
      }
    }
    const price = parseInt(selSvc.options[selSvc.selectedIndex].dataset.price||'0',10);
    const kg = parseInt(inputKg.value||'0',10);
    const disc = parseInt(inputDisc.value||'0',10);
    inputTotal.value = 'Rp ' + Math.max(0, price*kg - (isNaN(disc)?0:disc)).toLocaleString('id-ID');
  }catch(e){
    if(!silent) codeNote.textContent='Gagal memeriksa kode.';
  }
}

btnApplyCode.addEventListener('click', ()=>applyCode(false));
btnClearCode.addEventListener('click', ()=>{
  fCode.value=''; fCodeHidden.value=''; inputDisc.value=0; btnClearCode.style.display='none';
  codeNote.textContent='Gunakan kode yang kamu punya. Diskon dihitung otomatis.';
  inputDisc.readOnly = <?= $isStaff ? 'false' : 'true' ?>;
  recalc();
});

['change','input'].forEach(ev=>{
  selSvc.addEventListener(ev, recalc);
  inputKg.addEventListener(ev, recalc);
  inputDisc.addEventListener(ev, recalc);
});

btnAdd.addEventListener('click', ()=>{ 
  fCode.value=''; fCodeHidden.value=''; btnClearCode.style.display='none';
  codeNote.textContent='Gunakan kode yang kamu punya. Diskon dihitung otomatis.';
  inputDisc.value = 0;
  inputDisc.readOnly = <?= $isStaff ? 'false' : 'true' ?>;
  recalc();
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); 
});
btnClose?.addEventListener('click', ()=>{ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); });
modal.addEventListener('click', (e)=>{ if(e.target===modal) btnClose?.click(); });

// Dropdown Profil
const userBtn  = document.getElementById('userMenuBtn');
const userMenu = document.getElementById('userMenu');
userBtn?.addEventListener('click', (e)=>{ e.stopPropagation(); userMenu.classList.toggle('show'); });
document.addEventListener('click', (e)=>{ 
  if (!userMenu.contains(e.target) && !userBtn.contains(e.target)) userMenu.classList.remove('show');
});

/* =========================
   ANIMASI 3D & MICRO-INTERACTIONS
   (Tidak menyentuh logic/flow)
   ========================= */

// 3D tilt effect untuk kartu (ringan, tanpa lib)
(function(){
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;
  const maxTilt = 12; // derajat
  const tiltables = document.querySelectorAll('.tilt-3d, .card');

  tiltables.forEach(el=>{
    let raf = null;
    const set = (rx, ry)=>{
      el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      el.style.boxShadow = `0 20px 50px rgba(15,23,42,.12)`;
    };
    el.addEventListener('mousemove', (e)=>{
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top)  / r.height;
      const rx = (0.5 - y) * maxTilt;
      const ry = (x - 0.5) * maxTilt;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(()=> set(rx, ry));
    });
    el.addEventListener('mouseleave', ()=>{
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = '';
      el.style.boxShadow = '';
    });
  });
})();

// Confetti sederhana saat klik KPI Pendapatan/Pengeluaran
(function(){
  const rev = document.getElementById('kpi-revenue');
  if (!rev) return;
  rev.addEventListener('click', ()=>{
    spawnConfetti(36);
  });

  function spawnConfetti(n){
    const colors = ['#2563eb','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];
    for (let i=0;i<n;i++){
      const d = document.createElement('div');
      const size = 6 + Math.random()*10;
      d.style.position='fixed';
      d.style.top='-10vh';
      d.style.left=(5+Math.random()*90)+'vw';
      d.style.width=size+'px';
      d.style.height=(size*1.2)+'px';
      d.style.background=colors[(Math.random()*colors.length)|0];
      d.style.transform=`rotate(${Math.random()*360}deg)`;
      d.style.opacity='0.95';
      d.style.pointerEvents='none';
      d.style.zIndex='70';
      d.style.borderRadius='2px';
      d.style.animation=`confFall ${1200+Math.random()*600}ms linear forwards`;
      document.body.appendChild(d);
      setTimeout(()=>d.remove(), 2200);
    }
  }

  const style = document.createElement('style');
  style.textContent = `
  @keyframes confFall{
    to { transform: translateY(120vh) rotate(720deg); opacity:1; }
  }`;
  document.head.appendChild(style);
})();

// Highlight klik KPI Orders (pulse singkat)
document.getElementById('kpi-orders')?.addEventListener('click', function(){
  const el = this;
  el.animate([{boxShadow:'0 0 0 0 rgba(37,99,235,.45)'},{boxShadow:'0 0 0 18px rgba(37,99,235,0)'}],
    {duration:600, easing:'ease-out'});
});
</script>
</body>
</html>
