<?php
require_once __DIR__ . '/config.php';
require_login();

/* =========================
   UTIL
   ========================= */
if (!function_exists('h')) {
  function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
}

/* Helper avatar (cache-buster) */
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
$AVATAR  = avatar_url_dash((int)($_SESSION['user_id'] ?? 0));
$userId  = (int)($_SESSION['user_id'] ?? 0);

/* =========================
   RBAC & HELPERS
   ========================= */
$role       = $_SESSION['user_role'] ?? 'Customer';
$isStaff    = in_array($role, ['Admin','Owner','Staff'], true);
$isCustomer = !$isStaff;
$myName     = trim($_SESSION['user_name'] ?? '');

function qstring(array $extra = []) {
  $keep = ['q','status','start','end','view'];
  $curr = array_intersect_key($_GET, array_flip($keep));
  return http_build_query(array_merge($curr, $extra));
}

/* =========================
   VALIDATOR KODE VOUCHER/PROMO (SERVER-SIDE)
   return: [
     ok=>bool, msg=>string,
     discount=>int, label=>string, source=>'user_vouchers'|'promos',
     voucher_id=>int|null, promo_id=>int|null, type,value,min_spend,max_discount,expires_at
   ]
   ========================= */
function validate_voucher_code(mysqli $mysqli, int $userId, string $code, int $subtotal): array {
  $code = strtoupper(trim($code));
  if ($code === '' || $subtotal <= 0) return ['ok'=>false,'msg'=>'Kode/subtotal tidak valid'];

  // --- 1) Prioritas: user_vouchers (kode milik user) ---
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
      return [
        'ok'=>true,'discount'=>max(0,$disc),'label'=>$uv['name'],'source'=>'user_vouchers',
        'voucher_id'=>(int)$uv['id'],'promo_id'=>(int)($uv['promo_id'] ?? 0),'type'=>$type,'value'=>$val,
        'min_spend'=>$minSpend,'max_discount'=>$maxDisc,'expires_at'=>$uv['expires_at'] ?? null
      ];
    }
  }

  // --- 2) Fallback: promos (jika punya kolom code) ---
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
        return [
          'ok'=>true,'discount'=>max(0,$disc),'label'=>$pr['name'],'source'=>'promos',
          'voucher_id'=>null,'promo_id'=>(int)$pr['id'],'type'=>$type,'value'=>$val,
          'min_spend'=>$minSpend,'max_discount'=>$maxDisc,'expires_at'=>$pr['end_at'] ?? null
        ];
      }
    }
  }

  return ['ok'=>false,'msg'=>'Kode tidak ditemukan'];
}

/* =========================
   HANDLE POST (NO OUTPUT)
   ========================= */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  verify_csrf();
  $act = $_POST['action'] ?? '';

  // ====== AJAX: apply code (cek & hitung diskon) ======
  if ($act === 'apply_code') {
    header('Content-Type: application/json; charset=utf-8');
    $code = $_POST['code'] ?? '';
    $subtotal = (int)($_POST['subtotal'] ?? 0);
    $res = validate_voucher_code($mysqli, $userId, $code, $subtotal);
    echo json_encode($res); exit;
  }

  // ===== Kanban: move status (STAFF ONLY) =====
  if ($act === 'move_status') {
    header('Content-Type: application/json; charset=utf-8');
    if ($isCustomer) { echo json_encode(['ok'=>false,'msg'=>'unauthorized']); exit; }
    $id  = (int)($_POST['id'] ?? 0);
    $new = $_POST['status'] ?? '';
    if (!$id || !in_array($new, ['baru','proses','selesai','batal'], true)) {
      echo json_encode(['ok'=>false,'msg'=>'Param tidak valid']); exit;
    }
    $st = $mysqli->prepare("UPDATE orders SET status=?, finished_at=IF(?='selesai',IFNULL(finished_at,NOW()),finished_at) WHERE id=?");
    $st->bind_param('ssi', $new, $new, $id);
    $ok = $st->execute(); $st->close();
    echo json_encode(['ok'=>$ok]); exit;
  }

  // ===== Create (Customer boleh; status dipaksa 'baru') =====
  if ($act === 'create_order') {
    $customer = trim($_POST['customer_name'] ?? '');
    $phone    = trim($_POST['customer_phone'] ?? '');
    $addr     = trim($_POST['customer_address'] ?? '');
    $svcId    = (int)($_POST['service_id'] ?? 0);
    $kg       = max(1, (int)($_POST['weight_kg'] ?? 1));
    $disc     = max(0, (int)($_POST['discount'] ?? 0));
    $priceKg  = (int)($_POST['price_per_kg'] ?? 0);
    $codeIn   = strtoupper(trim($_POST['voucher_code'] ?? ''));
    $statusIn = $_POST['status'] ?? 'baru';
    $status   = $isStaff && in_array($statusIn, ['baru','proses','selesai','batal'], true) ? $statusIn : 'baru';

    if ($isCustomer) { $customer = $myName; }

    if ($customer !== '' && $svcId > 0) {
      if ($priceKg <= 0) {
        $st = $mysqli->prepare("SELECT price FROM services WHERE id=?");
        $st->bind_param('i',$svcId); $st->execute(); $st->bind_result($priceKg); $st->fetch(); $st->close();
        if (!$priceKg) $priceKg = 20000;
      }

      // Re-validasi kode di server (anti manipulasi)
      if ($codeIn !== '') {
        $subtotalNow = $kg * $priceKg;
        $chk = validate_voucher_code($mysqli, $userId, $codeIn, $subtotalNow);
        if ($chk['ok'] ?? false) {
          $disc = (int)$chk['discount'];
          $applied = $chk; // simpan untuk logging
        }
      }

      $total  = max(0, $kg*$priceKg - $disc);
      $code   = 'ORD-' . substr(date('YmdHis'),2,6) . strtoupper(substr(bin2hex(random_bytes(2)),0,3));
      $nowStr = (new DateTime())->format('Y-m-d H:i:s');
      $finished = ($status==='selesai') ? $nowStr : null;

      $st = $mysqli->prepare("INSERT INTO orders
        (order_code,customer_name,customer_phone,customer_address,service_id,weight_kg,price_per_kg,discount,total_amount,status,created_at,finished_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
      $st->bind_param('ssssiiiiisss',  $code,$customer,$phone,$addr,$svcId,$kg,$priceKg,$disc,$total,$status,$nowStr,$finished);
      $st->execute(); $st->close();

      // Tandai voucher terpakai + log claim (jika ada tabelnya dan kode valid dari user_vouchers/promos)
      if (!empty($applied)) {
        // user_vouchers -> set used_at + log
        if (($applied['source'] ?? '') === 'user_vouchers' && ($applied['voucher_id'] ?? 0)) {
          $uvId = (int)$applied['voucher_id']; $amount = (int)$applied['discount'];
          // set used_at
          $hasUV = $mysqli->query("SHOW TABLES LIKE 'user_vouchers'");
          if ($hasUV && $hasUV->num_rows) {
            $u = $mysqli->prepare("UPDATE user_vouchers SET used_at=NOW() WHERE id=? AND user_id=? AND used_at IS NULL");
            $u->bind_param('ii', $uvId, $userId); $u->execute(); $u->close();
          }
          // log claim
          $hasVC = $mysqli->query("SHOW TABLES LIKE 'voucher_claims'");
          if ($hasVC && $hasVC->num_rows) {
            $c = $mysqli->prepare("INSERT INTO voucher_claims (user_id, promo_id, voucher_id, source, amount) VALUES (?,?,?,?,?)");
            $src = 'code'; $pid = (int)($applied['promo_id'] ?? 0);
            $c->bind_param('iiisi', $userId, $pid, $uvId, $src, $amount);
            $c->execute(); $c->close();
          }
        } else {
          // dari promos (kode umum) -> hanya log (jika tabel ada)
          $hasVC = $mysqli->query("SHOW TABLES LIKE 'voucher_claims'");
          if ($hasVC && $hasVC->num_rows) {
            $c = $mysqli->prepare("INSERT INTO voucher_claims (user_id, promo_id, voucher_id, source, amount) VALUES (?,?,?,?,?)");
            $src = 'promo'; $pid = (int)($applied['promo_id'] ?? 0); $vid = null; $amount=(int)$applied['discount'];
            // NULL untuk voucher_id
            $c->bind_param('iiisi', $userId, $pid, $vid, $src, $amount);
            $c->execute(); $c->close();
          }
        }
      }
    }
    header('Location: '.base_url('pesanan.php').'?'.qstring()); exit;
  }

  // ===== Update (STAFF ONLY) =====
  if ($act === 'update_order') {
    if ($isCustomer) { header('Location: '.base_url('pesanan.php').'?'.qstring()); exit; }
    $id       = (int)($_POST['id'] ?? 0);
    $customer = trim($_POST['customer_name'] ?? '');
    $phone    = trim($_POST['customer_phone'] ?? '');
    $addr     = trim($_POST['customer_address'] ?? '');
    $svcId    = (int)($_POST['service_id'] ?? 0);
    $kg       = max(1, (int)($_POST['weight_kg'] ?? 1));
    $disc     = max(0, (int)($_POST['discount'] ?? 0));
    $priceKg  = (int)($_POST['price_per_kg'] ?? 0);
    $status   = $_POST['status'] ?? 'baru';
    if ($id>0 && $customer!=='' && $svcId>0 && in_array($status,['baru','proses','selesai','batal'],true)) {
      if ($priceKg <= 0) {
        $st = $mysqli->prepare("SELECT price FROM services WHERE id=?");
        $st->bind_param('i',$svcId); $st->execute(); $st->bind_result($priceKg); $st->fetch(); $st->close();
        if (!$priceKg) $priceKg = 20000;
      }
      $total = max(0, $kg*$priceKg - $disc);
      $st = $mysqli->prepare("UPDATE orders
        SET customer_name=?, customer_phone=?, customer_address=?, service_id=?, weight_kg=?, price_per_kg=?, discount=?, total_amount=?, status=?, finished_at=IF(?='selesai',IFNULL(finished_at,NOW()),finished_at)
        WHERE id=?");
      $st->bind_param('sssiiiiissi',  $customer,$phone,$addr,$svcId,$kg,$priceKg,$disc,$total,$status,$status,$id);
      $st->execute(); $st->close();
    }
    header('Location: '.base_url('pesanan.php').'?'.qstring()); exit;
  }

  // ===== Delete =====
  if ($act === 'delete_order') {
    $id = (int)($_POST['id'] ?? 0);
    if ($id>0) {
      if ($isStaff) {
        $st = $mysqli->prepare("DELETE FROM orders WHERE id=?");
        $st->bind_param('i',$id); $st->execute(); $st->close();
      } else {
        $st = $mysqli->prepare("SELECT status, customer_name FROM orders WHERE id=?");
        $st->bind_param('i',$id); $st->execute(); $st->bind_result($stt,$cust);
        if ($st->fetch() && $stt==='baru' && $cust===$myName) {
          $st->close();
          $d = $mysqli->prepare("DELETE FROM orders WHERE id=?");
          $d->bind_param('i',$id); $d->execute(); $d->close();
        } else { $st->close(); }
      }
    }
    header('Location: '.base_url('pesanan.php').'?'.qstring()); exit;
  }
}

/* =========================
   FILTER INPUT
   ========================= */
$view   = $_GET['view'] ?? 'table';
$q      = trim($_GET['q'] ?? '');
$status = $_GET['status'] ?? '';
$startS = $_GET['start'] ?? '';
$endS   = $_GET['end'] ?? '';

$start=$end=null;
if ($startS!=='' && $endS!=='') {
  $start = DateTime::createFromFormat('Y-m-d',$startS);
  $end   = DateTime::createFromFormat('Y-m-d',$endS);
  if ($start && $end) { $start->setTime(0,0,0); $end->setTime(23,59,59); } else { $start=$end=null; }
}

/* =========================
   MASTER LAYANAN
   ========================= */
$services=[];
$res=$mysqli->query("SELECT id,name,price FROM services WHERE is_active=1 ORDER BY id");
while($r=$res->fetch_assoc()) $services[(int)$r['id']]=$r;

/* =========================
   QUERY PESANAN
   ========================= */
$sql = "SELECT o.*, s.name AS service_name
        FROM orders o
        JOIN services s ON s.id=o.service_id
        WHERE 1 ";
$types=''; $params=[];

if ($isCustomer && $myName!=='') {
  $sql .= " AND o.customer_name = ?"; $types.='s'; $params[] = $myName;
}
if ($q!==''){
  $sql.=" AND (o.order_code LIKE CONCAT('%',?,'%') OR o.customer_name LIKE CONCAT('%',?,'%') OR s.name LIKE CONCAT('%',?,'%') OR o.customer_phone LIKE CONCAT('%',?,'%') OR o.customer_address LIKE CONCAT('%',?,'%'))";
  $types.='sssss'; array_push($params,$q,$q,$q,$q,$q);
}
if (in_array($status,['baru','proses','selesai','batal'],true)){
  $sql.=" AND o.status=?"; $types.='s'; $params[]=$status;
}
if ($start&&$end){
  $sql.=" AND o.created_at BETWEEN ? AND ?"; $types.='ss';
  $params[]=$start->format('Y-m-d H:i:s'); $params[]=$end->format('Y-m-d H:i:s');
}
$sql.=" ORDER BY o.created_at DESC LIMIT 300";

$orders=[];
$st=$mysqli->prepare($sql);
if($types) $st->bind_param($types, ...$params);
$st->execute(); $res=$st->get_result();
while($r=$res->fetch_assoc()) $orders[]=$r;
$st->close();

/* =========================
   META STATUS & KANBAN
   ========================= */
$statusMeta = [
  'baru'    => ['Baru',    '#2563eb'],
  'proses'  => ['Proses',  '#f59e0b'],
  'selesai' => ['Selesai', '#10b981'],
  'batal'   => ['Batal',   '#ef4444'],
];
$grouped=['baru'=>[], 'proses'=>[], 'selesai'=>[], 'batal'=>[]];
foreach($orders as $o) $grouped[$o['status']][]=$o;
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Embun Laundry · Pesanan</title>
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
      <a href="<?= base_url('dashboard.php')?>"><span>🏠</span> <span>Dashboard</span></a>
      <a class="active" href="<?= base_url('pesanan.php')?>"><span>🧺</span> <span>Pesanan</span></a>
      <a href="pelanggan.php"><span>👥</span> <span>Pelanggan</span></a>
      <a href="layanan.php"><span>💲</span> <span>Layanan & Harga</span></a>
      <a href="delivery.php"><span>🚚</span> <span>Pickup & Delivery</span></a>
      <a href="laporan.php"><span>📑</span> <span>Laporan</span></a>
      <a href="promo.php"><span>🎟️</span> <span>Promo & Diskon</span></a>
    </nav>

    <div class="nav sb-foot">
      <a href="profile.php"><span>👤</span> <span>Profil</span></a>
      <a href="settings.php"><span>⚙️</span> <span>Pengaturan</span></a>
      <a href="<?= base_url('auth/logout.php')?>"><span>🚪</span> <span>Keluar</span></a>
    </div>
  </aside>

  <section class="main">
    <div class="topbar">
      <div class="topbar-inner">
        <div class="search">🔎
          <form id="fsearch" style="display:flex;gap:10px;align-items:center;width:100%" method="get">
            <input type="hidden" name="view" value="<?= h($view) ?>">
            <input type="text" name="q" value="<?= h($q) ?>" placeholder="Cari pesanan, pelanggan, kontak, alamat…"/>
            <select name="status" class="btn">
              <option value="">Semua Status</option>
              <option value="baru"   <?= $status==='baru'?'selected':'' ?>>Baru</option>
              <option value="proses" <?= $status==='proses'?'selected':'' ?>>Proses</option>
              <option value="selesai"<?= $status==='selesai'?'selected':'' ?>>Selesai</option>
              <option value="batal"  <?= $status==='batal'?'selected':'' ?>>Batal</option>
            </select>
            <input type="date" name="start" value="<?= h($startS) ?>" class="btn" style="padding:.45rem .7rem">
            <input type="date" name="end"   value="<?= h($endS)   ?>" class="btn" style="padding:.45rem .7rem">
            <button class="btn">Filter</button>
          </form>
        </div>

        <button class="btn btn-primary" id="btnAdd">+ Tambah Pesanan</button>

        <!-- User area: avatar img + dropdown -->
        <div class="user" id="userArea">
          <img src="<?= h($AVATAR) ?>" alt="Avatar" class="avatar-img" id="userMenuBtn" width="34" height="34" loading="lazy"/>
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
      <div class="h1">Pesanan</div>
      <div class="sub">Kelola semua pesanan laundry</div>

      <div class="toolrow">
        <button class="tabbtn <?= $view==='table'?'active':'' ?>" onclick="switchView('table')">Tabel</button>
        <button class="tabbtn <?= $view==='kanban'?'active':'' ?>" onclick="switchView('kanban')">Kanban</button>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button id="btnExport" class="btn">⬇️ Export</button>
        </div>
      </div>

      <!-- VIEW: TABLE -->
      <div id="view-table" style="<?= $view==='table'?'':'display:none' ?>">
        <div class="card" style="padding:6px">
          <table class="table" id="tbl">
            <thead>
              <tr>
                <th>ID Order</th>
                <th>Pelanggan</th>
                <th>Layanan</th>
                <th>Berat (kg)</th>
                <th>Status</th>
                <th>Total (Rp)</th>
                <th>Pembayaran</th>
                <th>Tgl Masuk</th>
                <th>Estimasi Selesai</th>
                <th style="text-align:right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($orders as $o):
                $cls = $o['status']=='baru'?'bd-blue':($o['status']=='proses'?'bd-amber':($o['status']=='selesai'?'bd-green':'bd-red'));
                $pstat = $o['payment_status'] ?? 'unpaid';
                $payCls = ($pstat==='paid')?'bd-green':(($pstat==='partial')?'bd-amber':(($pstat==='refunded')?'bd-blue':'bd-red'));
                $isPaid = ($pstat==='paid') || ((int)($o['paid_amount']??0) >= (int)$o['total_amount']);
                $customerMayDelete = ($isCustomer && $o['status']==='baru' && $o['customer_name']===$myName);
              ?>
              <tr data-json='<?= h(json_encode($o)) ?>'>
                <td><?= h($o['order_code']) ?></td>
                <td>
                  <div style="font-weight:700"><?= h($o['customer_name']) ?></div>
                  <div class="sub">📞 <?= h($o['customer_phone'] ?? '-') ?></div>
                  <div class="sub">📍 <?= h($o['customer_address'] ?? '-') ?></div>
                </td>
                <td><?= h($o['service_name']) ?></td>
                <td><?= (int)$o['weight_kg'] ?></td>
                <td><span class="badge <?= $cls ?>"><?= ucfirst($o['status']) ?></span></td>
                <td><?= rupiah($o['total_amount']) ?></td>
                <td>
                  <span class="badge <?= $payCls ?>"><?= ucfirst($pstat) ?></span>
                  <?php if (!$isPaid && $o['status']!=='batal'): ?>
                    <a href="<?= base_url('pay.php').'?order_id='.(int)$o['id'] ?>" title="Bayar" style="margin-left:6px">💳</a>
                  <?php endif; ?>
                </td>
                <td><?= h(date('d/m/Y H:i', strtotime($o['created_at']))) ?></td>
                <td><?= $o['finished_at']? h(date('d/m/Y H:i', strtotime($o['finished_at']))): '-' ?></td>
                <td class="actions" style="text-align:right;white-space:nowrap">
                  <a href="#" class="act-view" title="Lihat">👁</a>
                  <?php if ($isStaff): ?>
                    <a href="#" class="act-edit" title="Ubah">✏️</a>
                    <form method="post" style="display:inline" onsubmit="return confirm('Hapus pesanan ini?')">
                      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
                      <input type="hidden" name="action" value="delete_order">
                      <input type="hidden" name="id" value="<?= (int)$o['id'] ?>">
                      <button title="Hapus">🗑️</button>
                    </form>
                  <?php elseif ($customerMayDelete): ?>
                    <form method="post" style="display:inline" onsubmit="return confirm('Batalkan pesanan ini?')">
                      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
                      <input type="hidden" name="action" value="delete_order">
                      <input type="hidden" name="id" value="<?= (int)$o['id'] ?>">
                      <button title="Batalkan">🗑️</button>
                    </form>
                  <?php endif; ?>
                </td>
              </tr>
              <?php endforeach; if(!$orders): ?>
                <tr><td colspan="10" class="sub" style="text-align:center;padding:28px">Belum ada data sesuai filter.</td></tr>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
      </div>

      <!-- VIEW: KANBAN -->
      <div id="view-kanban" style="<?= $view==='kanban'?'':'display:none' ?>">
        <div class="kanban">
          <?php foreach ($statusMeta as $key=>$meta): ?>
          <div class="kcol" data-status="<?= $key ?>">
            <div class="khead"><strong><?= $meta[0] ?></strong> <span class="sub">(<?= count($grouped[$key]) ?>)</span></div>
            <div class="klist">
              <?php foreach ($grouped[$key] as $o):
                $pstat = $o['payment_status'] ?? 'unpaid';
                $tag = $pstat==='paid' ? '✅ Lunas' : ($pstat==='partial'?'🟡 Partial':'🔴 Belum');
              ?>
              <div class="kcard" draggable="<?= $isStaff ? 'true':'false' ?>" data-id="<?= (int)$o['id'] ?>">
                <div style="font-weight:800"><?= h($o['order_code']) ?> • <?= h($o['service_name']) ?></div>
                <div class="sub"><?= h($o['customer_name']) ?> · <?= (int)$o['weight_kg'] ?> kg · <?= rupiah($o['total_amount']) ?> · <?= $tag ?></div>
                <div class="sub">📞 <?= h($o['customer_phone'] ?? '-') ?></div>
              </div>
              <?php endforeach; ?>
            </div>
          </div>
          <?php endforeach; ?>
        </div>
      </div>

    </div>
  </section>
</div>

<!-- MODAL: ADD / EDIT -->
<div class="modal" id="orderModal" aria-hidden="true">
  <div class="sheet">
    <h3 id="modalTitle">Tambah Pesanan</h3>
    <form method="post" id="orderForm">
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="action" value="create_order" id="formAction">
      <input type="hidden" name="id" id="orderId">
      <div class="row">
        <?php if ($isCustomer): ?>
          <div>
            <label>Pelanggan</label>
            <input class="input" value="<?= h($myName) ?>" readonly>
            <input type="hidden" name="customer_name" id="fCustomer" value="<?= h($myName) ?>">
          </div>
        <?php else: ?>
          <div><label>Pelanggan</label><input class="input" name="customer_name" id="fCustomer" required></div>
        <?php endif; ?>
        <div>
          <label>Kontak (HP/WA)</label>
          <input class="input" name="customer_phone" id="fPhone" placeholder="08xxxxxxxxxx">
        </div>
      </div>
      <div class="row">
        <div>
          <label>Alamat Lengkap</label>
          <textarea name="customer_address" id="fAddr" placeholder="Jalan, RT/RW, Kel/Desa, Kec, Kota/Kab"></textarea>
        </div>
        <div>
          <label>Layanan</label>
          <select class="input" name="service_id" id="fService" required>
            <?php foreach ($services as $sid=>$s): ?>
              <option value="<?= (int)$sid ?>" data-price="<?= (int)$s['price'] ?>"><?= h($s['name']) ?> (<?= rupiah($s['price']) ?>/kg)</option>
            <?php endforeach; ?>
          </select>
        </div>
      </div>

      <!-- KODE VOUCHER/PROMO -->
      <div class="row">
        <div>
          <label>Kode Voucher/Promo</label>
          <div style="display:flex;gap:8px">
            <input class="input" id="fCode" placeholder="Masukkan kode (cth: HEMAT20)" style="flex:1">
            <button type="button" class="btn" id="btnApplyCode">Terapkan</button>
            <button type="button" class="btn" id="btnClearCode" style="display:none">Hapus</button>
          </div>
          <input type="hidden" name="voucher_code" id="fCodeHidden">
          <div class="note" id="codeNote">Gunakan kode yang kamu punya. Diskon dihitung otomatis.</div>
        </div>
        <div>
          <label>Diskon (Rp)</label>
          <input class="input" type="number" min="0" step="1000" value="0" name="discount" id="fDisc" <?= $isStaff?'':'readonly' ?>>
        </div>
      </div>

      <div class="row">
        <div><label>Berat (kg)</label><input class="input" type="number" min="1" step="1" value="3" name="weight_kg" id="fKg" required></div>
        <div><label>Harga/kg</label><input class="input" type="number" name="price_per_kg" id="fPrice" readonly></div>
      </div>
      <div class="row">
        <div>
          <label>Status</label>
          <select class="input" name="status" id="fStatus" <?= $isStaff?'':'disabled' ?>>
            <option value="baru">Baru</option>
            <option value="proses">Proses</option>
            <option value="selesai">Selesai</option>
            <option value="batal">Batal</option>
          </select>
        </div>
        <div><label>Total</label><input class="input" type="text" id="fTotal" readonly></div>
      </div>

      <div class="actions">
        <button type="button" class="btn" id="btnClose">Batal</button>
        <button class="btn btn-primary" type="submit">Simpan</button>
      </div>
    </form>
  </div>
</div>

<script>
// Ripple
document.addEventListener('click', function(e){
  const btn = e.target.closest('.btn, .tabbtn'); if(!btn) return;
  const c = document.createElement('span'); const d=Math.max(btn.clientWidth,btn.clientHeight);
  c.className='ripple'; c.style.width=c.style.height=d+'px';
  c.style.left=(e.clientX-btn.getBoundingClientRect().left-d/2)+'px';
  c.style.top =(e.clientY-btn.getBoundingClientRect().top -d/2)+'px';
  btn.appendChild(c); setTimeout(()=>c.remove(),600);
});
function switchView(v){ const url=new URL(location.href); url.searchParams.set('view',v); location.href=url.toString(); }

// Export CSV
const ORDERS = <?= json_encode($orders, JSON_UNESCAPED_UNICODE) ?>;
document.getElementById('btnExport').addEventListener('click', ()=>{
  if(!ORDERS.length){ alert('Tidak ada data untuk diexport.'); return;}
  let csv=['ID,Customer,Kontak,Alamat,Layanan,kg,Status,Total,Payment,Masuk,Selesai'];
  for(const o of ORDERS){
    const p = (o.payment_status||'unpaid');
    csv.push(`"${o.order_code}","${o.customer_name}","${o.customer_phone||''}","${(o.customer_address||'').replace(/"/g,'""')}","${o.service_name}",${o.weight_kg},${o.status},${o.total_amount},${p},"${o.created_at}","${o.finished_at||''}"`);
  }
  const blob=new Blob([csv.join('\n')],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='pesanan.csv'; a.click();
});

// Modal add/edit
const modal=document.getElementById('orderModal'),
      btnAdd=document.getElementById('btnAdd'),
      btnClose=document.getElementById('btnClose');

const fService=document.getElementById('fService'),
      fKg=document.getElementById('fKg'),
      fDisc=document.getElementById('fDisc'),
      fPrice=document.getElementById('fPrice'),
      fTotal=document.getElementById('fTotal'),
      fStatus=document.getElementById('fStatus'),
      fCode=document.getElementById('fCode'),
      fCodeHidden=document.getElementById('fCodeHidden'),
      codeNote=document.getElementById('codeNote'),
      btnApplyCode=document.getElementById('btnApplyCode'),
      btnClearCode=document.getElementById('btnClearCode');

function currentSubtotal(){
  const price = parseInt(fService.options[fService.selectedIndex].dataset.price||'0',10);
  const kg = parseInt(fKg.value||'0',10);
  return price*kg;
}
function recalc(){
  const price = parseInt(fService.options[fService.selectedIndex].dataset.price||'0',10);
  const kg = parseInt(fKg.value||'0',10);
  const disc = parseInt((fDisc && fDisc.value)||'0',10);
  fPrice.value = price;
  const total = Math.max(0, price*kg - (isNaN(disc)?0:disc));
  fTotal.value = 'Rp ' + total.toLocaleString('id-ID');

  // Jika ada kode terisi, re-apply biar diskon sesuai subtotal terbaru (persentase)
  if ((fCode.value || '').trim() !== '') {
    applyCode(true);
  }
}

async function applyCode(silent=false){
  const code = (fCode.value||'').trim().toUpperCase();
  if (code===''){ if(!silent) { codeNote.textContent='Masukkan kode dulu.'; } return; }
  const subtotal = currentSubtotal();
  if (subtotal<=0){ if(!silent) { codeNote.textContent='Subtotal harus > 0.'; } return; }

  const fd = new FormData();
  fd.append('action','apply_code');
  fd.append('code',code);
  fd.append('subtotal',String(subtotal));
  fd.append('csrf_token', '<?= h(csrf_token()) ?>');

  try{
    const res = await fetch('<?= h(base_url('pesanan.php')) ?>',{method:'POST',body:fd});
    const js = await res.json();
    if (js.ok){
      fDisc.value = parseInt(js.discount||0,10);
      fCodeHidden.value = code; // ikut dikirim saat submit
      btnClearCode.style.display = '';
      codeNote.textContent = `Kode diterapkan: ${js.label} • Potongan Rp ${Number(js.discount).toLocaleString('id-ID')}`;
    }else{
      if (!silent){
        fDisc.value = 0;
        fCodeHidden.value = '';
        btnClearCode.style.display = 'none';
        codeNote.textContent = js.msg || 'Kode tidak valid.';
      }
    }
    // final update total
    const price = parseInt(fService.options[fService.selectedIndex].dataset.price||'0',10);
    const kg = parseInt(fKg.value||'0',10);
    const disc = parseInt(fDisc.value||'0',10);
    fTotal.value = 'Rp ' + Math.max(0, price*kg - (isNaN(disc)?0:disc)).toLocaleString('id-ID');
  }catch(e){
    if(!silent) codeNote.textContent='Gagal memeriksa kode.';
  }
}

btnApplyCode.addEventListener('click', ()=>applyCode(false));
btnClearCode.addEventListener('click', ()=>{
  fCode.value=''; fCodeHidden.value=''; fDisc.value=0; btnClearCode.style.display='none';
  codeNote.textContent='Gunakan kode yang kamu punya. Diskon dihitung otomatis.'; recalc();
});

['change','input'].forEach(ev=>{
  fService.addEventListener(ev,recalc);
  fKg.addEventListener(ev,recalc);
  fDisc && fDisc.addEventListener(ev,recalc);
});

btnAdd.addEventListener('click', ()=>{
  document.getElementById('modalTitle').textContent='Tambah Pesanan';
  document.getElementById('formAction').value='create_order';
  document.getElementById('orderId').value='';

  const cust = document.getElementById('fCustomer'); if (cust && !cust.readOnly) cust.value='';
  document.getElementById('fPhone').value='';
  document.getElementById('fAddr').value='';
  fService.selectedIndex=0; fKg.value=3; if(fDisc) fDisc.value=0; fStatus.value='baru';
  fCode.value=''; fCodeHidden.value=''; btnClearCode.style.display='none';
  codeNote.textContent='Gunakan kode yang kamu punya. Diskon dihitung otomatis.';
  recalc(); modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
});
btnClose.addEventListener('click', ()=>{ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); });
modal.addEventListener('click',(e)=>{ if(e.target===modal) btnClose.click(); });

// Tabel actions (view + edit)
document.querySelectorAll('#tbl tbody tr').forEach(tr=>{
  const data = JSON.parse(tr.dataset.json);
  tr.querySelector('.act-view').addEventListener('click', (e)=>{
    e.preventDefault();
    const paid = (data.payment_status||'unpaid');
    alert(
      `Order: ${data.order_code}\n`+
      `Pelanggan: ${data.customer_name}\n`+
      `Kontak: ${data.customer_phone||'-'}\n`+
      `Alamat: ${data.customer_address||'-'}\n`+
      `Layanan: ${data.service_name}\n`+
      `Berat: ${data.weight_kg} kg\n`+
      `Total: Rp ${Number(data.total_amount).toLocaleString('id-ID')}\n`+
      `Status: ${data.status}\n`+
      `Pembayaran: ${paid}`
    );
  });

  const eb = tr.querySelector('.act-edit');
  if(eb){
    eb.addEventListener('click',(e)=>{
      e.preventDefault();
      document.getElementById('modalTitle').textContent='Ubah Pesanan';
      document.getElementById('formAction').value='update_order';
      document.getElementById('orderId').value=data.id;

      const cust = document.getElementById('fCustomer');
      if (cust && !cust.readOnly) cust.value=data.customer_name;
      document.getElementById('fPhone').value = data.customer_phone || '';
      document.getElementById('fAddr').value  = data.customer_address || '';

      const opt=[...fService.options].find(o=>parseInt(o.value,10)===parseInt(data.service_id,10));
      if(opt){ fService.value=opt.value; }
      fKg.value=data.weight_kg;
      if (fDisc) fDisc.value=data.discount;
      fStatus.value=data.status;

      // reset kode saat edit (biar diskon manual dari DB dipakai)
      fCode.value=''; fCodeHidden.value=''; btnClearCode.style.display='none';
      codeNote.textContent='Gunakan kode yang kamu punya. Diskon dihitung otomatis.';

      recalc(); modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
    });
  }
});

// Kanban drag (hanya staff)
<?php if ($isStaff): ?>
let dragEl=null;
document.querySelectorAll('.kcard').forEach(card=>{
  card.addEventListener('dragstart',()=>{ dragEl=card; card.classList.add('drag'); });
  card.addEventListener('dragend',  ()=>{ card.classList.remove('drag'); dragEl=null; });
});
document.querySelectorAll('.kcol').forEach(col=>{
  col.addEventListener('dragover', e=>{ e.preventDefault(); col.classList.add('kdrop'); });
  col.addEventListener('dragleave',e=>{ col.classList.remove('kdrop'); });
  col.addEventListener('drop', async e=>{
    e.preventDefault(); col.classList.remove('kdrop'); if(!dragEl) return;
    col.querySelector('.klist').appendChild(dragEl);
    const fd=new FormData(); fd.append('action','move_status'); fd.append('id',dragEl.dataset.id); fd.append('status',col.dataset.status); fd.append('csrf_token', '<?= h(csrf_token()) ?>');
    try{
      const res=await fetch('<?= h(base_url('pesanan.php')) ?>',{method:'POST',body:fd});
      const js=await res.json(); if(!js.ok) alert('Gagal update status');
    }catch{ alert('Gagal update status'); }
  });
});
<?php endif; ?>

// Dropdown profil
const userBtn  = document.getElementById('userMenuBtn');
const userMenu = document.getElementById('userMenu');
userBtn?.addEventListener('click', (e)=>{ e.stopPropagation(); userMenu.classList.toggle('show'); });
document.addEventListener('click', (e)=>{ 
  if (!userMenu.contains(e.target) && !userBtn.contains(e.target)) userMenu.classList.remove('show');
});

/* ==== ANIMASI 3D & MICRO-INTERACTION (UI ONLY) ==== */
/* 3D tilt interaktif (tanpa ubah logic) */
(function(){
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  function attachTilt(el, maxDeg = 8){
    let rAF = null;
    const rect = ()=>el.getBoundingClientRect();
    function onMove(e){
      const rc = rect();
      const cx = rc.left + rc.width/2;
      const cy = rc.top  + rc.height/2;
      const dx = (e.clientX - cx) / (rc.width/2);
      const dy = (e.clientY - cy) / (rc.height/2);
      const rx = clamp((-dy)*maxDeg, -maxDeg, maxDeg);
      const ry = clamp((dx)*maxDeg,  -maxDeg, maxDeg);
      if (rAF) cancelAnimationFrame(rAF);
      rAF = requestAnimationFrame(()=>{
        el.style.transform = `translateZ(${getComputedStyle(el).transform.includes('translateZ') ? '' : '0px'}) rotateX(${rx}deg) rotateY(${ry}deg)`;
      });
    }
    function reset(){ el.style.transform = ''; }
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', reset);
  }
  document.querySelectorAll('.card').forEach(el => attachTilt(el, 6));
  document.querySelectorAll('.kcard').forEach(el => attachTilt(el, 10));
  document.querySelectorAll('#tbl tbody tr').forEach(el => attachTilt(el, 4));
})();

/* Confetti emoji di tombol Export (UI only, tidak ganggu proses export) */
(function(){
  const btn = document.getElementById('btnExport');
  if(!btn) return;
  btn.addEventListener('click', ()=>{
    const cont = document.createElement('div');
    cont.className = 'confetti';
    document.body.appendChild(cont);
    const EMO = ['✨','🧺','💧','🫧','🌟'];

    const pieces = 28;
    for(let i=0;i<pieces;i++){
      const s = document.createElement('div');
      s.className = 'piece';
      s.textContent = EMO[i%EMO.length];
      const left = Math.random()*100;
      const delay = Math.random()*120;
      const time = 900 + Math.random()*900;
      const rot  = (Math.random()*360)|0;
      const rot2 = rot + (180 + Math.random()*360);
      s.style.left = left + 'vw';
      s.style.setProperty('--t', time+'ms');
      s.style.setProperty('--x', (Math.random()*40 - 20)+'px');
      s.style.setProperty('--r', rot+'deg');
      s.style.setProperty('--rr', rot2+'deg');
      s.style.animationDelay = delay+'ms';
      cont.appendChild(s);
    }
    setTimeout(()=>cont.remove(), 2400);
  });
})();

/* Micro: elevasi tombol/tab saat hover (tanpa ganggu ripple bawaan) */
(function(){
  const pressable = document.querySelectorAll('.btn, .tabbtn');
  pressable.forEach(b=>{
    b.addEventListener('mouseenter', ()=> b.style.boxShadow = '0 12px 24px rgba(15,23,42,.08)');
    b.addEventListener('mouseleave', ()=> b.style.boxShadow = '');
  });
})();

/* Bonus: auto-tilt ringan pada modal sheet saat mouse bergerak di atasnya */
(function(){
  const sheet = document.querySelector('.modal .sheet');
  if(!sheet) return;
  const max = 6;
  function move(e){
    const r = sheet.getBoundingClientRect();
    const dx = ((e.clientX - (r.left + r.width/2)) / r.width) * 2;
    const dy = ((e.clientY - (r.top  + r.height/2)) / r.height) * 2;
    sheet.style.transform = `rotateX(${-dy*max}deg) rotateY(${dx*max}deg)`;
  }
  function reset(){ sheet.style.transform = ''; }
  sheet.addEventListener('mousemove', move);
  sheet.addEventListener('mouseleave', reset);
})();
</script>
</body>
</html>
