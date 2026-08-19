<?php
require_once __DIR__ . '/config.php';
require_login();

/* =========================
   HELPERS
   ========================= */
function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function avatar_url_dash($uid){
  $base = 'uploads/avatars';
  foreach (['jpg','jpeg','png','webp'] as $ext){
    $p = __DIR__ . "/$base/$uid.$ext";
    if (is_file($p)) return "$base/$uid.$ext?v=".filemtime($p);
  }
  return 'img/avatar-placeholder.png';
}
function has_table(mysqli $db, string $name): bool {
  $res = $db->query("SHOW TABLES LIKE '".$db->real_escape_string($name)."'");
  return $res && $res->num_rows>0;
}
function has_column(mysqli $db, string $table, string $col): bool {
  $res = $db->query("SHOW COLUMNS FROM `".$db->real_escape_string($table)."` LIKE '".$db->real_escape_string($col)."'");
  return $res && $res->num_rows>0;
}

$UID    = (int)($_SESSION['user_id'] ?? 0);
$ROLE   = $_SESSION['user_role'] ?? 'Customer';
$NAME   = $_SESSION['user_name'] ?? '';
$AVATAR = avatar_url_dash($UID);

if ($UID<=0) { header('Location: '.base_url('auth/login.php')); exit; }

/* =========================
   LOAD USER (dinamis kolom)
   ========================= */
$userCols = [];
$maybe = ['name','full_name','email','phone','address','password_hash','password','settings_json'];
$resCols = $mysqli->query("SHOW COLUMNS FROM users");
$colsAvail = [];
while ($c = $resCols->fetch_assoc()) $colsAvail[] = $c['Field'];
foreach ($maybe as $m) if (in_array($m, $colsAvail, true)) $userCols[] = $m;

$selectCols = $userCols ? (implode(',', array_map(fn($c)=>"`$c`", $userCols))) : '';
$user = ['name'=>$NAME,'email'=>'','phone'=>'','address'=>'','settings_json'=>null];
if ($selectCols!=='') {
  $st = $mysqli->prepare("SELECT $selectCols FROM users WHERE id=? LIMIT 1");
  $st->bind_param('i',$UID); $st->execute(); $r=$st->get_result()->fetch_assoc(); $st->close();
  if ($r) { $user = array_merge($user, $r); }
}
$displayName = $user['full_name'] ?? ($user['name'] ?? $NAME);

/* =========================
   PREFERENSI (default)
   ========================= */
$DEFAULT_PREFS = [
  'theme'=>'light',          // light | dark | system
  'density'=>'cozy',         // cozy | compact
  'language'=>'id',          // id | en
  'currency'=>'IDR',
  'date_format'=>'d/m/Y',
  'time_format'=>'24h',      // 24h | 12h
  'notif_email'=>true,
  'notif_whatsapp'=>true,
  'sound'=>false
];

$prefs = $DEFAULT_PREFS;
if (isset($user['settings_json']) && strlen((string)$user['settings_json'])) {
  $dec = json_decode((string)$user['settings_json'], true);
  if (is_array($dec)) $prefs = array_merge($prefs, $dec);
} elseif (!empty($_SESSION['user_prefs']) && is_array($_SESSION['user_prefs'])) {
  $prefs = array_merge($prefs, $_SESSION['user_prefs']);
}

/* =========================
   HANDLE POST
   ========================= */
$toast = null; $toastType='success';

if ($_SERVER['REQUEST_METHOD']==='POST') {
  $act = $_POST['action'] ?? '';

  // 1) Update profil dasar
  if ($act==='update_profile') {
    $nm  = trim($_POST['name'] ?? '');
    $em  = trim($_POST['email'] ?? '');
    $ph  = trim($_POST['phone'] ?? '');
    $adr = trim($_POST['address'] ?? '');

    // bangun SET dinamis
    $set = []; $types=''; $vals=[];
    if (in_array('full_name',$colsAvail,true)) { $set[]='full_name=?'; $types.='s'; $vals[]=$nm; }
    elseif (in_array('name',$colsAvail,true))  { $set[]='name=?'; $types.='s'; $vals[]=$nm; }
    if (in_array('email',$colsAvail,true))     { $set[]='email=?'; $types.='s'; $vals[]=$em; }
    if (in_array('phone',$colsAvail,true))     { $set[]='phone=?'; $types.='s'; $vals[]=$ph; }
    if (in_array('address',$colsAvail,true))   { $set[]='address=?'; $types.='s'; $vals[]=$adr; }

    if ($set) {
      $sql="UPDATE users SET ".implode(',',$set)." WHERE id=?";
      $st=$mysqli->prepare($sql); $types.='i'; $vals[]=&$UID;
      $st->bind_param($types, ...$vals); $st->execute(); $st->close();
      $_SESSION['user_name']=$nm;
      $toast='Profil berhasil diperbarui.';
    } else {
      $toastType='warn'; $toast='Tidak ada kolom profil yang bisa diperbarui.';
    }
  }

  // 2) Upload avatar
  if ($act==='upload_avatar' && isset($_FILES['avatar']) && is_uploaded_file($_FILES['avatar']['tmp_name'])) {
    $err = $_FILES['avatar']['error'] ?? UPLOAD_ERR_OK;
    if ($err===UPLOAD_ERR_OK) {
      $f = $_FILES['avatar'];
      if ($f['size'] > 2*1024*1024) { $toastType='error'; $toast='Ukuran maksimal 2MB.'; }
      else {
        $fi = @getimagesize($f['tmp_name']);
        if (!$fi) { $toastType='error'; $toast='File bukan gambar.'; }
        else {
          $mime = $fi['mime'] ?? '';
          $ext = ($mime==='image/png')?'png':(($mime==='image/webp')?'webp':'jpg');
          @mkdir(__DIR__.'/uploads/avatars',0775,true);
          // hapus ext lain agar hanya satu file yang aktif
          foreach (['jpg','jpeg','png','webp'] as $e) @unlink(__DIR__."/uploads/avatars/$UID.$e");
          $dest = __DIR__."/uploads/avatars/$UID.$ext";
          if (move_uploaded_file($f['tmp_name'],$dest)) {
            $AVATAR = avatar_url_dash($UID);
            $toast='Avatar berhasil diunggah.';
          } else { $toastType='error'; $toast='Gagal menyimpan avatar.'; }
        }
      }
    } else {
      $toastType='error'; $toast='Upload gagal (kode '.$err.').';
    }
  }

  // 3) Ganti password
  if ($act==='change_password') {
    $old = $_POST['old_password'] ?? '';
    $new = $_POST['new_password'] ?? '';
    $rep = $_POST['repeat_password'] ?? '';
    if ($new==='' || strlen($new)<6) { $toastType='error'; $toast='Password baru minimal 6 karakter.'; }
    elseif ($new!==$rep) { $toastType='error'; $toast='Ulangi password tidak cocok.'; }
    else {
      // ambil hash lama
      $phc=null; $plain=null;
      if (in_array('password_hash',$colsAvail,true)) {
        $st=$mysqli->prepare("SELECT password_hash FROM users WHERE id=?"); $st->bind_param('i',$UID);
        $st->execute(); $st->bind_result($phc); $st->fetch(); $st->close();
      } elseif (in_array('password',$colsAvail,true)) {
        $st=$mysqli->prepare("SELECT password FROM users WHERE id=?"); $st->bind_param('i',$UID);
        $st->execute(); $st->bind_result($plain); $st->fetch(); $st->close();
      }
      $okOld=false;
      if ($phc!==null) $okOld = password_verify($old, $phc);
      elseif ($plain!==null) $okOld = hash_equals((string)$plain, (string)$old); // fallback (plaintext)
      else $okOld=true; // jika tidak ada kolom, izinkan (jarang terjadi)

      if (!$okOld) { $toastType='error'; $toast='Password lama salah.'; }
      else {
        $hash = password_hash($new, PASSWORD_DEFAULT);
        if (in_array('password_hash',$colsAvail,true)) {
          $st=$mysqli->prepare("UPDATE users SET password_hash=? WHERE id=?");
          $st->bind_param('si',$hash,$UID); $st->execute(); $st->close();
        } elseif (in_array('password',$colsAvail,true)) {
          $st=$mysqli->prepare("UPDATE users SET password=? WHERE id=?");
          $st->bind_param('si',$hash,$UID); $st->execute(); $st->close();
        }
        $toast='Password berhasil diganti.';
      }
    }
  }

  // 4) Simpan preferensi
  if ($act==='save_prefs') {
    $prefs['theme']         = $_POST['theme'] ?? $prefs['theme'];
    $prefs['density']       = $_POST['density'] ?? $prefs['density'];
    $prefs['language']      = $_POST['language'] ?? $prefs['language'];
    $prefs['currency']      = $_POST['currency'] ?? $prefs['currency'];
    $prefs['date_format']   = $_POST['date_format'] ?? $prefs['date_format'];
    $prefs['time_format']   = $_POST['time_format'] ?? $prefs['time_format'];
    $prefs['notif_email']   = isset($_POST['notif_email']);
    $prefs['notif_whatsapp']= isset($_POST['notif_whatsapp']);
    $prefs['sound']         = isset($_POST['sound']);

    $_SESSION['user_prefs']=$prefs;
    if (in_array('settings_json',$colsAvail,true)) {
      $json = json_encode($prefs, JSON_UNESCAPED_UNICODE);
      $st=$mysqli->prepare("UPDATE users SET settings_json=? WHERE id=?");
      $st->bind_param('si',$json,$UID); $st->execute(); $st->close();
      $toast='Preferensi disimpan ✅';
    } else {
      $toast='Preferensi disimpan di sesi (kolom settings_json belum ada).';
      $toastType='warn';
    }
  }
}

/* Refresh avatar URL jika ada update */
$AVATAR = avatar_url_dash($UID);
?>
<!doctype html>
<html lang="id" data-theme="<?= h($prefs['theme']) ?>">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Embun Laundry · Pengaturan</title>
<link rel="stylesheet" href="assets/style.css"/>
</head>
<body>

<div class="wrap">
  <aside class="sidebar">
    <div class="brand">
      <img src="img/Logo.png" alt="Embun Laundry" class="logo-img" width="36" height="36"/>
      <div class="name">Embun Laundry</div>
    </div>

    <!-- MENU UTAMA: tanpa Pengaturan -->
    <nav class="nav">
      <a href="<?= base_url('dashboard.php')?>"><span>🏠</span><span>Dashboard</span></a>
      <a href="<?= base_url('pesanan.php')?>"><span>🧺</span><span>Pesanan</span></a>
      <a href="<?= base_url('pelanggan.php')?>"><span>👥</span><span>Pelanggan</span></a>
      <a href="<?= base_url('layanan.php')?>"><span>💲</span><span>Layanan & Harga</span></a>
      <a href="<?= base_url('delivery.php')?>"><span>🚚</span><span>Pickup & Delivery</span></a>
      <a href="<?= base_url('laporan.php')?>"><span>📑</span><span>Laporan</span></a>
      <a href="<?= base_url('promo.php')?>"><span>🎟️</span><span>Promo & Diskon</span></a>
    </nav>

    <!-- KIRI BAWAH: Profil, Pengaturan (AKTIF), Keluar -->
    <div class="side-bottom">
      <a href="<?= base_url('profile.php')?>"><span>👤</span><span>Profil</span></a>
      <a class="active" href="<?= base_url('settings.php')?>"><span>⚙️</span><span>Pengaturan</span></a>
      <a href="<?= base_url('auth/logout.php')?>"><span>🚪</span><span>Keluar</span></a>
    </div>
  </aside>

  <section class="main">
    <div class="topbar">
      <div class="topbar-inner">
        <div class="search">🔎 <input type="text" placeholder="Cari pengaturan... (visual saja)"></div>
        <div class="user">
          <img src="<?= h($AVATAR) ?>" alt="Avatar" class="avatar-img"/>
          <div>
            <div style="font-weight:800"><?= h($displayName) ?></div>
            <div class="sub"><?= h($ROLE) ?></div>
          </div>
        </div>
      </div>
    </div>

    <div class="content">
      <div class="h1">Pengaturan</div>
      <div class="sub">Atur profil, keamanan, dan preferensi aplikasi kamu.</div>

      <div class="grid" style="margin-top:14px">
        <!-- KIRI: Profil + Keamanan -->
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <h3>Profil Akun</h3>
            <span class="badge">👤 Akun</span>
          </div>

          <!-- Form Avatar -->
          <div style="display:flex;gap:12px;align-items:center;margin-bottom:18px;background:var(--blue-soft);padding:12px;border-radius:14px">
            <img src="<?= h($AVATAR) ?>" alt="avatar" style="width:54px;height:54px;border-radius:14px;object-fit:cover;border:2px solid #e5e7eb">
            <form method="post" enctype="multipart/form-data" id="avatarForm" style="display:flex;gap:8px;align-items:center;flex:1">
              <input type="hidden" name="action" value="upload_avatar">
              <input class="input" type="file" name="avatar" id="avatar" accept="image/*" style="max-width:260px">
              <button class="btn btn-primary" id="btnUp">Unggah</button>
            </form>
          </div>

          <!-- Form Detail Profil -->
          <form method="post" class="form" id="profileForm">
            <input type="hidden" name="action" value="update_profile">
            <div class="row">
              <div>
                <label>Nama</label>
                <input class="input" name="name" value="<?= h($displayName) ?>" required>
              </div>
              <div>
                <label>Email</label>
                <input class="input" name="email" type="email" value="<?= h($user['email'] ?? '') ?>" placeholder="email@contoh.com">
              </div>
            </div>
            <div class="row">
              <div>
                <label>No. HP</label>
                <input class="input" name="phone" value="<?= h($user['phone'] ?? '') ?>" placeholder="08xxxxxxxxxx">
              </div>
              <div>
                <label>Alamat</label>
                <input class="input" name="address" value="<?= h($user['address'] ?? '') ?>" placeholder="Alamat lengkap">
              </div>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
              <button class="btn btn-ghost" type="reset">Reset</button>
              <button class="btn btn-primary">Simpan Profil</button>
            </div>
          </form>

          <hr style="border:none;border-top:1px dashed var(--line);margin:16px 0">

          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <h3>Keamanan</h3>
            <span class="badge wiggle">🔒 Password</span>
          </div>
          <form method="post" id="passForm">
            <input type="hidden" name="action" value="change_password">
            <div class="row">
              <div>
                <label>Password Lama</label>
                <input class="input" type="password" name="old_password" required>
              </div>
              <div>
                <label>Password Baru</label>
                <input class="input" type="password" name="new_password" minlength="6" required>
              </div>
            </div>
            <div class="row" style="align-items:flex-end">
              <div>
                <label>Ulangi Password Baru</label>
                <input class="input" type="password" name="repeat_password" minlength="6" required>
              </div>
              <div style="display:flex;gap:8px;justify-content:flex-end">
                <button class="btn btn-danger">Ganti Password</button>
              </div>
            </div>
          </form>
        </div>

        <!-- KANAN: Preferensi -->
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <h3>Preferensi Aplikasi</h3>
            <span class="badge wiggle">✨ Tampilan</span>
          </div>
          <form method="post" id="prefsForm">
            <input type="hidden" name="action" value="save_prefs">
            <div class="row">
              <div>
                <label>Tema</label>
                <select name="theme" id="selTheme">
                  <option value="light"  <?= $prefs['theme']==='light'?'selected':'' ?>>Light</option>
                  <option value="dark"   <?= $prefs['theme']==='dark'?'selected':'' ?>>Dark</option>
                  <option value="system" <?= $prefs['theme']==='system'?'selected':'' ?>>System</option>
                </select>
              </div>
              <div>
                <label>Kerapatan</label>
                <select name="density">
                  <option value="cozy"    <?= $prefs['density']==='cozy'?'selected':'' ?>>Nyaman</option>
                  <option value="compact" <?= $prefs['density']==='compact'?'selected':'' ?>>Kompak</option>
                </select>
              </div>
            </div>

            <div class="row">
              <div>
                <label>Bahasa</label>
                <select name="language">
                  <option value="id" <?= $prefs['language']==='id'?'selected':'' ?>>Indonesia</option>
                  <option value="en" <?= $prefs['language']==='en'?'selected':'' ?>>English</option>
                </select>
              </div>
              <div>
                <label>Mata Uang</label>
                <select name="currency">
                  <option value="IDR" <?= $prefs['currency']==='IDR'?'selected':'' ?>>IDR (Rp)</option>
                  <option value="USD" <?= $prefs['currency']==='USD'?'selected':'' ?>>USD ($)</option>
                </select>
              </div>
            </div>

            <div class="row">
              <div>
                <label>Format Tanggal</label>
                <select name="date_format">
                  <option value="d/m/Y" <?= $prefs['date_format']==='d/m/Y'?'selected':'' ?>>dd/mm/yyyy</option>
                  <option value="m/d/Y" <?= $prefs['date_format']==='m/d/Y'?'selected':'' ?>>mm/dd/yyyy</option>
                  <option value="Y-m-d" <?= $prefs['date_format']==='Y-m-d'?'selected':'' ?>>yyyy-mm-dd</option>
                </select>
              </div>
              <div>
                <label>Format Waktu</label>
                <select name="time_format">
                  <option value="24h" <?= $prefs['time_format']==='24h'?'selected':'' ?>>24 Jam</option>
                  <option value="12h" <?= $prefs['time_format']==='12h'?'selected':'' ?>>12 Jam (AM/PM)</option>
                </select>
              </div>
            </div>

            <div style="margin:8px 0 6px;font-weight:800">Notifikasi</div>
            <div class="row">
              <div style="display:flex;align-items:center;justify-content:space-between;border:1px dashed var(--line);border-radius:14px;padding:10px 12px">
                <div>
                  <div style="font-weight:800">Email</div>
                  <div class="sub">Kirim update via email</div>
                </div>
                <label class="toggle<?= $prefs['notif_email']?' on':'' ?>">
                  <input type="checkbox" name="notif_email" <?= $prefs['notif_email']?'checked':'' ?> hidden>
                  <span class="knob"></span>
                </label>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;border:1px dashed var(--line);border-radius:14px;padding:10px 12px">
                <div>
                  <div style="font-weight:800">WhatsApp</div>
                  <div class="sub">Kirim update via WA</div>
                </div>
                <label class="toggle<?= $prefs['notif_whatsapp']?' on':'' ?>">
                  <input type="checkbox" name="notif_whatsapp" <?= $prefs['notif_whatsapp']?'checked':'' ?> hidden>
                  <span class="knob"></span>
                </label>
              </div>
            </div>

            <div class="row" style="align-items:center">
              <div style="display:flex;align-items:center;gap:10px">
                <label class="toggle<?= $prefs['sound']?' on':'' ?>">
                  <input type="checkbox" name="sound" <?= $prefs['sound']?'checked':'' ?> hidden>
                  <span class="knob"></span>
                </label>
                <span>Suara klik</span>
              </div>
              <div style="display:flex;gap:8px;justify-content:flex-end">
                <button type="button" class="btn" id="btnTest">🔔 Tes Notifikasi</button>
                <button class="btn btn-primary">Simpan Preferensi</button>
              </div>
            </div>
          </form>
        </div>
      </div> <!-- /grid -->
    </div>
  </section>
</div>

<?php if ($toast): ?>
  <div class="toast <?= h($toastType) ?>" id="toast"><?= h($toast) ?></div>
<?php endif; ?>

<script>
// Ripple untuk semua tombol
document.addEventListener('click', function(e){
  const btn = e.target.closest('.btn'); if(!btn) return;
  const circle = document.createElement('span');
  const d = Math.max(btn.clientWidth, btn.clientHeight);
  circle.style.width = circle.style.height = d+'px';
  const r = btn.getBoundingClientRect();
  circle.style.left = (e.clientX - r.left - d/2) + 'px';
  circle.style.top  = (e.clientY - r.top  - d/2) + 'px';
  circle.className='ripple';
  btn.appendChild(circle); setTimeout(()=>circle.remove(), 600);
});

// Toggle pill animasi
document.querySelectorAll('.toggle').forEach(tg=>{
  tg.addEventListener('click', (ev)=>{
    if (ev.target.tagName.toLowerCase()==='input') return;
    tg.classList.toggle('on');
    const inp = tg.querySelector('input[type=checkbox]');
    if (inp) inp.checked = tg.classList.contains('on');
  });
});

// Live switch Theme (system = ikuti prefers-color-scheme)
const selTheme = document.getElementById('selTheme');
function applyTheme(v){
  if (v==='system'){
    const sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', sysDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', v);
  }
}
selTheme?.addEventListener('change', e=> applyTheme(e.target.value));
applyTheme("<?= h($prefs['theme']) ?>");

// Avatar form submit (separate form)
document.getElementById('btnUp')?.addEventListener('click', (e)=>{
  e.preventDefault();
  const form = document.getElementById('avatarForm');
  const file = document.getElementById('avatar');
  if (!file.value) { ping('Pilih gambar dulu ya.'); return; }
  form.submit();
});

// Toast auto hide
const toast = document.getElementById('toast');
if (toast){ setTimeout(()=>toast.style.display='none', 2600); }

// Tes notifikasi (mini animasi + audio)
function ping(msg){
  const t=document.createElement('div');
  t.className='toast'; t.style.bottom='64px'; t.textContent=msg||'Mantap! 🎉';
  document.body.appendChild(t); setTimeout(()=>{ t.style.display='none'; t.remove(); }, 1800);
}
document.getElementById('btnTest')?.addEventListener('click', ()=>{
  ping('Notifikasi contoh dikirim ✅');
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(); const g=ctx.createGain();
    o.type='triangle'; o.frequency.value=880; o.connect(g); g.connect(ctx.destination);
    g.gain.value=.02; o.start(); setTimeout(()=>{o.stop();ctx.close()},180);
  }catch{}
});
</script>
</body>
</html>
