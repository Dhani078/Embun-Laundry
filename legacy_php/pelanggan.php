<?php
require_once __DIR__ . '/config.php';
require_login();

/* =========================
   HELPERS + AVATAR
   ========================= */
function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function rupiah($n){ return 'Rp '.number_format((int)$n,0,',','.'); }

/* Helper avatar (cache-buster) */
function avatar_url_dash($uid){
  $base = 'uploads/avatars';
  foreach (['jpg','jpeg','png','webp'] as $ext){
    $p = __DIR__ . "/$base/$uid.$ext";
    if (is_file($p)) return "$base/$uid.$ext?v=".filemtime($p);
  }
  return 'img/avatar-placeholder.png';
}
$AVATAR = avatar_url_dash((int)($_SESSION['user_id'] ?? 0));

/* =========================
   ROLE & RULE TAG OTOMATIS
   ========================= */
$role       = $_SESSION['user_role'] ?? 'Customer';
$isStaff    = in_array($role, ['Admin','Owner','Staff'], true);
$isCustomer = !$isStaff;

// Ambang tag (sesuaikan)
const VIP_MIN_ORDERS    = 20;
const VIP_MIN_SPENT     = 2000000; // 2 juta
const SERING_MIN_ORDERS = 5;
const BARU_MAX_DAYS     = 30;

// Hitung tag otomatis
function auto_tag(?int $orders, ?int $spent, ?string $firstOrderAt): string {
  $orders = (int)$orders; $spent = (int)$spent;
  if ($orders >= VIP_MIN_ORDERS || $spent >= VIP_MIN_SPENT) return 'VIP';
  if ($orders >= SERING_MIN_ORDERS) return 'Sering';
  if ($firstOrderAt) {
    $d = (new DateTime($firstOrderAt))->diff(new DateTime())->days;
    if ($d <= BARU_MAX_DAYS) return 'Baru';
  }
  return 'Reguler';
}

/* =========================
   HELPERS
   ========================= */
function qstring(array $extra = []) {
  $keep = ['q','tag','edit'];
  $curr = array_intersect_key($_GET, array_flip($keep));
  return http_build_query(array_merge($curr, $extra));
}
function new_code(mysqli $db, $prefix='CUST-'){
  do{
    $code = $prefix . str_pad((string)random_int(0,9999), 4, '0', STR_PAD_LEFT);
    $st = $db->prepare("SELECT 1 FROM customers WHERE code=? LIMIT 1");
    $st->bind_param('s',$code); $st->execute(); $st->store_result();
    $exists = $st->num_rows>0; $st->close();
  } while($exists);
  return $code;
}

/* =========================
   OPSIONAL: sinkron dari orders -> customers
   ========================= */
$sync = $mysqli->query("
  WITH latest AS (
    SELECT
      TRIM(o.customer_name) AS name,
      MAX(o.created_at)     AS last_at
    FROM orders o
    WHERE o.customer_name IS NOT NULL AND o.customer_name <> ''
    GROUP BY TRIM(o.customer_name)
  )
  SELECT l.name,
         (SELECT MIN(created_at) FROM orders o1 WHERE TRIM(o1.customer_name)=l.name) AS first_at,
         o.customer_phone AS phone,
         o.customer_address AS address
  FROM latest l
  JOIN orders o
    ON TRIM(o.customer_name)=l.name AND o.created_at=l.last_at
  WHERE l.name NOT IN (SELECT full_name FROM customers)
");
if ($sync && $sync->num_rows) {
  $now = (new DateTime())->format('Y-m-d H:i:s');
  while ($row = $sync->fetch_assoc()) {
    $code  = new_code($mysqli);
    $name  = $row['name'];
    $first = $row['first_at'] ?: $now;
    $phone = $row['phone'] ?? null;
    $addr  = $row['address'] ?? null;
    $placeholderTag = 'Reguler';

    $st = $mysqli->prepare("
      INSERT INTO customers (code, full_name, phone, address, tag, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?)
    ");
    $st->bind_param('sssssss', $code, $name, $phone, $addr, $placeholderTag, $first, $now);
    $st->execute(); 
    $st->close();
  }
}
if ($sync) $sync->close();

/* =========================
   POST: CRUD
   ========================= */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $act = $_POST['action'] ?? '';

  if ($act === 'create_customer') {
    $name    = trim($_POST['full_name'] ?? '');
    $phone   = trim($_POST['phone'] ?? '');
    $address = trim($_POST['address'] ?? '');
    if ($name !== '') {
      $code = new_code($mysqli);
      $now  = (new DateTime())->format('Y-m-d H:i:s');
      $placeholderTag='Reguler';
      $st = $mysqli->prepare("INSERT INTO customers(code,full_name,phone,address,tag,created_at,updated_at) VALUES(?,?,?,?,?,?,?)");
      $st->bind_param('sssssss',$code,$name,$phone,$address,$placeholderTag,$now,$now);
      $st->execute(); $st->close();
    }
    header('Location: '.base_url('pelanggan.php').'?'.qstring()); exit;
  }

  if ($act === 'update_customer') {
    if ($isCustomer) { header('Location: '.base_url('pelanggan.php').'?'.qstring()); exit; }
    $id      = (int)($_POST['id'] ?? 0);
    $name    = trim($_POST['full_name'] ?? '');
    $phone   = trim($_POST['phone'] ?? '');
    $address = trim($_POST['address'] ?? '');
    if ($id>0 && $name!=='') {
      $now  = (new DateTime())->format('Y-m-d H:i:s');
      $st = $mysqli->prepare("UPDATE customers SET full_name=?, phone=?, address=?, updated_at=? WHERE id=?");
      $st->bind_param('ssssi',$name,$phone,$address,$now,$id);
      $st->execute(); $st->close();
    }
    header('Location: '.base_url('pelanggan.php').'?'.qstring()); exit;
  }

  if ($act === 'delete_customer') {
    if ($isStaff) {
      $id = (int)($_POST['id'] ?? 0);
      if ($id>0) {
        $st = $mysqli->prepare("DELETE FROM customers WHERE id=?");
        $st->bind_param('i',$id); $st->execute(); $st->close();
      }
    }
    header('Location: '.base_url('pelanggan.php').'?'.qstring()); exit;
  }
}

/* =========================
   FILTERS
   ========================= */
$q     = trim($_GET['q'] ?? '');
$tag   = $_GET['tag'] ?? '';
$editQ = isset($_GET['edit']) ? (int)$_GET['edit'] : 0;

/* =========================
   KPI dasar (avg order/bulan)
   ========================= */
$totCustomers = $mysqli->query("SELECT COUNT(*) c FROM customers")->fetch_assoc()['c'] ?? 0;
$monthStart = (new DateTime('first day of this month'))->setTime(0,0,0)->format('Y-m-d H:i:s');
$monthEnd   = (new DateTime('last day of this month'))->setTime(23,59,59)->format('Y-m-d H:i:s');
$ordersThisMonth = 0;
$st = $mysqli->prepare("SELECT COUNT(*) c FROM orders WHERE created_at BETWEEN ? AND ?");
$st->bind_param('ss',$monthStart,$monthEnd); $st->execute(); $st->bind_result($ordersThisMonth); $st->fetch(); $st->close();
$avgOrder = $totCustomers>0 ? round($ordersThisMonth / $totCustomers, 1) : 0;

/* =========================
   DATA + TAG OTOMATIS
   ========================= */
$sql = "SELECT c.*,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_name=c.full_name) AS orders_count,
        (SELECT COALESCE(SUM(total_amount),0) FROM orders o WHERE o.customer_name=c.full_name) AS total_spent,
        (SELECT MAX(created_at) FROM orders o WHERE o.customer_name=c.full_name) AS last_order_at,
        (SELECT MIN(created_at) FROM orders o WHERE o.customer_name=c.full_name) AS first_order_at
        FROM customers c WHERE 1";
$types=''; $params=[];

if ($q!==''){
  $sql.=" AND (c.code LIKE CONCAT('%',?,'%') OR c.full_name LIKE CONCAT('%',?,'%') OR c.phone LIKE CONCAT('%',?,'%'))";
  $types.='sss'; $params[]=$q; $params[]=$q; $params[]=$q;
}
$sql.=" ORDER BY c.updated_at DESC, c.id DESC LIMIT 300";

$st=$mysqli->prepare($sql);
if($types){ $st->bind_param($types, ...$params); }
$st->execute(); 
$res=$st->get_result();
$rows=[];
while($r=$res->fetch_assoc()) $rows[]=$r;
$st->close();

/* =========================
   Persist tag & tambal kontak dari order terbaru
   ========================= */
$vipCount=0; $baruBulan=0; $list=[];
$nowUpd = (new DateTime())->format('Y-m-d H:i:s');

foreach($rows as $r){
  if (empty($r['phone']) || empty($r['address'])) {
    $ox = $mysqli->prepare("
      SELECT o.customer_phone, o.customer_address
      FROM orders o
      WHERE o.customer_name=?
      ORDER BY o.created_at DESC
      LIMIT 1
    ");
    $ox->bind_param('s', $r['full_name']); $ox->execute(); $rx=$ox->get_result()->fetch_assoc(); $ox->close();
    if ($rx) {
      $newPhone = $r['phone']   ?: ($rx['customer_phone']   ?? '');
      $newAddr  = $r['address'] ?: ($rx['customer_address'] ?? '');
      if ($newPhone || $newAddr) {
        $u = $mysqli->prepare("UPDATE customers SET phone=?, address=?, updated_at=? WHERE id=?");
        $u->bind_param('sssi',$newPhone,$newAddr,$nowUpd,$r['id']); $u->execute(); $u->close();
        $r['phone'] = $newPhone; $r['address'] = $newAddr;
      }
    }
  }

  $computed = auto_tag($r['orders_count'], $r['total_spent'], $r['first_order_at']);
  if ($computed !== ($r['tag'] ?? '')) {
    $u = $mysqli->prepare("UPDATE customers SET tag=?, updated_at=? WHERE id=?");
    $u->bind_param('ssi', $computed, $nowUpd, $r['id']); $u->execute(); $u->close();
    $r['tag'] = $computed;
  }
  $r['computed_tag'] = $computed;

  if ($computed==='VIP') $vipCount++;
  if ($r['first_order_at'] && $r['first_order_at'] >= $monthStart && $r['first_order_at'] <= $monthEnd) $baruBulan++;

  if ($tag && $computed !== $tag) continue;
  $list[] = $r;
}
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Embun Laundry · Pelanggan</title>
<link rel="stylesheet" href="assets/style.css"/>
</head>
<body>
<!-- background orbs (dekorasi) -->
<div class="fx-orbs" aria-hidden="true">
  <span class="orb o1"></span>
  <span class="orb o2"></span>
  <span class="orb o3"></span>
</div>

<div class="wrap">
  <aside class="sidebar">
    <div class="brand">
      <img src="img/Logo.png" alt="Embun Laundry" class="logo-img" width="36" height="36" decoding="async" fetchpriority="high"/>
      <div class="name">Embun Laundry</div>
    </div>
    <nav class="nav">
      <a href="<?= base_url('dashboard.php')?>"><span>🏠</span><span>Dashboard</span></a>
      <a href="<?= base_url('pesanan.php')?>"><span>🧺</span><span>Pesanan</span></a>
      <a class="active" href="<?= base_url('pelanggan.php')?>"><span>👥</span><span>Pelanggan</span></a>
      <a href="layanan.php"><span>💲</span><span>Layanan & Harga</span></a>
      <a href="delivery.php"><span>🚚</span><span>Pickup & Delivery</span></a>
      <a href="laporan.php"><span>📑</span><span>Laporan</span></a>
      <a href="promo.php"><span>🎟️</span><span>Promo & Diskon</span></a>
    </nav>

    <!-- Footer kiri bawah: Profil, Pengaturan, Keluar -->
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
          <form method="get" style="display:flex;gap:10px;align-items:center;width:100%">
            <input type="text" name="q" value="<?= h($q) ?>" placeholder="Cari nama, ID, atau nomor HP…" />
            <select name="tag" class="btn">
              <option value="">Semua Tag</option>
              <?php foreach(['VIP','Reguler','Sering','Baru'] as $t): ?>
                <option value="<?= $t ?>" <?= $tag===$t?'selected':'' ?>><?= $t ?></option>
              <?php endforeach; ?>
            </select>
            <button class="btn">Filter</button>
          </form>
        </div>
        <?php if ($isStaff): ?>
        <button class="btn btn-primary" id="btnAdd">+ Tambah Pelanggan</button>
        <?php endif; ?>

        <!-- User area: avatar + dropdown -->
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
      <div class="h1">Pelanggan</div>
      <div class="sub">Kelola data pelanggan dan riwayat pesanan</div>

      <div class="kpis" id="kpiRow">
        <div class="kpi" data-variant="all">
          <div class="ic">👥</div><h3>Total Pelanggan</h3><div class="val"><?= (int)$totCustomers ?></div>
        </div>
        <div class="kpi" data-variant="vip">
          <div class="ic">⭐</div><h3>Pelanggan VIP</h3><div class="val"><?= (int)$vipCount ?></div>
        </div>
        <div class="kpi" data-variant="new">
          <div class="ic">🆕</div><h3>Baru Bulan Ini</h3><div class="val"><?= (int)$baruBulan ?></div>
        </div>
        <div class="kpi" data-variant="avg">
          <div class="ic">📈</div><h3>Avg Order/Bulan</h3><div class="val"><?= number_format($avgOrder,1) ?></div>
        </div>
      </div>

      <div class="toolbar" style="justify-content:flex-end;gap:8px">
        <button id="btnExport" class="btn btn-ghost">⬇️ Export</button>
      </div>

      <div class="card" style="padding:6px;transform-style:preserve-3d">
        <table class="table" id="tbl">
          <thead>
          <tr>
            <th>ID</th><th>Nama</th><th>Kontak</th><th>Alamat</th>
            <th>Total Pesanan</th><th>Terakhir Order</th><th>Tag</th><th style="text-align:right">Aksi</th>
          </tr>
          </thead>
          <tbody>
          <?php foreach($list as $c):
            $tagBadge = $c['computed_tag']==='VIP' ? 'bd-vip' : ($c['computed_tag']==='Sering' ? 'bd-oft' : ($c['computed_tag']==='Baru' ? 'bd-new' : 'bd-reg'));
          ?>
            <tr data-json='<?= h(json_encode($c)) ?>'>
              <td><?= h($c['code']) ?></td>
              <td><?= h($c['full_name']) ?></td>
              <td>📞 <?= h($c['phone'] ?: '-') ?></td>
              <td>📍 <?= h($c['address'] ?: '-') ?></td>
              <td>
                <div><?= (int)$c['orders_count'] ?></div>
                <div class="sub"><?= rupiah($c['total_spent']) ?></div>
              </td>
              <td><?= $c['last_order_at'] ? h(date('d/m/Y H:i', strtotime($c['last_order_at']))) : '-' ?></td>
              <td><span class="badge <?= $tagBadge ?>"><?= h($c['computed_tag']) ?></span></td>
              <td class="actions" style="text-align:right;white-space:nowrap">
                <a href="#" class="act-view" title="Lihat">👁</a>
                <?php if ($isStaff): ?>
                  <a href="<?= base_url('pelanggan.php').'?'.qstring(['edit'=>$c['id']]) ?>" class="act-edit" title="Ubah">✏️</a>
                  <form method="post" style="display:inline" onsubmit="return confirm('Hapus pelanggan ini?')">
                    <input type="hidden" name="action" value="delete_customer">
                    <input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
                    <button title="Hapus">🗑️</button>
                  </form>
                <?php endif; ?>
              </td>
            </tr>
          <?php endforeach; if(!$list): ?>
            <tr><td colspan="8" class="sub" style="text-align:center;padding:28px">Belum ada data.</td></tr>
          <?php endif; ?>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</div>

<!-- MODAL -->
<div class="modal" id="custModal" aria-hidden="true">
  <div class="sheet">
    <h3 id="modalTitle">Tambah Pelanggan</h3>
    <form method="post" id="custForm">
      <input type="hidden" name="action" value="create_customer" id="formAction">
      <input type="hidden" name="id" id="custId">

      <div class="row">
        <div><label>Nama Lengkap</label><input class="input" name="full_name" id="fName" required <?= $isStaff?'':'readonly' ?>></div>
        <div><label>No. HP</label><input class="input" name="phone" id="fPhone" <?= $isStaff?'':'readonly' ?>></div>
      </div>
      <div class="row">
        <div><label>Alamat</label><textarea class="input" name="address" id="fAddr" rows="3" <?= $isStaff?'':'readonly' ?>></textarea></div>
        <div>
          <label>Tag (otomatis)</label>
          <input class="input" value="Otomatis dari jumlah order & total belanja (disimpan ke DB)" readonly>
        </div>
      </div>

      <div class="row" style="align-items:flex-end">
        <div class="sub">Rule: VIP(≥<?=VIP_MIN_ORDERS?> order / ≥<?=number_format(VIP_MIN_SPENT,0,',','.')?>), Sering(≥<?=SERING_MIN_ORDERS?>), Baru(≤<?=BARU_MAX_DAYS?> hari), lainnya Reguler.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" id="btnClose">Batal</button>
          <?php if ($isStaff): ?><button class="btn btn-primary" type="submit">Simpan</button><?php endif; ?>
        </div>
      </div>
    </form>
  </div>
</div>

<script>
// Ripple (sudah ada interaksi, biarkan logic apa adanya)
document.addEventListener('click', function(e){
  const btn = e.target.closest('.btn');
  if(!btn) return;
  const c = document.createElement('span'); const d = Math.max(btn.clientWidth, btn.clientHeight);
  c.className='ripple'; c.style.width=c.style.height=d+'px';
  c.style.left=(e.clientX-btn.getBoundingClientRect().left-d/2)+'px';
  c.style.top =(e.clientY-btn.getBoundingClientRect().top -d/2)+'px';
  btn.appendChild(c); setTimeout(()=>c.remove(),600);
});

// Export CSV (LOGIC TETAP)
const ROWS = <?= json_encode($list, JSON_UNESCAPED_UNICODE) ?>;
document.getElementById('btnExport')?.addEventListener('click', ()=>{
  if(!ROWS.length){ alert('Tidak ada data.'); return; }
  let csv = ['ID,Nama,No HP,Alamat,Total Order,Total Belanja,Terakhir Order,Tag'];
  for(const r of ROWS){
    csv.push([
      `"${r.code}"`,
      `"${r.full_name}"`,
      `"${r.phone??''}"`,
      `"${(r.address??'').replace(/\r?\n/g,' ')}"`,
      r.orders_count||0,
      r.total_spent||0,
      `"${r.last_order_at??''}"`,
      r.computed_tag
    ].join(','));
  }
  const blob = new Blob([csv.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pelanggan.csv'; a.click();

  // FX: confetti kecil saat export
  fxConfetti(['✨','👥','🫧','🌟']);
});

// Modal helper (LOGIC TETAP)
const modal = document.getElementById('custModal');
const btnClose = document.getElementById('btnClose');
<?php if ($isStaff): ?>const btnAdd = document.getElementById('btnAdd');<?php endif; ?>

function openCreate(){
  document.getElementById('modalTitle').textContent='Tambah Pelanggan';
  document.getElementById('formAction').value='create_customer';
  document.getElementById('custId').value='';
  document.getElementById('fName').value='';
  document.getElementById('fPhone').value='';
  document.getElementById('fAddr').value='';
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
  // FX: tilt follow mouse
  sheetTiltFollow();
}
function openEdit(data){
  document.getElementById('modalTitle').textContent='Ubah Pelanggan';
  document.getElementById('formAction').value='update_customer';
  document.getElementById('custId').value=data.id;
  document.getElementById('fName').value=data.full_name||'';
  document.getElementById('fPhone').value=data.phone||'';
  document.getElementById('fAddr').value=data.address||'';
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
  sheetTiltFollow();
}
function closeModal(){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }

<?php if ($isStaff): ?>
btnAdd?.addEventListener('click', openCreate);
<?php endif; ?>
btnClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if(e.target===modal) closeModal(); });

// Row actions (LOGIC TETAP)
document.querySelectorAll('#tbl tbody tr').forEach(tr=>{
  const data = JSON.parse(tr.dataset.json);
  tr.querySelector('.act-view').addEventListener('click', e=>{
    e.preventDefault();
    alert(`ID: ${data.code}\nNama: ${data.full_name}\nHP: ${data.phone||'-'}\nAlamat: ${data.address||'-'}\nTag: ${data.computed_tag}\nTotal Order: ${data.orders_count||0}\nTotal Belanja: Rp ${(Number(data.total_spent)||0).toLocaleString('id-ID')}\nTerakhir Order: ${data.last_order_at||'-'}`);
  });
});

// Buka modal Edit langsung via ?edit=ID (LOGIC TETAP)
<?php if ($editQ>0): ?>
(function(){
  const row = Array.from(document.querySelectorAll('#tbl tbody tr')).map(tr=>JSON.parse(tr.dataset.json)).find(r=>parseInt(r.id,10)===<?= (int)$editQ ?>);
  if (row) openEdit(row);
})();
<?php endif; ?>

// ====== Dropdown Profil (avatar img bisa dipencet) (LOGIC TETAP) ======
const userBtn  = document.getElementById('userMenuBtn');
const userMenu = document.getElementById('userMenu');
userBtn?.addEventListener('click', (e)=>{ e.stopPropagation(); userMenu.classList.toggle('show'); });
document.addEventListener('click', (e)=>{ 
  if (!userMenu.contains(e.target) && !userBtn.contains(e.target)) userMenu.classList.remove('show');
});

/* ================================
   FX ONLY (TIDAK MENGUBAH LOGIC)
   ================================ */

// 3D tilt utility
(function(){
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function attachTilt(el, maxDeg=8){
    let raf=null;
    function onMove(e){
      const r=el.getBoundingClientRect();
      const cx=r.left+r.width/2, cy=r.top+r.height/2;
      const dx=(e.clientX-cx)/(r.width/2), dy=(e.clientY-cy)/(r.height/2);
      const rx=clamp((-dy)*maxDeg,-maxDeg,maxDeg), ry=clamp(dx*maxDeg,-maxDeg,maxDeg);
      if(raf) cancelAnimationFrame(raf);
      raf=requestAnimationFrame(()=>{ el.style.transform=`translateZ(8px) rotateX(${rx}deg) rotateY(${ry}deg)`; });
    }
    function reset(){ el.style.transform=''; }
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', reset);
  }
  // Apply ke KPI cards dan row tabel
  document.querySelectorAll('.kpi').forEach(el=>attachTilt(el,10));
  document.querySelectorAll('#tbl tbody tr').forEach(el=>attachTilt(el,4));
  document.querySelectorAll('.card').forEach(el=>attachTilt(el,3));
})();

// Modal sheet tilt follow
function sheetTiltFollow(){
  const sheet=document.querySelector('.modal.show .sheet'); if(!sheet) return;
  const max=6;
  function move(e){
    const r=sheet.getBoundingClientRect();
    const dx=((e.clientX-(r.left+r.width/2))/r.width)*2;
    const dy=((e.clientY-(r.top+r.height/2))/r.height)*2;
    sheet.style.transform=`rotateX(${-dy*max}deg) rotateY(${dx*max}deg)`;
  }
  function reset(){ sheet.style.transform=''; }
  sheet.addEventListener('mousemove', move);
  sheet.addEventListener('mouseleave', reset);
}

// KPI stagger reveal
(function(){
  const items=[...document.querySelectorAll('#kpiRow .kpi')];
  items.forEach((el,i)=>{
    el.style.opacity='0';
    el.style.transform='translateY(8px)';
    setTimeout(()=>{
      el.style.transition='opacity .35s ease, transform .35s ease';
      el.style.opacity='1';
      el.style.transform='translateY(0)';
    }, 100 + i*90);
  });
})();

// Logo spin kecil saat hover
document.querySelector('.logo-img')?.addEventListener('mouseenter', e=>{
  const el=e.currentTarget;
  el.animate([{transform:'rotateY(0deg)'},{transform:'rotateY(360deg)'}],{duration:1200,easing:'cubic-bezier(.2,.8,.2,1)'});
});

// Parallax orbs
(function(){
  const orbs=document.querySelectorAll('.fx-orbs .orb');
  if(!orbs.length) return;
  document.addEventListener('mousemove', (e)=>{
    const x=(e.clientX/window.innerWidth - .5);
    const y=(e.clientY/window.innerHeight- .5);
    orbs.forEach((o,i)=>{
      const depth=(i+1)*8;
      o.style.transform=`translate(${ -x*depth }px, ${ -y*depth }px)`;
    });
  });
})();

// Confetti util
function fxConfetti(EMO=['✨','🎉','🌟']){
  const cont=document.createElement('div'); cont.className='confetti'; document.body.appendChild(cont);
  const pieces=28;
  for(let i=0;i<pieces;i++){
    const s=document.createElement('div'); s.className='piece'; s.textContent=EMO[i%EMO.length];
    const left=Math.random()*100, delay=Math.random()*120, time=900+Math.random()*900;
    const rot=(Math.random()*360)|0, rot2=rot+(180+Math.random()*360);
    s.style.left=left+'vw';
    s.style.setProperty('--t', time+'ms');
    s.style.setProperty('--x', (Math.random()*40 - 20)+'px');
    s.style.setProperty('--r', rot+'deg');
    s.style.setProperty('--rr', rot2+'deg');
    s.style.animationDelay=delay+'ms';
    cont.appendChild(s);
  }
  setTimeout(()=>cont.remove(), 2400);
}
</script>
</body>
</html>
