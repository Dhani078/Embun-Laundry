<?php
require_once __DIR__ . '/config.php';
require_login();

/* ========= Helpers ========= */
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

$role       = $_SESSION['user_role'] ?? 'Customer';
$isStaff    = in_array($role, ['Admin','Owner','Staff'], true);
$isCustomer = !$isStaff;
$userId     = (int)($_SESSION['user_id'] ?? 0);
$myName     = trim($_SESSION['user_name'] ?? '');

/* ========= Bootstrap: Tabel Tambahan (aman, hanya jika belum ada) ========= */

/* ========= Utilities: flash message ========= */
function set_flash($type,$msg){ $_SESSION['flash']=['type'=>$type,'msg'=>$msg]; }
function take_flash(){ $f=$_SESSION['flash']??null; unset($_SESSION['flash']); return $f; }

/* ========= Deteksi kolom tabel promos (biar fleksibel) ========= */
$promosCols = [];
$hasPromos  = false;
if ($res=$mysqli->query("SHOW TABLES LIKE 'promos'")) {
  $hasPromos = $res->num_rows>0; $res->close();
}
if ($hasPromos) {
  if ($cr=$mysqli->query("SHOW COLUMNS FROM promos")){
    while($c=$cr->fetch_assoc()){ $promosCols[$c['Field']]=true; }
    $cr->close();
  }
}

/* ========= Ambil daftar promo aktif (global) ========= */
$promos=[];
if ($hasPromos){
  $fields = [
    "id","name",
    (isset($promosCols['type'])  ? "type"  : "'flat' AS type"),
    (isset($promosCols['value']) ? "value" : "0 AS value"),
    (isset($promosCols['min_spend'])    ? "min_spend"    : "0 AS min_spend"),
    (isset($promosCols['max_discount']) ? "max_discount" : "0 AS max_discount"),
    (isset($promosCols['start_at'])     ? "start_at"     : "NULL AS start_at"),
    (isset($promosCols['end_at'])       ? "end_at"       : "NULL AS end_at"),
    (isset($promosCols['is_active'])    ? "is_active"    : "1 AS is_active"),
    (isset($promosCols['description'])  ? "description"  : "NULL AS description")
  ];
  $sql = "SELECT ".implode(',',$fields)." FROM promos";
  if (isset($promosCols['is_active'])) $sql .= " WHERE is_active=1";
  $sql .= " ORDER BY id DESC LIMIT 100";
  if ($rp=$mysqli->query($sql)) { while($r=$rp->fetch_assoc()) $promos[]=$r; $rp->close(); }
}

/* ========= POST Actions ========= */
if ($_SERVER['REQUEST_METHOD']==='POST') {
  verify_csrf();
  $act = $_POST['action'] ?? '';

  // --- Klaim Daily Check-in (Customer/semua user login) ---
  if ($act==='claim_daily') {
    $today = (new DateTime('today'))->format('Y-m-d');
    // sudah klaim hari ini?
    $st = $mysqli->prepare("SELECT id FROM daily_checkins WHERE user_id=? AND day=?");
    $st->bind_param('is',$userId,$today); $st->execute(); $st->store_result();
    if ($st->num_rows>0) { $st->close(); set_flash('warn','Sudah klaim harian hari ini.'); header('Location: '.base_url('promo.php')); exit; }
    $st->close();

    // insert check-in
    $ins=$mysqli->prepare("INSERT INTO daily_checkins (user_id, day) VALUES (?,?)");
    $ins->bind_param('is',$userId,$today); $ins->execute(); $ins->close();

    // reward: voucher flat Rp2.000 berlaku 7 hari
    $value = 2000;
    $code  = 'DAY-'.strtoupper(substr(bin2hex(random_bytes(3)),0,6));
    $name  = 'Daily Check-in';
    $exp   = (new DateTime('+7 days'))->format('Y-m-d H:i:s');

    $iv=$mysqli->prepare("INSERT INTO user_vouchers (user_id, promo_id, code, name, type, value, min_spend, max_discount, expires_at, source)
                          VALUES (?,?,?,?, 'flat', ?, 0, 0, ?, 'daily')");
    $null = null;
    $iv->bind_param('iississ', $userId, $null, $code, $name, $value, $exp);
    $iv->execute(); $vid = $iv->insert_id; $iv->close();

    $log=$mysqli->prepare("INSERT INTO voucher_claims (user_id, promo_id, voucher_id, source, amount) VALUES (?,?,?,?,?)");
    $src='daily'; $zero=null; $log->bind_param('iiisi',$userId,$zero,$vid,$src,$value); $log->execute(); $log->close();

    set_flash('ok','Berhasil klaim daily! Voucher Rp 2.000 ditambahkan.');
    header('Location: '.base_url('promo.php')); exit;
  }

  // --- Klaim Promo Global → jadi voucher personal (Customer/Staff) ---
  if ($act==='claim_promo' && $hasPromos) {
    $pid = (int)($_POST['promo_id'] ?? 0);
    if ($pid<=0){ set_flash('err','Promo tidak valid'); header('Location: '.base_url('promo.php')); exit; }

    // ambil promo
    $fields = [
      "id","name",
      (isset($promosCols['type'])  ? "type"  : "'flat' AS type"),
      (isset($promosCols['value']) ? "value" : "0 AS value"),
      (isset($promosCols['min_spend'])    ? "min_spend"    : "0 AS min_spend"),
      (isset($promosCols['max_discount']) ? "max_discount" : "0 AS max_discount"),
      (isset($promosCols['end_at'])       ? "end_at"       : "NULL AS end_at"),
      (isset($promosCols['is_active'])    ? "is_active"    : "1 AS is_active")
    ];
    $sql = "SELECT ".implode(',',$fields)." FROM promos WHERE id=?";
    if (isset($promosCols['is_active'])) $sql .= " AND is_active=1";

    $st = $mysqli->prepare($sql);
    $st->bind_param('i',$pid); $st->execute(); $pr = $st->get_result(); $p = $pr->fetch_assoc(); $st->close();
    if (!$p){ set_flash('err','Promo tidak ditemukan / tidak aktif'); header('Location: '.base_url('promo.php')); exit; }

    // jadikan voucher personal
    $type = strtolower($p['type'] ?? 'flat'); if (!in_array($type,['flat','percent'],true)) $type='flat';
    $val  = (int)($p['value'] ?? 0);
    $min  = (int)($p['min_spend'] ?? 0);
    $maxd = (int)($p['max_discount'] ?? 0);
    $code = 'PRM-'.strtoupper(substr(bin2hex(random_bytes(3)),0,6));
    $name = $p['name'].' (Voucher Kamu)';
    $exp  = !empty($p['end_at']) ? date('Y-m-d H:i:s', strtotime($p['end_at'])) : (new DateTime('+14 days'))->format('Y-m-d H:i:s');

    $iv=$mysqli->prepare("INSERT INTO user_vouchers (user_id, promo_id, code, name, type, value, min_spend, max_discount, expires_at, source)
                          VALUES (?,?,?,?,?,?,?,?,?, 'claim')");
    $iv->bind_param('iisssiiis', $userId, $p['id'], $code, $name, $type, $val, $min, $maxd, $exp);
    $iv->execute(); $vid=$iv->insert_id; $iv->close();

    $log=$mysqli->prepare("INSERT INTO voucher_claims (user_id, promo_id, voucher_id, source, amount) VALUES (?,?,?,?,?)");
    $src='claim'; $log->bind_param('iiisi',$userId,$p['id'],$vid,$src,$val); $log->execute(); $log->close();

    set_flash('ok','Promo berhasil diklaim! Voucher ditambahkan ke akun.');
    header('Location: '.base_url('promo.php')); exit;
  }

  // --- Admin tambah promo sederhana (opsional) ---
  if ($act==='admin_add' && $isStaff && $hasPromos) {
    $name  = trim($_POST['name'] ?? '');
    $type  = strtolower($_POST['type'] ?? 'flat');
    $value = max(0,(int)($_POST['value'] ?? 0));
    $min   = max(0,(int)($_POST['min_spend'] ?? 0));
    $maxd  = max(0,(int)($_POST['max_discount'] ?? 0));
    $start = trim($_POST['start_at'] ?? '');
    $end   = trim($_POST['end_at'] ?? '');
    $active= isset($_POST['is_active']) ? 1 : 0;
    $desc  = trim($_POST['description'] ?? '');

    if ($name===''){ set_flash('err','Nama promo wajib diisi'); header('Location: '.base_url('promo.php')); exit; }

    // rakit field berdasarkan kolom yang ada
    $cols=[]; $vals=[]; $types=''; $bind=[];
    $push = function($c,$v,$t) use (&$cols,&$vals,&$types,&$bind){ $cols[]=$c; $vals[]='?'; $types.=$t; $bind[]=$v; };

    if (isset($promosCols['name']))         $push('name',$name,'s');
    if (isset($promosCols['type']))         $push('type', in_array($type,['flat','percent'],true)?$type:'flat','s');
    if (isset($promosCols['value']))        $push('value',$value,'i');
    if (isset($promosCols['min_spend']))    $push('min_spend',$min,'i');
    if (isset($promosCols['max_discount'])) $push('max_discount',$maxd,'i');
    if (isset($promosCols['start_at']))     $push('start_at', $start!==''?$start:null,'s');
    if (isset($promosCols['end_at']))       $push('end_at',   $end  !==''?$end  :null,'s');
    if (isset($promosCols['is_active']))    $push('is_active',$active,'i');
    if (isset($promosCols['description']))  $push('description',$desc,'s');

    if ($cols){
      $sql="INSERT INTO promos (".implode(',',$cols).") VALUES (".implode(',',$vals).")";
      $st=$mysqli->prepare($sql);
      if($types) $st->bind_param($types, ...$bind);
      $st->execute(); $st->close();
      set_flash('ok','Promo baru dibuat.');
    } else {
      set_flash('warn','Struktur tabel promos minimal tidak cocok untuk form ini. (Gagal insert)');
    }
    header('Location: '.base_url('promo.php')); exit;
  }
}

/* ========= Data tampilan ========= */
// sudah klaim daily?
$today = (new DateTime('today'))->format('Y-m-d');
$alreadyClaimed = false;
$st=$mysqli->prepare("SELECT 1 FROM daily_checkins WHERE user_id=? AND day=?");
$st->bind_param('is',$userId,$today); $st->execute(); $st->store_result(); $alreadyClaimed = $st->num_rows>0; $st->close();

// streak (7 hari ke belakang)
$streak = 0;
for($i=0;$i<7;$i++){
  $d=(new DateTime("-$i days"))->format('Y-m-d');
  $q=$mysqli->prepare("SELECT 1 FROM daily_checkins WHERE user_id=? AND day=?");
  $q->bind_param('is',$userId,$d); $q->execute(); $q->store_result();
  if($q->num_rows>0){ $streak++; $q->close(); }
  else { $q->close(); break; }
}

// voucher saya (aktif & belum dipakai)
$myVouchers=[];
$vv=$mysqli->prepare("SELECT * FROM user_vouchers WHERE user_id=? AND used_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY id DESC");
$vv->bind_param('i',$userId); $vv->execute(); $res=$vv->get_result();
while($r=$res->fetch_assoc()) $myVouchers[]=$r;
$vv->close();

$flash = take_flash();
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Embun Laundry · Promo & Diskon</title>
<link rel="stylesheet" href="assets/style.css"/>
</head>
<body>

<div class="wrap">
  <aside class="sidebar">
    <div>
      <div class="brand">
        <img src="img/Logo.png" alt="Embun Laundry" class="logo-img" width="36" height="36" decoding="async" fetchpriority="high"/>
        <div class="name">Embun Laundry</div>
      </div>
      <nav class="nav">
        <a href="<?= base_url('dashboard.php')?>"><span>🏠</span> <span>Dashboard</span></a>
        <a href="<?= base_url('pesanan.php')?>"><span>🧺</span> <span>Pesanan</span></a>
        <a href="pelanggan.php"><span>👥</span> <span>Pelanggan</span></a>
        <a href="layanan.php"><span>💲</span> <span>Layanan & Harga</span></a>
        <a href="delivery.php"><span>🚚</span> <span>Pickup & Delivery</span></a>
        <a href="laporan.php"><span>📑</span> <span>Laporan</span></a>
        <a class="active" href="<?= base_url('promo.php')?>"><span>🎟️</span> <span>Promo & Diskon</span></a>
      </nav>
    </div>
    <div class="side-bottom">
      <a href="profile.php">👤 Profil</a>
      <a href="settings.php">⚙️ Pengaturan</a>
      <a href="<?= base_url('auth/logout.php')?>">🚪 Keluar</a>
    </div>
  </aside>

  <section class="main">
    <div class="topbar">
      <div class="topbar-inner">
        <div class="search">🔎 <input type="text" placeholder="Cari promo, voucher… (visual saja)" disabled></div>

        <!-- User -->
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
      <?php if($flash): ?>
        <div class="card" style="border-color:<?= $flash['type']==='ok'?'#86efac':($flash['type']==='warn'?'#fde68a':'#fecaca') ?>;background:<?= $flash['type']==='ok'?'#ecfdf5':($flash['type']==='warn'?'#fffbeb':'#fef2f2') ?>;margin-bottom:12px">
          <?= h($flash['msg']) ?>
        </div>
      <?php endif; ?>

      <!-- Hero: Daily Check-in -->
      <div class="card hero">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <h2>🎁 Daily Check-in</h2>
            <div class="sub">Klaim hadiah harian untuk dapatkan voucher personal. Streak kamu: <strong><?= (int)$streak ?></strong> hari.</div>
          </div>
          <form method="post">
            <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
            <input type="hidden" name="action" value="claim_daily">
            <button class="btn btn-primary" <?= $alreadyClaimed?'disabled':'' ?>><?= $alreadyClaimed?'Sudah diklaim':'Klaim Hari Ini' ?></button>
          </form>
        </div>
      </div>

      <div class="grid cards" style="margin-top:14px">
        <!-- Kartu: Promo Global -->
        <div class="card">
          <h3>Promo Aktif</h3>
          <div class="sub" style="margin:6px 0 12px">Klaim jadi voucher personal (biar tersimpan ke akun kamu).</div>
          <?php if(!$promos): ?>
            <div class="sub">Belum ada promo aktif.</div>
          <?php else: ?>
            <div class="vlist">
              <?php foreach($promos as $p):
                $type = strtolower($p['type']??'flat');
                $vTxt = $type==='percent' ? (int)$p['value'].'%' : rupiah((int)$p['value']);
                $desc = $p['description'] ?? '';
                $period = [];
                if (!empty($p['start_at'])) $period[]='Mulai '.date('d M Y', strtotime($p['start_at']));
                if (!empty($p['end_at']))   $period[]='Sampai '.date('d M Y', strtotime($p['end_at']));
                $periodTxt = $period ? implode(' • ', $period) : 'Periode berjalan';
              ?>
              <div class="voucher">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
                  <div>
                    <div style="font-weight:800"><?= h($p['name']) ?></div>
                    <div class="sub"><?= h($periodTxt) ?><?= $p['min_spend']? ' • Min. '.rupiah((int)$p['min_spend']):'' ?></div>
                    <div class="sub"><?= $desc ? h($desc) : 'Diskon '.h($vTxt) ?></div>
                  </div>
                  <form method="post">
                    <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
                    <input type="hidden" name="action" value="claim_promo">
                    <input type="hidden" name="promo_id" value="<?= (int)$p['id'] ?>">
                    <button class="btn">Klaim → Voucher</button>
                  </form>
                </div>
              </div>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
        </div>

        <!-- Kartu: Voucher Saya -->
        <div class="card">
          <h3>Voucher Kamu</h3>
          <div class="sub" style="margin:6px 0 12px">Voucher personal yang aktif & belum dipakai.</div>
          <?php if(!$myVouchers): ?>
            <div class="sub">Belum ada voucher. Coba klaim promo atau daily check-in.</div>
          <?php else: ?>
            <div class="vlist" id="vlist">
              <?php foreach($myVouchers as $v):
                $cap = $v['type']==='percent' ? $v['value'].'%' : rupiah((int)$v['value']);
                $exp = $v['expires_at'] ? date('d M Y H:i', strtotime($v['expires_at'])) : '—';
              ?>
              <div class="voucher">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
                  <div>
                    <div style="font-weight:800"><?= h($v['name']) ?></div>
                    <div class="sub">Kode: <span class="code"><?= h($v['code']) ?></span> • Nilai: <?= h($cap) ?></div>
                    <div class="sub">Min: <?= rupiah((int)$v['min_spend']) ?><?= $v['max_discount']? ' • Maks: '.rupiah((int)$v['max_discount']):'' ?> • Exp: <?= h($exp) ?></div>
                  </div>
                  <button class="btn" onclick="copyCode('<?= h($v['code']) ?>')">Salin Kode</button>
                </div>
              </div>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
          <div class="note" style="margin-top:8px">Gunakan kode saat checkout / pesanan (akan saya hubungkan ke form pesanan).</div>
        </div>

        <!-- Kartu: Admin Kelola (hanya staff) -->
        <div class="card">
          <h3>Kelola Promo (Staff)</h3>
          <?php if(!$isStaff): ?>
            <div class="sub">Hanya admin/staff yang bisa membuat/aktifkan promo global.</div>
          <?php elseif(!$hasPromos): ?>
            <div class="sub">Tabel <strong>promos</strong> belum tersedia, atau skemanya berbeda. Buat tabel dulu, lalu refresh.</div>
          <?php else: ?>
            <form class="form" method="post" style="display:flex;flex-direction:column;gap:10px">
              <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
              <input type="hidden" name="action" value="admin_add">
              <div class="row">
                <div style="flex:2">
                  <label>Nama Promo</label>
                  <input name="name" required placeholder="Contoh: Hemat Akhir Pekan">
                </div>
                <div>
                  <label>Tipe</label>
                  <select name="type">
                    <option value="flat">Potongan (Rp)</option>
                    <option value="percent">Persen (%)</option>
                  </select>
                </div>
                <div>
                  <label>Nilai</label>
                  <input type="number" name="value" min="0" value="2000">
                </div>
              </div>
              <div class="row">
                <div>
                  <label>Min. Belanja (Rp)</label>
                  <input type="number" name="min_spend" min="0" value="0">
                </div>
                <div>
                  <label>Maks. Diskon (Rp)</label>
                  <input type="number" name="max_discount" min="0" value="0">
                </div>
              </div>
              <div class="row">
                <div>
                  <label>Mulai (opsional)</label>
                  <input type="datetime-local" name="start_at">
                </div>
                <div>
                  <label>Selesai (opsional)</label>
                  <input type="datetime-local" name="end_at">
                </div>
              </div>
              <div>
                <label>Deskripsi (opsional)</label>
                <textarea name="description" placeholder="Catatan atau syarat promo"></textarea>
              </div>
              <div class="row" style="align-items:center">
                <div style="display:flex;align-items:center;gap:8px">
                  <input type="checkbox" id="is_active" name="is_active" checked>
                  <label for="is_active" style="margin:0">Aktifkan</label>
                </div>
                <div style="margin-left:auto">
                  <button class="btn btn-primary">Simpan Promo</button>
                </div>
              </div>
              <div class="note">Form ini hanya akan menyimpan kolom yang memang ada pada tabel <code>promos</code> kamu.</div>
            </form>
          <?php endif; ?>
        </div>
      </div>

    </div>
  </section>
</div>

<script>
// Copy code
function copyCode(txt){
  navigator.clipboard.writeText(txt).then(()=>{
    alert('Kode disalin: '+txt);
  }).catch(()=>{ alert('Gagal menyalin'); });
}

// User dropdown
const userBtn  = document.getElementById('userMenuBtn');
const userMenu = document.getElementById('userMenu');
userBtn?.addEventListener('click', (e)=>{ e.stopPropagation(); userMenu.classList.toggle('show'); });
document.addEventListener('click', (e)=>{ if (!userMenu.contains(e.target) && !userBtn.contains(e.target)) userMenu.classList.remove('show'); });
</script>
</body>
</html>
