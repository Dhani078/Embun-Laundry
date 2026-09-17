<?php
require_once __DIR__ . '/config.php';
require_login();

/* =========================
   RBAC
   ========================= */
$role       = $_SESSION['user_role'] ?? 'Customer';
$isStaff    = in_array($role, ['Admin','Owner','Staff'], true);
$isCustomer = !$isStaff;

/* =========================
   Helpers (HTML escape, rupiah, avatar) 
   ========================= */
if (!function_exists('h')) {
  function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
}
if (!function_exists('rupiah')) {
  function rupiah($n){ return 'Rp '.number_format((int)$n,0,',','.'); }
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
$AVATAR = avatar_url_dash((int)($_SESSION['user_id'] ?? 0));

function qstring(array $extra = []) {
  $keep = ['q','cat','status'];
  $curr = array_intersect_key($_GET, array_flip($keep));
  return http_build_query(array_merge($curr, $extra));
}
function new_srv_code(mysqli $db, $prefix='SRV-'){
  $res = $db->query("SELECT MAX(CAST(SUBSTRING_INDEX(code,'-',-1) AS UNSIGNED)) AS mx FROM services WHERE code LIKE 'SRV-%'");
  $n = (int)($res->fetch_assoc()['mx'] ?? 0);
  return $prefix . str_pad((string)($n+1), 2, '0', STR_PAD_LEFT);
}

/* =========================
   Handle POST (CRUD)
   ========================= */
if ($_SERVER['REQUEST_METHOD']==='POST') {
  $act = $_POST['action'] ?? '';

  // Toggle aktif (AJAX)
  if ($act==='toggle_active') {
    header('Content-Type: application/json; charset=utf-8');
    if (!$isStaff) { echo json_encode(['ok'=>false,'msg'=>'unauthorized']); exit; }
    $id  = (int)($_POST['id'] ?? 0);
    $val = (int)($_POST['is_active'] ?? 0);
    $st = $mysqli->prepare("UPDATE services SET is_active=?, updated_at=? WHERE id=?");
    $now = (new DateTime())->format('Y-m-d H:i:s');
    $st->bind_param('isi', $val, $now, $id);
    $ok = $st->execute(); $st->close();
    echo json_encode(['ok'=>$ok]); exit;
  }

  // Create
  if ($act==='create_service' && $isStaff) {
    $code  = trim($_POST['code'] ?? '') ?: new_srv_code($mysqli);
    $name  = trim($_POST['name'] ?? '');
    $desc  = trim($_POST['description'] ?? '');
    $unit  = trim($_POST['unit'] ?? 'kg');
    $price = max(0,(int)($_POST['price'] ?? 0));
    $hours = max(0,(int)($_POST['est_hours'] ?? 0));
    $cat   = trim($_POST['category'] ?? 'Reguler');
    $badge = trim($_POST['badge'] ?? '');
    $active= (int)($_POST['is_active'] ?? 1);
    if ($name!=='') {
      $now = (new DateTime())->format('Y-m-d H:i:s');
      $st = $mysqli->prepare("INSERT INTO services
        (code,name,description,unit,price,duration_hours,category,is_active,badge,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)");
      $st->bind_param('ssssiisisss', $code,$name,$desc,$unit,$price,$hours,$cat,$active,$badge,$now,$now);
      $st->execute(); $st->close();
    }
    header('Location: '.base_url('layanan.php').'?'.qstring()); exit;
  }

  // Update
  if ($act==='update_service' && $isStaff) {
    $id    = (int)($_POST['id'] ?? 0);
    $code  = trim($_POST['code'] ?? '');
    $name  = trim($_POST['name'] ?? '');
    $desc  = trim($_POST['description'] ?? '');
    $unit  = trim($_POST['unit'] ?? 'kg');
    $price = max(0,(int)($_POST['price'] ?? 0));
    $hours = max(0,(int)($_POST['est_hours'] ?? 0));
    $cat   = trim($_POST['category'] ?? 'Reguler');
    $badge = trim($_POST['badge'] ?? '');
    $active= (int)($_POST['is_active'] ?? 1);
    if ($id>0 && $name!=='') {
      $now = (new DateTime())->format('Y-m-d H:i:s');
      $st = $mysqli->prepare("UPDATE services
        SET code=?, name=?, description=?, unit=?, price=?, duration_hours=?, category=?, is_active=?, badge=?, updated_at=?
        WHERE id=?");
      $st->bind_param('ssssiisissi', $code,$name,$desc,$unit,$price,$hours,$cat,$active,$badge,$now,$id);
      $st->execute(); $st->close();
    }
    header('Location: '.base_url('layanan.php').'?'.qstring()); exit;
  }

  // Delete
  if ($act==='delete_service' && $isStaff) {
    $id = (int)($_POST['id'] ?? 0);
    if ($id>0) { $st=$mysqli->prepare("DELETE FROM services WHERE id=?"); $st->bind_param('i',$id); $st->execute(); $st->close(); }
    header('Location: '.base_url('layanan.php').'?'.qstring()); exit;
  }
}

/* =========================
   Filters
   ========================= */
$q      = trim($_GET['q'] ?? '');
$cat    = trim($_GET['cat'] ?? '');
$status = trim($_GET['status'] ?? ''); // aktif/nonaktif/''

/* =========================
   KPI
   ========================= */
$kpi = ['total'=>0,'active'=>0,'avg_price'=>0,'avg_hours'=>0];
$kpi['total']  = (int)($mysqli->query("SELECT COUNT(*) c FROM services")->fetch_assoc()['c'] ?? 0);
$kpi['active'] = (int)($mysqli->query("SELECT COUNT(*) c FROM services WHERE is_active=1")->fetch_assoc()['c'] ?? 0);
$r = $mysqli->query("SELECT ROUND(AVG(price)) ap, ROUND(AVG(NULLIF(duration_hours,0))) ah FROM services WHERE is_active=1");
if ($r){
  $tmp=$r->fetch_assoc();
  $kpi['avg_price']=(int)($tmp['ap']??0);
  $kpi['avg_hours']=(int)($tmp['ah']??0);
  $r->free();
}

/* =========================
   Query list
   ========================= */
$sql = "SELECT id, code, name, description, unit, price,
               duration_hours AS est_hours,
               category, is_active, is_popular, badge, created_at, updated_at
        FROM services
        WHERE 1 ";
$types=''; $params=[];
if ($q!==''){ $sql.=" AND (code LIKE CONCAT('%',?,'%') OR name LIKE CONCAT('%',?,'%') OR description LIKE CONCAT('%',?,'%'))"; $types.='sss'; array_push($params,$q,$q,$q); }
if ($cat!==''){ $sql.=" AND category=?"; $types.='s'; $params[]=$cat; }
if ($status==='aktif'){ $sql.=" AND is_active=1"; }
if ($status==='nonaktif'){ $sql.=" AND is_active=0"; }
$sql.=" ORDER BY is_active DESC, id ASC LIMIT 300";

$st = $mysqli->prepare($sql);
if ($types){ $bind = [$types]; foreach($params as $k=>$p){ $bind[] = &$params[$k]; } call_user_func_array([$st,'bind_param'],$bind); }
$st->execute(); $res=$st->get_result();
$rows=[]; while($r=$res->fetch_assoc()) $rows[]=$r; $st->close();

$cats = ['Reguler','Premium','Spesial'];
$units= ['kg','pcs','item'];
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Embun Laundry · Layanan & Harga</title>
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
      <a href="<?= base_url('pelanggan.php')?>"><span>👥</span><span>Pelanggan</span></a>
      <a class="active" href="<?= base_url('layanan.php')?>"><span>💲</span><span>Layanan & Harga</span></a>
      <a href="delivery.php"><span>🚚</span><span>Pickup & Delivery</span></a>
      <a href="laporan.php"><span>📑</span><span>Laporan</span></a>
      <a href="promo.php"><span>🎟️</span><span>Promo & Diskon</span></a>
    </nav>

    <!-- Footer kiri bawah -->
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
          <form style="display:flex;gap:10px;align-items:center;width:100%" method="get">
            <input type="text" name="q" value="<?= h($q) ?>" placeholder="Cari layanan, ID, deskripsi…" />
            <select name="cat" class="btn">
              <option value="">Semua Kategori</option>
              <?php foreach($cats as $c): ?><option value="<?= h($c) ?>" <?= $cat===$c?'selected':'' ?>><?= h($c) ?></option><?php endforeach; ?>
            </select>
            <select name="status" class="btn">
              <option value="">Semua Status</option>
              <option value="aktif" <?= $status==='aktif'?'selected':'' ?>>Aktif</option>
              <option value="nonaktif" <?= $status==='nonaktif'?'selected':'' ?>>Nonaktif</option>
            </select>
            <button class="btn">Filter</button>
          </form>
        </div>
        <?php if ($isStaff): ?><button class="btn btn-primary" id="btnAdd">+ Tambah Layanan</button><?php endif; ?>

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
      <div class="h1">Layanan & Harga</div>
      <div class="sub">Kelola jenis layanan dan penetapan harga</div>

      <div class="kpis">
        <div class="kpi"><div class="title">Total Layanan</div><div class="val"><?= (int)$kpi['total'] ?></div><div class="mini">📦</div><div class="blob bl-blue"></div></div>
        <div class="kpi"><div class="title">Layanan Aktif</div><div class="val"><?= (int)$kpi['active'] ?></div><div class="mini">✅</div><div class="blob bl-green"></div></div>
        <div class="kpi"><div class="title">Harga Rata-rata</div><div class="val"><?= rupiah($kpi['avg_price']) ?></div><div class="mini">💸</div><div class="blob bl-amber"></div></div>
        <div class="kpi"><div class="title">Durasi Rata-rata</div><div class="val"><?= (int)$kpi['avg_hours'] ?> Jam</div><div class="mini">⏱</div><div class="blob bl-violet"></div></div>
      </div>

      <div class="toolbar" style="justify-content:flex-end">
        <button class="btn" id="btnExport">⬇️ Export CSV</button>
      </div>

      <div class="card" style="padding:6px">
        <table class="table" id="tbl">
          <thead>
            <tr>
              <th>ID Layanan</th>
              <th>Nama Layanan</th>
              <th>Satuan</th>
              <th>Harga (Rp)</th>
              <th>Durasi Estimasi</th>
              <th>Kategori</th>
              <th>Status</th>
              <th>Badge</th>
              <th style="text-align:right">Aksi</th>
            </tr>
          </thead>
          <tbody>
          <?php foreach($rows as $r):
            $bc = $r['category']==='Premium'?'bd-prem':($r['category']==='Spesial'?'bd-sp':'bd-cat');
            $bs = $r['is_active']? 'bd-on':'bd-off';
          ?>
            <tr data-json='<?= h(json_encode($r)) ?>'>
              <td><?= h($r['code']) ?></td>
              <td>
                <div style="font-weight:800"><?= h($r['name']) ?></div>
                <div class="sub"><?= h($r['description'] ?: '-') ?></div>
              </td>
              <td><?= h($r['unit']) ?></td>
              <td><?= rupiah($r['price']) ?></td>
              <td>⏱ <?= (int)$r['est_hours'] ?> Jam</td>
              <td><span class="badge <?= $bc ?>"><?= h($r['category']) ?></span></td>
              <td>
                <span class="badge <?= $bs ?>"><?= $r['is_active']?'Aktif':'Nonaktif' ?></span>
                <?php if ($isStaff): ?>
                  <button class="btn-icon act-toggle" title="Toggle aktif" data-on="<?= (int)$r['is_active'] ?>">🔁</button>
                <?php endif; ?>
              </td>
              <td><?= h($r['badge'] ?: '-') ?></td>
              <td class="actions" style="text-align:right;white-space:nowrap">
                <a href="#" class="act-view" title="Detail">👁</a>
                <?php if ($isStaff): ?>
                  <a href="#" class="act-edit" title="Ubah">✏️</a>
                  <form method="post" style="display:inline" onsubmit="return confirm('Hapus layanan ini?')">
                    <input type="hidden" name="action" value="delete_service">
                    <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
                    <button title="Hapus">🗑️</button>
                  </form>
                <?php endif; ?>
              </td>
            </tr>
          <?php endforeach; if(!$rows): ?>
            <tr><td colspan="9" class="sub" style="text-align:center;padding:28px">Belum ada data sesuai filter.</td></tr>
          <?php endif; ?>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</div>

<!-- MODAL -->
<div class="modal" id="svcModal" aria-hidden="true">
  <div class="sheet">
    <h3 id="modalTitle">Tambah Layanan</h3>
    <form method="post" id="svcForm">
      <input type="hidden" name="action" value="create_service" id="formAction">
      <input type="hidden" name="id" id="svcId">
      <div class="row">
        <div><label>ID Layanan (otomatis jika kosong)</label><input class="input" name="code" id="fCode" placeholder="SRV-XX"></div>
        <div><label>Nama Layanan</label><input class="input" name="name" id="fName" required></div>
      </div>
      <div class="row">
        <div>
          <label>Satuan</label>
          <select class="input" name="unit" id="fUnit">
            <?php foreach(['kg','pcs','item'] as $u): ?><option value="<?= h($u) ?>"><?= h($u) ?></option><?php endforeach; ?>
          </select>
        </div>
        <div><label>Harga</label><input class="input" type="number" min="0" step="500" name="price" id="fPrice" required></div>
        <div><label>Durasi (jam)</label><input class="input" type="number" min="0" step="1" name="est_hours" id="fHours" value="0"></div>
      </div>
      <div class="row">
        <div>
          <label>Kategori</label>
          <select class="input" name="category" id="fCat">
            <?php foreach(['Reguler','Premium','Spesial'] as $c): ?><option value="<?= h($c) ?>"><?= h($c) ?></option><?php endforeach; ?>
          </select>
        </div>
        <div><label>Badge</label><input class="input" name="badge" id="fBadge" placeholder="Popular, New, dsb"></div>
        <div>
          <label>Status</label>
          <select class="input" name="is_active" id="fActive">
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div><label>Deskripsi</label><textarea class="input" name="description" id="fDesc" rows="3" placeholder="Detail layanan (opsional)"></textarea></div>
      </div>
      <div class="actions">
        <button type="button" class="btn" id="btnClose">Batal</button>
        <?php if ($isStaff): ?><button class="btn btn-primary" type="submit">Simpan</button><?php endif; ?>
      </div>
    </form>
  </div>
</div>

<script>
// Ripple
document.addEventListener('click', function(e){
  const btn = e.target.closest('.btn, .btn-icon'); if(!btn) return;
  const circle = document.createElement('span');
  const d = Math.max(btn.clientWidth, btn.clientHeight);
  circle.className = 'ripple'; circle.style.width = circle.style.height = d+'px';
  circle.style.left = (e.clientX - btn.getBoundingClientRect().left - d/2) + 'px';
  circle.style.top  = (e.clientY - btn.getBoundingClientRect().top  - d/2) + 'px';
  btn.appendChild(circle); setTimeout(()=>circle.remove(),600);
});

// Export CSV
const ROWS = <?= json_encode($rows, JSON_UNESCAPED_UNICODE) ?>;
document.getElementById('btnExport')?.addEventListener('click', ()=>{
  if(!ROWS.length){ alert('Tidak ada data.'); return; }
  const head = ['Code','Nama','Deskripsi','Unit','Harga','DurasiJam','Kategori','Aktif','Badge','UpdatedAt'];
  const lines = [head.join(',')];
  for(const r of ROWS){
    lines.push([
      `"${r.code}"`,
      `"${r.name}"`,
      `"${(r.description||'').replace(/\r?\n/g,' ')}"`,
      r.unit,
      r.price,
      r.est_hours,
      r.category,
      r.is_active,
      `"${r.badge||''}"`,
      `"${r.updated_at||''}"`
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='services.csv'; a.click();
});

// Modal helpers
const modal = document.getElementById('svcModal');
const btnAdd = document.getElementById('btnAdd');
const btnClose = document.getElementById('btnClose');
function openCreate(){
  document.getElementById('modalTitle').textContent='Tambah Layanan';
  document.getElementById('formAction').value='create_service';
  document.getElementById('svcId').value='';
  ['fCode','fName','fDesc','fBadge'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fUnit').value='kg';
  document.getElementById('fPrice').value='';
  document.getElementById('fHours').value='0';
  document.getElementById('fCat').value='Reguler';
  document.getElementById('fActive').value='1';
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
}
function openEdit(data){
  document.getElementById('modalTitle').textContent='Ubah Layanan';
  document.getElementById('formAction').value='update_service';
  document.getElementById('svcId').value=data.id;
  document.getElementById('fCode').value=data.code||'';
  document.getElementById('fName').value=data.name||'';
  document.getElementById('fDesc').value=data.description||'';
  document.getElementById('fUnit').value=data.unit||'kg';
  document.getElementById('fPrice').value=data.price||0;
  document.getElementById('fHours').value=data.est_hours||0;
  document.getElementById('fCat').value=data.category||'Reguler';
  document.getElementById('fBadge').value=data.badge||'';
  document.getElementById('fActive').value = String(data.is_active||0);
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
}
function closeModal(){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }
btnAdd?.addEventListener('click', openCreate);
btnClose.addEventListener('click', closeModal);
modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(); });

// Row actions
document.querySelectorAll('#tbl tbody tr').forEach(tr=>{
  const data = JSON.parse(tr.dataset.json);
  tr.querySelector('.act-view').addEventListener('click', e=>{
    e.preventDefault();
    alert(
      `ID: ${data.code}\n`+
      `Nama: ${data.name}\n`+
      `Kategori: ${data.category} | ${data.is_active?'Aktif':'Nonaktif'}\n`+
      `Harga: Rp ${Number(data.price).toLocaleString('id-ID')} / ${data.unit}\n`+
      `Durasi: ${data.est_hours} jam\n\n`+
      `${data.description||''}`
    );
  });
  const ed = tr.querySelector('.act-edit'); if(ed){ ed.addEventListener('click', e=>{ e.preventDefault(); openEdit(data); }); }
  const tg = tr.querySelector('.act-toggle'); if(tg){
    tg.addEventListener('click', async ()=>{
      tg.classList.add('processing'); // animasi spin sementara
      const fd = new FormData(); fd.append('action','toggle_active'); fd.append('id', data.id); fd.append('is_active', data.is_active?0:1);
      try{
        const res = await fetch('<?= h(base_url('layanan.php')) ?>',{method:'POST',body:fd});
        const js  = await res.json();
        if(js.ok) location.reload(); else { tg.classList.remove('processing'); alert('Gagal toggle status.'); }
      }catch(e){ tg.classList.remove('processing'); alert('Gagal toggle status.'); }
    });
  }
});

// ====== Dropdown Profil (avatar img bisa dipencet) ======
const userBtn  = document.getElementById('userMenuBtn');
const userMenu = document.getElementById('userMenu');
userBtn?.addEventListener('click', (e)=>{ e.stopPropagation(); userMenu.classList.toggle('show'); });
document.addEventListener('click', (e)=>{ 
  if (!userMenu.contains(e.target) && !userBtn.contains(e.target)) userMenu.classList.remove('show');
});

/* ==========================================================
   🎛️ Interaktif 3D Tilt (tanpa ubah HTML)
   ========================================================== */
(function(){
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const clamp=(n,min,max)=>Math.min(Math.max(n,min),max);
  function attachTilt(el, max=10){
    let rect=null, rafId=null;
    const onMove=(e)=>{
      rect = rect || el.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top  + rect.height/2;
      const dx = (e.clientX - cx) / (rect.width/2);
      const dy = (e.clientY - cy) / (rect.height/2);
      const rx = clamp(-dy * max, -max, max);
      const ry = clamp( dx * max, -max, max);
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(()=>{ el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`; el.style.boxShadow = '0 24px 48px rgba(2,6,23,.10)'; });
    };
    const onLeave=()=>{ rect=null; if(rafId) cancelAnimationFrame(rafId); el.style.transform=''; el.style.boxShadow=''; };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
  }
  document.querySelectorAll('.kpi, .card').forEach(el=>attachTilt(el, 6));
})();
</script>
</body>
</html>
