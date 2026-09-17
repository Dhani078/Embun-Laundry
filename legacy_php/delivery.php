<?php require_once __DIR__ . '/config.php'; require_login();

/* =========================
   RBAC
   ========================= */
$role       = $_SESSION['user_role'] ?? 'Customer';
$isStaff    = in_array($role, ['Admin','Owner','Staff'], true);
$isCustomer = !$isStaff;

/* =========================
   Helpers
   ========================= */
if (!function_exists('h')) {
  function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
}
/* Avatar helper (cache-buster) */
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
  $keep = ['tab','date','q','status'];
  $curr = array_intersect_key($_GET, array_flip($keep));
  return http_build_query(array_merge($curr, $extra));
}
function new_task_code(mysqli $db, string $type): string {
  $prefix = $type === 'delivery' ? 'DL-' : 'PU-';
  $st = $db->prepare("SELECT MAX(CAST(SUBSTRING_INDEX(task_code,'-',-1) AS UNSIGNED)) AS mx FROM pickup_delivery WHERE type=? AND task_code LIKE CONCAT(?, '%')");
  $st->bind_param('ss', $type, $prefix);
  $st->execute(); $r=$st->get_result()->fetch_assoc(); $st->close();
  $n = (int)($r['mx'] ?? 0);
  return $prefix . str_pad((string)($n+1), 3, '0', STR_PAD_LEFT);
}
function next_status(string $curr): string {
  $flow = ['scheduled'=>'assigned','assigned'=>'onroute','onroute'=>'completed'];
  return $flow[$curr] ?? $curr;
}

/* =========================
   POST (AJAX + FORM)
   ========================= */
if ($_SERVER['REQUEST_METHOD']==='POST') {
  $act = $_POST['action'] ?? '';

  /* ====== TASK CRUD ====== */
  if ($act==='create_task' && $isStaff) {
    $type   = in_array($_POST['type']??'pickup',['pickup','delivery'],true) ? $_POST['type'] : 'pickup';
    $code   = trim($_POST['task_code'] ?? '') ?: new_task_code($mysqli,$type);
    $order  = trim($_POST['order_code'] ?? '');
    $name   = trim($_POST['customer_name'] ?? '');
    $phone  = trim($_POST['phone'] ?? '');
    $addr   = trim($_POST['address'] ?? '');
    $cid    = (int)($_POST['courier_id'] ?? 0);
    $date   = trim($_POST['schedule_date'] ?? date('Y-m-d'));
    $t1     = trim($_POST['start_time'] ?? '');
    $t2     = trim($_POST['end_time'] ?? '');
    $notes  = trim($_POST['notes'] ?? '');
    $status = $cid>0 ? 'assigned' : 'scheduled';

    if ($name!=='') {
      $st = $mysqli->prepare("INSERT INTO pickup_delivery
        (task_code,type,order_code,customer_name,phone,address,status,courier_id,schedule_date,start_time,end_time,notes)
        VALUES (?,?,?,?,?,?,?,NULLIF(?,0),?,NULLIF(?,''),NULLIF(?,''),NULLIF(?,''))");
      $st->bind_param('ssssssisssss', $code,$type,$order,$name,$phone,$addr,$status,$cid,$date,$t1,$t2,$notes);
      $st->execute(); $st->close();
    }
    header('Location: '.base_url('delivery.php').'?'.qstring()); exit;
  }

  if ($act==='update_task' && $isStaff) {
    $id     = (int)($_POST['id'] ?? 0);
    $type   = in_array($_POST['type']??'pickup',['pickup','delivery'],true) ? $_POST['type'] : 'pickup';
    $order  = trim($_POST['order_code'] ?? '');
    $name   = trim($_POST['customer_name'] ?? '');
    $phone  = trim($_POST['phone'] ?? '');
    $addr   = trim($_POST['address'] ?? '');
    $status = in_array($_POST['status']??'scheduled',['scheduled','assigned','onroute','completed','cancelled'],true) ? $_POST['status'] : 'scheduled';
    $cid    = (int)($_POST['courier_id'] ?? 0);
    $date   = trim($_POST['schedule_date'] ?? date('Y-m-d'));
    $t1     = trim($_POST['start_time'] ?? '');
    $t2     = trim($_POST['end_time'] ?? '');
    $notes  = trim($_POST['notes'] ?? '');
    if ($id>0 && $name!=='') {
      $now = (new DateTime())->format('Y-m-d H:i:s');
      $st = $mysqli->prepare("UPDATE pickup_delivery SET
        type=?, order_code=?, customer_name=?, phone=?, address=?, status=?,
        courier_id=NULLIF(?,0), schedule_date=?, start_time=NULLIF(?,''), end_time=NULLIF(?,''), notes=NULLIF(?,''), updated_at=?
        WHERE id=?");
      $st->bind_param('ssssssissssssi', $type,$order,$name,$phone,$addr,$status,$cid,$date,$t1,$t2,$notes,$now,$id);
      $st->execute(); $st->close();
    }
    header('Location: '.base_url('delivery.php').'?'.qstring()); exit;
  }

  if ($act==='delete_task' && $isStaff) {
    $id = (int)($_POST['id'] ?? 0);
    if ($id>0) { $st=$mysqli->prepare("DELETE FROM pickup_delivery WHERE id=?"); $st->bind_param('i',$id); $st->execute(); $st->close(); }
    header('Location: '.base_url('delivery.php').'?'.qstring()); exit;
  }

  if ($act==='assign_courier' && $isStaff) {
    header('Content-Type: application/json; charset=utf-8');
    $id  = (int)($_POST['id'] ?? 0);
    $cid = (int)($_POST['courier_id'] ?? 0);
    $now = (new DateTime())->format('Y-m-d H:i:s');
    $st  = $mysqli->prepare("UPDATE pickup_delivery SET courier_id=NULLIF(?,0), status=IF(NULLIF(?,0) IS NULL, status, IF(status='scheduled','assigned',status)), updated_at=? WHERE id=?");
    $st->bind_param('iisi', $cid,$cid,$now,$id);
    $ok=$st->execute(); $st->close();
    echo json_encode(['ok'=>$ok]); exit;
  }

  if ($act==='advance_status' && $isStaff) {
    header('Content-Type: application/json; charset=utf-8');
    $id=(int)($_POST['id'] ?? 0);
    $st=$mysqli->prepare("SELECT status FROM pickup_delivery WHERE id=?"); $st->bind_param('i',$id); $st->execute(); $st->bind_result($s); $st->fetch(); $st->close();
    if ($s) {
      $ns = next_status($s);
      if ($ns !== $s) {
        $now=(new DateTime())->format('Y-m-d H:i:s');
        $u=$mysqli->prepare("UPDATE pickup_delivery SET status=?, updated_at=? WHERE id=?");
        $u->bind_param('ssi',$ns,$now,$id); $ok=$u->execute(); $u->close();
        echo json_encode(['ok'=>$ok,'status'=>$ns]); exit;
      }
    }
    echo json_encode(['ok'=>false]); exit;
  }

  if ($act==='cancel_task' && $isStaff) {
    header('Content-Type: application/json; charset=utf-8');
    $id=(int)($_POST['id'] ?? 0);
    $now=(new DateTime())->format('Y-m-d H:i:s');
    $u=$mysqli->prepare("UPDATE pickup_delivery SET status='cancelled', updated_at=? WHERE id=?");
    $u->bind_param('si',$now,$id); $ok=$u->execute(); $u->close();
    echo json_encode(['ok'=>$ok]); exit;
  }

  /* ====== COURIER CRUD (ringkas di halaman ini) ====== */
  if ($act==='create_courier' && $isStaff) {
    $code  = trim($_POST['code'] ?? '');
    $name  = trim($_POST['full_name'] ?? '');
    $phone = trim($_POST['phone'] ?? '');
    $veh   = trim($_POST['vehicle'] ?? '');
    $actv  = (int)($_POST['is_active'] ?? 1);
    $rate  = strlen($_POST['rating'] ?? '') ? (float)$_POST['rating'] : null;
    if ($name!=='') {
      $st=$mysqli->prepare("INSERT INTO couriers(code,full_name,phone,vehicle,is_active,rating) VALUES (?,?,?,?,?,NULLIF(?,0.0))");
      $st->bind_param('ssssis', $code,$name,$phone,$veh,$actv,$rate);
      $st->execute(); $st->close();
    }
    header('Location: '.base_url('delivery.php').'?tab=kurir'); exit;
  }

  if ($act==='update_courier' && $isStaff) {
    $id    = (int)($_POST['id'] ?? 0);
    $code  = trim($_POST['code'] ?? '');
    $name  = trim($_POST['full_name'] ?? '');
    $phone = trim($_POST['phone'] ?? '');
    $veh   = trim($_POST['vehicle'] ?? '');
    $actv  = (int)($_POST['is_active'] ?? 1);
    $rate  = strlen($_POST['rating'] ?? '') ? (float)$_POST['rating'] : null;
    if ($id>0 && $name!=='') {
      $now=(new DateTime())->format('Y-m-d H:i:s');
      $st=$mysqli->prepare("UPDATE couriers SET code=?, full_name=?, phone=?, vehicle=?, is_active=?, rating=NULLIF(?,0.0), updated_at=? WHERE id=?");
      $rateStr = $rate===null ? '0.0' : (string)$rate;
      $st->bind_param('ssssissi',$code,$name,$phone,$veh,$actv,$rateStr,$now,$id);
      $st->execute(); $st->close();
    }
    header('Location: '.base_url('delivery.php').'?tab=kurir'); exit;
  }

  if ($act==='delete_courier' && $isStaff) {
    $id=(int)($_POST['id'] ?? 0);
    if ($id>0) { $st=$mysqli->prepare("DELETE FROM couriers WHERE id=?"); $st->bind_param('i',$id); $st->execute(); $st->close(); }
    header('Location: '.base_url('delivery.php').'?tab=kurir'); exit;
  }
}

/* =========================
   FILTERS
   ========================= */
$tab   = $_GET['tab'] ?? 'pickup';
$dateS = trim($_GET['date'] ?? date('Y-m-d'));
$q     = trim($_GET['q'] ?? '');
$status= trim($_GET['status'] ?? '');

/* =========================
   KPI
   ========================= */
$today = date('Y-m-d');
$kpi = [
  'pickup_today'   => 0,
  'delivery_today' => 0,
  'courier_active' => 0,
  'avg_rating'     => 0,
];
$kpi['pickup_today']   = (int)($mysqli->query("SELECT COUNT(*) c FROM pickup_delivery WHERE type='pickup' AND schedule_date='{$today}'")->fetch_assoc()['c'] ?? 0);
$kpi['delivery_today'] = (int)($mysqli->query("SELECT COUNT(*) c FROM pickup_delivery WHERE type='delivery' AND schedule_date='{$today}'")->fetch_assoc()['c'] ?? 0);
$kpi['courier_active'] = (int)($mysqli->query("SELECT COUNT(*) c FROM couriers WHERE is_active=1")->fetch_assoc()['c'] ?? 0);
$r = $mysqli->query("SELECT ROUND(AVG(rating),1) r FROM couriers WHERE rating IS NOT NULL");
if ($r) { $row=$r->fetch_assoc(); $kpi['avg_rating'] = (float)($row['r'] ?? 0); $r->close(); }

/* =========================
   MASTER LIST
   ========================= */
$couriers=[];
$res=$mysqli->query("SELECT id, code, full_name, phone, vehicle, is_active, rating FROM couriers ORDER BY is_active DESC, full_name ASC");
while($r=$res->fetch_assoc()) $couriers[]=$r;

/* =========================
   ORDER OPTIONS untuk autofill Jadwalkan
   ========================= */
$orderOptions=[];
$qr = $mysqli->query("SELECT order_code, customer_name, customer_phone, customer_address, status
                      FROM orders
                      WHERE status!='batal'
                      ORDER BY id DESC
                      LIMIT 100");
while($o=$qr->fetch_assoc()) $orderOptions[]=$o;

/* =========================
   QUERY TASK LIST
   ========================= */
$tasks=[];
if ($tab!=='kurir') {
  $sql = "SELECT pd.*, c.full_name AS courier_name, c.phone AS courier_phone
          FROM pickup_delivery pd
          LEFT JOIN couriers c ON c.id=pd.courier_id
          WHERE 1 ";
  $types=''; $params=[];
  if (in_array($tab,['pickup','delivery'],true)) { $sql.=" AND pd.type=?"; $types.='s'; $params[]=$tab; }
  if ($dateS!=='') { $sql.=" AND pd.schedule_date=?"; $types.='s'; $params[]=$dateS; }
  if ($q!=='') {
    $sql.=" AND (pd.task_code LIKE CONCAT('%',?,'%') OR pd.order_code LIKE CONCAT('%',?,'%') OR pd.customer_name LIKE CONCAT('%',?,'%') OR pd.address LIKE CONCAT('%',?,'%'))";
    $types.='ssss'; array_push($params,$q,$q,$q,$q);
  }
  if (in_array($status,['scheduled','assigned','onroute','completed','cancelled'],true)) { $sql.=" AND pd.status=?"; $types.='s'; $params[]=$status; }
  $sql.=" ORDER BY FIELD(pd.status,'scheduled','assigned','onroute','completed','cancelled'), pd.start_time IS NULL, pd.start_time ASC, pd.id ASC";
  $st=$mysqli->prepare($sql);
  if ($types) {
    $bind=[$types];
    foreach($params as $k=>$p){ $bind[]=&$params[$k]; }
    call_user_func_array([$st,'bind_param'],$bind);
  }
  $st->execute(); $res=$st->get_result();
  while($r=$res->fetch_assoc()) $tasks[]=$r;
  $st->close();
} ?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Embun Laundry · Penjemputan & Pengantaran</title>
<link rel="stylesheet" href="assets/style.css"/>
</head>
<body>
<div class="wrap">
  <aside class="sidebar">
    <div class="brand">
      <img
        src="img/Logo.png"
        alt="Embun Laundry"
        class="logo-img"
        width="36" height="36"
        decoding="async" fetchpriority="high"
      />
      <div class="name">Embun Laundry</div>
    </div>
    <nav class="nav">
      <a href="<?= base_url('dashboard.php')?>"><span>🏠</span><span>Dashboard</span></a>
      <a href="<?= base_url('pesanan.php')?>"><span>🧺</span><span>Pesanan</span></a>
      <a href="<?= base_url('pelanggan.php')?>"><span>👥</span><span>Pelanggan</span></a>
      <a href="<?= base_url('layanan.php')?>"><span>💲</span><span>Layanan & Harga</span></a>
      <a class="active" href="<?= base_url('delivery.php')?>"><span>🚚</span><span>Pickup & Delivery</span></a>
      <a href="laporan.php"><span>📑</span><span>Laporan</span></a>
      <a href="promo.php"><span>🎟️</span><span>Promo & Diskon</span></a>
    </nav>

    <!-- Footer kiri bawah -->
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
            <input type="date" name="date" value="<?= h($dateS) ?>" class="btn" style="padding:.45rem .7rem">
            <select name="status" class="btn">
              <option value="">Semua Status</option>
              <?php foreach(['scheduled'=>'Dijadwalkan','assigned'=>'Dalam Penugasan','onroute'=>'Dalam Perjalanan','completed'=>'Selesai','cancelled'=>'Dibatalkan'] as $k=>$v): ?>
                <option value="<?= $k ?>" <?= $status===$k?'selected':'' ?>><?= $v ?></option>
              <?php endforeach; ?>
            </select>
            <input type="text" name="q" value="<?= h($q) ?>" placeholder="Cari kode/order/nama/alamat…"/>
            <button class="btn">Filter</button>
          </form>
        </div>

        <?php if ($isStaff && $tab!=='kurir'): ?>
          <button type="button" class="btn btn-primary" id="btnAdd">+ Jadwalkan</button>
        <?php endif; ?>
        <?php if ($isStaff && $tab==='kurir'): ?>
          <button type="button" class="btn btn-primary" id="btnAddCourier">+ Tambah Kurir</button>
        <?php endif; ?>

        <!-- User area (avatar image + dropdown) -->
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
      <div class="h1">Penjemputan & Pengantaran</div>
      <div class="sub">Kelola jadwal pickup dan delivery</div>

      <div class="kpis">
        <div class="kpi"><div class="title">Pickup Hari Ini</div><div class="val"><?= (int)$kpi['pickup_today'] ?></div><div class="mini">🧺</div><div class="blob bl-blue"></div></div>
        <div class="kpi"><div class="title">Delivery Hari Ini</div><div class="val"><?= (int)$kpi['delivery_today'] ?></div><div class="mini">📦</div><div class="blob bl-green"></div></div>
        <div class="kpi" data-v="courier"><div class="title">Kurir Aktif</div><div class="val"><?= (int)$kpi['courier_active'] ?></div><div class="mini">👤</div><div class="blob bl-violet"></div></div>
        <div class="kpi"><div class="title">Rata-rata Rating</div><div class="val"><?= number_format($kpi['avg_rating'],1) ?></div><div class="mini">⭐</div><div class="blob bl-amber"></div></div>
      </div>

      <div class="tabs">
        <a class="tab <?= $tab==='pickup'?'active':'' ?>" href="?<?= qstring(['tab'=>'pickup']) ?>">Pickup</a>
        <a class="tab <?= $tab==='delivery'?'active':'' ?>" href="?<?= qstring(['tab'=>'delivery']) ?>">Delivery</a>
        <a class="tab <?= $tab==='kurir'?'active':'' ?>" href="?<?= qstring(['tab'=>'kurir']) ?>">Kurir</a>
      </div>

      <?php if ($tab==='kurir'): ?>
        <div class="card">
          <div class="list">
            <?php foreach($couriers as $c): ?>
            <div class="item">
              <div>
                <div style="font-weight:900"><?= h($c['full_name']) ?> <?= $c['is_active']?'<span class="badge bd-as">Aktif</span>':'<span class="badge bd-cxl">Nonaktif</span>' ?></div>
                <div class="sub">ID: <?= h($c['code'] ?: '-') ?> • 📞 <?= h($c['phone'] ?: '-') ?> • 🚲 <?= h($c['vehicle'] ?: '-') ?> • ⭐ <?= h($c['rating']!==null? $c['rating']:'-') ?></div>
              </div>
              <?php if ($isStaff): ?>
              <div class="actions">
                <button class="btn act-edit-courier" data-json='<?= h(json_encode($c)) ?>'>Edit</button>
                <form method="post" onsubmit="return confirm('Hapus kurir ini?')">
                  <input type="hidden" name="action" value="delete_courier">
                  <input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
                  <button class="btn">Hapus</button>
                </form>
              </div>
              <?php endif; ?>
            </div>
            <?php endforeach; if(!$couriers): ?>
              <div class="sub">Belum ada kurir.</div>
            <?php endif; ?>
          </div>
        </div>
      <?php else: ?>
        <div class="card">
          <div class="list">
          <?php foreach($tasks as $t):
            $b = $t['status']=='scheduled' ? 'bd-st' : ($t['status']=='assigned' ? 'bd-as' : ($t['status']=='onroute'?'bd-or':($t['status']=='completed'?'bd-done':'bd-cxl')));
            $timeTxt = ($t['start_time']?substr($t['start_time'],0,5):'--:--').' - '.($t['end_time']?substr($t['end_time'],0,5):'--:--');
          ?>
            <div class="item" data-json='<?= h(json_encode($t)) ?>'>
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="font-weight:900"><?= h($t['task_code']) ?></div>
                  <span class="badge <?= $b ?>"><?= ucfirst($t['status']) ?></span>
                  <?php if ($t['order_code']): ?><span class="badge bd-st">ORD: <?= h($t['order_code']) ?></span><?php endif; ?>
                </div>
                <div style="margin-top:4px">
                  <div style="font-weight:800"><?= h($t['customer_name']) ?></div>
                  <div class="sub">📞 <?= h($t['phone']?:'-') ?> • 📍 <?= h($t['address']?:'-') ?></div>
                  <div class="sub">🗓 <?= h(date('d/m/Y',strtotime($t['schedule_date']))) ?> • ⏰ <?= h($timeTxt) ?><?= $t['courier_name'] ? " • 🚚 {$t['courier_name']}" : '' ?></div>
                  <?php if ($t['notes']): ?><div class="sub">📝 <?= h($t['notes']) ?></div><?php endif; ?>
                </div>
              </div>
              <div class="actions">
                <?php if ($isStaff): ?>
                  <?php if (!$t['courier_id']): ?>
                    <button class="btn act-assign">Assign Kurir</button>
                  <?php endif; ?>
                  <?php if (in_array($t['status'],['scheduled','assigned','onroute'],true)): ?>
                    <button class="btn act-advance">Next</button>
                    <button class="btn act-cancel">Batalkan</button>
                  <?php endif; ?>
                  <button class="btn act-edit">Edit</button>
                  <form method="post" onsubmit="return confirm('Hapus jadwal ini?')">
                    <input type="hidden" name="action" value="delete_task">
                    <input type="hidden" name="id" value="<?= (int)$t['id'] ?>">
                    <button class="btn">Hapus</button>
                  </form>
                <?php endif; ?>
              </div>
            </div>
          <?php endforeach; if(!$tasks): ?>
            <div class="sub">Tidak ada data untuk tanggal/ filter ini.</div>
          <?php endif; ?>
          </div>
        </div>
      <?php endif; ?>
    </div>
  </section>
</div>

<!-- MODAL TASK -->
<div class="modal" id="taskModal" aria-hidden="true">
  <div class="sheet">
    <h3 id="taskTitle">Jadwalkan</h3>
    <form method="post" id="taskForm">
      <input type="hidden" name="action" value="create_task" id="taskAction">
      <input type="hidden" name="id" id="taskId">

      <!-- Ambil data dari PESANAN (autofill) -->
      <div class="row">
        <div>
          <label>Ambil dari Pesanan</label>
          <select class="input" id="selOrder">
            <option value="">— pilih pesanan —</option>
            <?php foreach($orderOptions as $o): ?>
              <option
                value="<?= h($o['order_code']) ?>"
                data-name="<?= h($o['customer_name']) ?>"
                data-phone="<?= h($o['customer_phone']) ?>"
                data-addr="<?= h($o['customer_address']) ?>"
              ><?= h(($o['order_code']?:'INV')." • ".($o['customer_name']?:'-')) ?></option>
            <?php endforeach; ?>
          </select>
          <div class="sub">Memilih pesanan akan mengisi Nama, HP, Alamat & Kode Order otomatis.</div>
        </div>
      </div>

      <div class="row">
        <div>
          <label>Jenis</label>
          <select class="input" name="type" id="fType">
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </div>
        <div><label>Kode Tugas (opsional)</label><input class="input" name="task_code" id="fCode" placeholder="PU-xxx / DL-xxx"></div>
        <div><label>Kode Order (opsional)</label><input class="input" name="order_code" id="fOrder"></div>
      </div>
      <div class="row">
        <div><label>Nama Pelanggan</label><input class="input" name="customer_name" id="fName" required></div>
        <div><label>No. HP</label><input class="input" name="phone" id="fPhone"></div>
      </div>
      <div class="row">
        <div><label>Alamat</label><textarea class="input" name="address" id="fAddr" rows="2"></textarea></div>
      </div>
      <div class="row">
        <div><label>Tanggal</label><input class="input" type="date" name="schedule_date" id="fDate" value="<?= h($dateS) ?>"></div>
        <div><label>Mulai</label><input class="input" type="time" name="start_time" id="fStart"></div>
        <div><label>Selesai</label><input class="input" type="time" name="end_time" id="fEnd"></div>
      </div>
      <div class="row">
        <div>
          <label>Kurir</label>
          <select class="input" name="courier_id" id="fCourier">
            <option value="0">— belum ditentukan —</option>
            <?php foreach($couriers as $c): ?>
              <option value="<?= (int)$c['id'] ?>"><?= h(($c['code']?:'CR')." • ".$c['full_name']) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div>
          <label>Status</label>
          <select class="input" name="status" id="fStatus">
            <?php foreach(['scheduled','assigned','onroute','completed','cancelled'] as $s): ?>
              <option value="<?= $s ?>"><?= ucfirst($s) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
      </div>
      <div class="row">
        <div><label>Catatan</label><textarea class="input" name="notes" id="fNotes" rows="2"></textarea></div>
      </div>
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn" id="btnCloseTask">Batal</button>
        <?php if ($isStaff): ?><button class="btn btn-primary">Simpan</button><?php endif; ?>
      </div>
    </form>
  </div>
</div>

<!-- MODAL ASSIGN -->
<div class="modal" id="assignModal" aria-hidden="true">
  <div class="sheet" style="max-width:520px">
    <h3>Assign Kurir</h3>
    <form id="assignForm">
      <input type="hidden" name="action" value="assign_courier">
      <input type="hidden" name="id" id="assignId">
      <div class="row">
        <div>
          <label>Pilih Kurir</label>
          <select class="input" name="courier_id" id="assignCourier">
            <option value="0">— pilih kurir —</option>
            <?php foreach($couriers as $c): if(!$c['is_active']) continue; ?>
              <option value="<?= (int)$c['id'] ?>"><?= h(($c['code']?:'CR')." • ".$c['full_name']." • ".$c['phone']) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
      </div>
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn" id="btnCloseAssign">Tutup</button>
        <button class="btn btn-primary" type="submit">Simpan</button>
      </div>
    </form>
  </div>
</div>

<!-- MODAL COURIER -->
<div class="modal" id="courierModal" aria-hidden="true">
  <div class="sheet">
    <h3 id="courierTitle">Tambah Kurir</h3>
    <form method="post" id="courierForm">
      <input type="hidden" name="action" value="create_courier" id="courierAction">
      <input type="hidden" name="id" id="courierId">
      <div class="row">
        <div><label>ID Kurir (opsional)</label><input class="input" name="code" id="cCode" placeholder="CR-xxx"></div>
        <div><label>Nama</label><input class="input" name="full_name" id="cName" required></div>
      </div>
      <div class="row">
        <div><label>No. HP</label><input class="input" name="phone" id="cPhone"></div>
        <div><label>Kendaraan</label><input class="input" name="vehicle" id="cVehicle" placeholder="Motor/Mobil"></div>
      </div>
      <div class="row">
        <div>
          <label>Status</label>
          <select class="input" name="is_active" id="cActive">
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </select>
        </div>
        <div><label>Rating (0–5)</label><input class="input" name="rating" id="cRating" type="number" min="0" max="5" step="0.1"></div>
      </div>
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn" id="btnCloseCourier">Batal</button>
        <button class="btn btn-primary">Simpan</button>
      </div>
    </form>
  </div>
</div>

<script>
// Ripple
document.addEventListener('click', function(e){
  var btn = e.target.closest('.btn, .btn-icon, .tab'); if(!btn) return;
  var c = document.createElement('span'); var d=Math.max(btn.clientWidth,btn.clientHeight);
  c.className='ripple'; c.style.width=c.style.height=d+'px';
  c.style.left=(e.clientX-btn.getBoundingClientRect().left-d/2)+'px';
  c.style.top =(e.clientY-btn.getBoundingClientRect().top -d/2)+'px';
  btn.appendChild(c); setTimeout(function(){ c.remove(); },600);
});

// Helpers Modal
function show(el){ if(el){ el.classList.add('show'); el.setAttribute('aria-hidden','false'); } }
function hide(el){ if(el){ el.classList.remove('show'); el.setAttribute('aria-hidden','true'); } }

document.addEventListener('DOMContentLoaded', function(){

  // ====== TASK MODAL ======
  var taskModal    = document.getElementById('taskModal');
  var btnAdd       = document.getElementById('btnAdd');
  var btnCloseTask = document.getElementById('btnCloseTask');

  if (btnAdd){
    btnAdd.addEventListener('click', function(e){
      e.preventDefault();
      document.getElementById('taskTitle').textContent='Jadwalkan';
      document.getElementById('taskAction').value='create_task';
      document.getElementById('taskId').value='';
      ['fCode','fOrder','fName','fPhone','fAddr','fStart','fEnd','fNotes'].forEach(function(id){
        var el = document.getElementById(id); if (el) el.value='';
      });
      var fType = document.getElementById('fType');
      if (fType) fType.value = <?= json_encode($tab==='delivery'?'delivery':'pickup') ?>;
      var fDate = document.getElementById('fDate');
      if (fDate) fDate.value = <?= json_encode($dateS) ?>;
      var fCourier = document.getElementById('fCourier');
      if (fCourier) fCourier.value = '0';
      var fStatus = document.getElementById('fStatus');
      if (fStatus) fStatus.value = 'scheduled';
      var selOrder = document.getElementById('selOrder');
      if (selOrder) selOrder.value = '';
      show(taskModal);
    });
  }
  if (btnCloseTask){
    btnCloseTask.addEventListener('click', function(e){ e.preventDefault(); hide(taskModal); });
  }
  if (taskModal){
    taskModal.addEventListener('click', function(e){ if(e.target===taskModal) hide(taskModal); });
  }

  // Autofill dari Pesanan
  var selOrder = document.getElementById('selOrder');
  if (selOrder){
    selOrder.addEventListener('change', function(e){
      var opt = e.target.selectedOptions[0];
      if (!opt || !opt.value) return;
      var oc = opt.value;
      var nm = opt.getAttribute('data-name')  || '';
      var ph = opt.getAttribute('data-phone') || '';
      var ad = opt.getAttribute('data-addr')  || '';
      var fOrder = document.getElementById('fOrder'); if (fOrder) fOrder.value = oc;
      var fName  = document.getElementById('fName');  if (fName)  fName.value  = nm;
      var fPhone = document.getElementById('fPhone'); if (fPhone) fPhone.value = ph;
      var fAddr  = document.getElementById('fAddr');  if (fAddr)  fAddr.value  = ad;
    });
  }

  // ====== ASSIGN MODAL ======
  var assignModal    = document.getElementById('assignModal');
  var assignId       = document.getElementById('assignId');
  var assignCourier  = document.getElementById('assignCourier');
  var btnCloseAssign = document.getElementById('btnCloseAssign');

  var assignBtns = document.querySelectorAll('.item .act-assign');
  for (var i=0;i<assignBtns.length;i++){
    assignBtns[i].addEventListener('click', function(e){
      e.preventDefault();
      var d = JSON.parse(e.target.closest('.item').dataset.json);
      if (assignId) assignId.value = d.id;
      if (assignCourier) assignCourier.value = String(d.courier_id||0);
      show(assignModal);
    });
  }
  if (btnCloseAssign){
    btnCloseAssign.addEventListener('click', function(e){ e.preventDefault(); hide(assignModal); });
  }
  if (assignModal){
    assignModal.addEventListener('click', function(e){ if(e.target===assignModal) hide(assignModal); });
  }

  document.getElementById('assignForm') && document.getElementById('assignForm').addEventListener('submit', function(e){
    e.preventDefault();
    var fd=new FormData(e.target);
    fetch('<?= h(base_url('delivery.php')) ?>',{method:'POST',body:fd})
      .then(function(r){ return r.json(); })
      .then(function(js){ if(js.ok) location.reload(); else alert('Gagal assign kurir.'); })
      .catch(function(){ alert('Gagal assign kurir.'); });
  });

  // ====== ADVANCE / CANCEL ======
  var advBtns = document.querySelectorAll('.item .act-advance');
  for (var j=0;j<advBtns.length;j++){
    advBtns[j].addEventListener('click', function(e){
      e.preventDefault();
      var d = JSON.parse(e.target.closest('.item').dataset.json);
      var fd=new FormData(); fd.append('action','advance_status'); fd.append('id', d.id);
      fetch('<?= h(base_url('delivery.php')) ?>',{method:'POST',body:fd})
        .then(function(r){ return r.json(); })
        .then(function(js){ if(js.ok) location.reload(); else alert('Gagal update status.'); })
        .catch(function(){ alert('Gagal update status.'); });
    });
  }
  var cxlBtns = document.querySelectorAll('.item .act-cancel');
  for (var k=0;k<cxlBtns.length;k++){
    cxlBtns[k].addEventListener('click', function(e){
      e.preventDefault();
      if(!confirm('Batalkan tugas ini?')) return;
      var d = JSON.parse(e.target.closest('.item').dataset.json);
      var fd=new FormData(); fd.append('action','cancel_task'); fd.append('id', d.id);
      fetch('<?= h(base_url('delivery.php')) ?>',{method:'POST',body:fd})
        .then(function(r){ return r.json(); })
        .then(function(js){ if(js.ok) location.reload(); else alert('Gagal membatalkan.'); })
        .catch(function(){ alert('Gagal membatalkan.'); });
    });
  }

  // ====== COURIER MODAL ======
  var courierModal   = document.getElementById('courierModal');
  var btnAddCourier  = document.getElementById('btnAddCourier');
  var btnCloseCourier= document.getElementById('btnCloseCourier');

  if (btnAddCourier){
    btnAddCourier.addEventListener('click', function(e){
      e.preventDefault();
      document.getElementById('courierTitle').textContent='Tambah Kurir';
      document.getElementById('courierAction').value='create_courier';
      document.getElementById('courierId').value='';
      ['cCode','cName','cPhone','cVehicle','cRating'].forEach(function(id){
        var el = document.getElementById(id); if (el) el.value='';
      });
      var cActive=document.getElementById('cActive'); if (cActive) cActive.value='1';
      show(courierModal);
    });
  }
  if (btnCloseCourier){
    btnCloseCourier.addEventListener('click', function(e){ e.preventDefault(); hide(courierModal); });
  }
  if (courierModal){
    courierModal.addEventListener('click', function(e){ if(e.target===courierModal) hide(courierModal); });
  }

  // ====== EDIT COURIER ======
  var editCourierBtns = document.querySelectorAll('.act-edit-courier');
  for (var m=0;m<editCourierBtns.length;m++){
    editCourierBtns[m].addEventListener('click', function(e){
      e.preventDefault();
      var d = JSON.parse(e.target.dataset.json);
      document.getElementById('courierTitle').textContent='Ubah Kurir';
      document.getElementById('courierAction').value='update_courier';
      document.getElementById('courierId').value=d.id;
      document.getElementById('cCode').value=d.code||'';
      document.getElementById('cName').value=d.full_name||'';
      document.getElementById('cPhone').value=d.phone||'';
      document.getElementById('cVehicle').value=d.vehicle||'';
      document.getElementById('cActive').value=String(d.is_active||0);
      document.getElementById('cRating').value=(d.rating!=null? d.rating : '');
      show(courierModal);
    });
  }

  // ====== EDIT TASK ======
  var editTaskBtns = document.querySelectorAll('.item .act-edit');
  for (var n=0;n<editTaskBtns.length;n++){
    editTaskBtns[n].addEventListener('click', function(e){
      e.preventDefault();
      var tr = e.target.closest('.item'); var d = JSON.parse(tr.dataset.json);
      document.getElementById('taskTitle').textContent='Ubah Jadwal';
      document.getElementById('taskAction').value='update_task';
      document.getElementById('taskId').value=d.id;
      document.getElementById('fType').value=d.type;
      document.getElementById('fCode').value=d.task_code||'';
      document.getElementById('fOrder').value=d.order_code||'';
      document.getElementById('fName').value=d.customer_name||'';
      document.getElementById('fPhone').value=d.phone||'';
      document.getElementById('fAddr').value=d.address||'';
      document.getElementById('fDate').value=d.schedule_date||'';
      document.getElementById('fStart').value=d.start_time?d.start_time.substring(0,5):'';
      document.getElementById('fEnd').value=d.end_time?d.end_time.substring(0,5):'';
      document.getElementById('fCourier').value=String(d.courier_id||0);
      document.getElementById('fStatus').value=d.status||'scheduled';
      document.getElementById('fNotes').value=d.notes||'';
      var selOrder2 = document.getElementById('selOrder'); if (selOrder2) selOrder2.value='';
      show(taskModal);
    });
  }

  // ====== Dropdown Profil ======
  var userBtn  = document.getElementById('userMenuBtn');
  var userMenu = document.getElementById('userMenu');
  if (userBtn && userMenu){
    userBtn.addEventListener('click', function(e){ e.stopPropagation(); userMenu.classList.toggle('show'); });
    document.addEventListener('click', function(e){
      if (!userMenu.contains(e.target) && !userBtn.contains(e.target)) userMenu.classList.remove('show');
    });
  }
});

/* =========================
   ADD-ON JS: 3D & micro-interactions (non-invasive)
   ========================= */
(function(){
  const supportsHover = matchMedia('(hover:hover)').matches;

  // Tambahkan tilt & shine + mark reveal
  function enableTilt(el, scale=1.02, max=10){
    if(!supportsHover) return;
    el.classList.add('tilt','reveal');
    const shine = document.createElement('span');
    shine.className = 'shine';
    el.appendChild(shine);

    function move(e){
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * max;
      const ry = (px - 0.5) * max;
      el.style.transform = `perspective(var(--persp)) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
      el.style.setProperty('--mx', (px*100)+'%');
      el.style.setProperty('--my', (py*100)+'%');
    }
    function leave(){
      el.style.transform = `perspective(var(--persp)) scale(1)`;
    }
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
  }

  document.querySelectorAll('.kpi, .card, .item').forEach(el => enableTilt(el));

  // Reveal on scroll
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(en=>{
      if(en.isIntersecting){
        en.target.classList.add('in-view');
        io.unobserve(en.target);
      }
    });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal, .kpi, .item').forEach(el=> io.observe(el));

  // Parallax blob
  window.addEventListener('scroll', ()=>{
    const s = window.scrollY * 0.03;
    document.querySelectorAll('.blob').forEach((b,i)=>{
      b.style.transform = `translateY(${s*(i+1)}px)`;
    });
  }, { passive:true });

  // Confetti util
  function confetti(x,y,count=18){
    for(let i=0;i<count;i++){
      const e = document.createElement('i');
      e.className = 'confetti';
      e.style.setProperty('--x', x+'px');
      e.style.setProperty('--y', y+'px');
      const ang = Math.random()*Math.PI*2;
      const v   = 60 + Math.random()*80;
      const dx  = Math.cos(ang)*v;
      const dy  = Math.sin(ang)*v + 80;
      e.style.setProperty('--dx', dx+'px');
      e.style.setProperty('--dy', dy+'px');
      e.style.setProperty('--h', Math.floor(Math.random()*360));
      e.style.setProperty('--r', Math.floor(Math.random()*360)+'deg');
      document.body.appendChild(e);
      setTimeout(()=> e.remove(), 1000);
    }
  }

  document.addEventListener('click', (e)=>{
    if(e.target.closest('.btn.btn-primary, .act-advance, .act-assign')){
      confetti(e.clientX, e.clientY);
    }
  });

  // Tambah sheen ke semua .btn-primary
  document.querySelectorAll('.btn.btn-primary').forEach(btn=>{
    const s = document.createElement('span');
    s.className = 'sheen';
    btn.appendChild(s);
  });
})();
</script>
</body>
</html>
