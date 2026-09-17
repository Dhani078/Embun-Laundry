<?php
require_once __DIR__ . '/config.php';
require_login();

$user_id = (int)($_SESSION['user_id'] ?? 0);
if ($user_id <= 0) { header('Location: auth/login.php'); exit; }

/* ===== Ambil data user ===== */
$stmt = $mysqli->prepare("SELECT full_name, email, phone, role, password_hash FROM users WHERE id=? LIMIT 1");
$stmt->bind_param('i', $user_id);
$stmt->execute();
$stmt->bind_result($full_name, $email, $phone, $role, $password_hash);
$stmt->fetch();
$stmt->close();

/* ===== Helper avatar path/url ===== */
function avatar_path($uid){
  $dir = __DIR__ . '/uploads/avatars';
  if (!is_dir($dir)) @mkdir($dir, 0777, true);
  foreach (['jpg','jpeg','png','webp'] as $ext) {
    $p = "$dir/$uid.$ext";
    if (is_file($p)) return $p;
  }
  return "$dir/$uid.png"; // default target
}
function avatar_url($uid){
  $base = 'uploads/avatars';
  foreach (['jpg','jpeg','png','webp'] as $ext) {
    $p = __DIR__ . "/$base/$uid.$ext";
    if (is_file($p)) return "$base/$uid.$ext?v=".filemtime($p);
  }
  return 'img/avatar-placeholder.png';
}

/* ===== Notif ===== */
$ok = ''; $err = '';

/* ===== Update profil ===== */
if ($_SERVER['REQUEST_METHOD']==='POST' && ($_POST['action']??'')==='update_profile') {
  $new_name  = trim($_POST['full_name'] ?? '');
  $new_phone = trim($_POST['phone'] ?? '');
  if ($new_name==='') {
    $err = 'Nama lengkap wajib diisi.';
  } else {
    $stmt = $mysqli->prepare("UPDATE users SET full_name=?, phone=? WHERE id=?");
    $stmt->bind_param('ssi', $new_name, $new_phone, $user_id);
    if ($stmt->execute()) {
      $_SESSION['user_name'] = $new_name;
      $full_name = $new_name; $phone = $new_phone;
      $ok = 'Profil berhasil diperbarui.';
    } else {
      $err = 'Gagal memperbarui profil.';
    }
    $stmt->close();
  }
}

/* ===== Ganti password ===== */
if ($_SERVER['REQUEST_METHOD']==='POST' && ($_POST['action']??'')==='change_password') {
  $old = $_POST['old_password'] ?? '';
  $new = $_POST['new_password'] ?? '';
  $rep = $_POST['repeat_password'] ?? '';

  if ($new==='' || $rep==='') {
    $err = 'Password baru dan konfirmasi wajib diisi.';
  } elseif ($new !== $rep) {
    $err = 'Konfirmasi password tidak sama.';
  } elseif (!password_verify($old, $password_hash)) {
    $err = 'Password lama salah.';
  } else {
    $hash = password_hash($new, PASSWORD_DEFAULT);
    $stmt = $mysqli->prepare("UPDATE users SET password_hash=? WHERE id=?");
    $stmt->bind_param('si', $hash, $user_id);
    if ($stmt->execute()) {
      $ok = 'Password berhasil diganti.';
      $password_hash = $hash;
    } else {
      $err = 'Gagal mengganti password.';
    }
    $stmt->close();
  }
}

/* ===== Upload avatar ===== */
if ($_SERVER['REQUEST_METHOD']==='POST' && ($_POST['action']??'')==='upload_avatar') {
  if (!isset($_FILES['avatar']) || $_FILES['avatar']['error']!==UPLOAD_ERR_OK) {
    $err = 'Upload avatar gagal.';
  } else {
    $tmp  = $_FILES['avatar']['tmp_name'];
    $info = @getimagesize($tmp);
    if (!$info) {
      $err = 'File bukan gambar yang valid.';
    } else {
      $mime = $info['mime'] ?? '';
      $ext  = ($mime==='image/png')?'png' : (($mime==='image/webp')?'webp' : 'jpg');
      if (!in_array($mime, ['image/jpeg','image/png','image/webp'], true)) {
        $err = 'Format didukung: JPG/PNG/WEBP.';
      } elseif (($_FILES['avatar']['size'] ?? 0) > 2*1024*1024) {
        $err = 'Maksimal ukuran 2MB.';
      } else {
        $dir = __DIR__ . '/uploads/avatars';
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        // Hapus file lama
        foreach (['jpg','jpeg','png','webp'] as $e) {
          $old = "$dir/$user_id.$e";
          if (is_file($old)) @unlink($old);
        }
        $dest = "$dir/$user_id.$ext";
        if (@move_uploaded_file($tmp, $dest)) {
          @chmod($dest, 0644);
          $ok = 'Avatar diperbarui.';
        } else {
          $err = 'Tidak bisa menyimpan avatar.';
        }
      }
    }
  }
}

/* ===== Data final untuk view ===== */
$AVATAR = avatar_url($user_id);
function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Profil • Embun Laundry</title>
<link rel="stylesheet" href="assets/style.css"/>
</head>
<body>

<div class="wrap">
  <!-- SIDEBAR (sama seperti dashboard) + tambahan kiri bawah -->
  <aside class="sidebar">
    <div class="brand">
      <img
        src="img/Logo.png"
        alt="Embun Laundry"
        class="logo-img"
        width="36" height="36"
        decoding="async" fetchpriority="high"
      />
      <div class="brand-text">Embun Laundry</div>
    </div>

    <nav class="nav">
      <a href="dashboard.php"><span>🏠</span> <span>Dashboard</span></a>
      <a href="pesanan.php"><span>🧺</span> <span>Pesanan</span></a>
      <a href="pelanggan.php"><span>👥</span> <span>Pelanggan</span></a>
      <a href="layanan.php"><span>💲</span> <span>Layanan & Harga</span></a>
      <a href="delivery.php"><span>🚚</span> <span>Pickup & Delivery</span></a>
      <a href="laporan.php"><span>📑</span> <span>Laporan</span></a>
    </nav>

    <div class="side-bottom">
      <a href="profile.php" class="btn"><span>👤</span> <span>Profil</span></a>
      <a href="settings.php" class="btn"><span>⚙️</span> <span>Settings</span></a>
      <a href="auth/logout.php" class="btn"><span>🚪</span> <span>Keluar</span></a>
    </div>
  </aside>

  <!-- MAIN -->
  <section class="main">
    <div class="topbar">
      <div class="topbar-inner">
        <div class="h1">Profil</div>
        <div class="badge" style="margin-left:8px"><?= h($role) ?></div>
        <div style="margin-left:auto"><a class="btn" href="dashboard.php">← Kembali</a></div>
      </div>
    </div>

    <div class="content">
      <?php if ($ok): ?><div class="ok">✅ <?= h($ok) ?></div><?php endif; ?>
      <?php if ($err): ?><div class="err">⚠️ <?= h($err) ?></div><?php endif; ?>

      <div class="grid">
        <!-- KIRI: Card Avatar -->
        <div class="card">
          <div class="title">Foto Profil</div>
          <div style="display:flex;gap:14px;align-items:center">
            <img src="<?= h($AVATAR) ?>" class="avatar" alt="Avatar">
            <div>
              <div style="font-weight:900;font-size:18px"><?= h($full_name) ?></div>
              <div class="note"><?= h($email) ?></div>
              <div class="note">Ukuran maks 2MB • JPG/PNG/WEBP</div>
              <form method="post" enctype="multipart/form-data" style="margin-top:10px">
                <input class="file" type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required>
                <div class="actions">
                  <button class="btn btn-primary" type="submit">Upload Avatar</button>
                  <input type="hidden" name="action" value="upload_avatar">
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- KANAN: Tabs Detail & Keamanan -->
        <div class="card">
          <div class="tabs">
            <button class="tab active" data-tab="tab-info">Informasi</button>
            <button class="tab" data-tab="tab-pass">Keamanan</button>
          </div>

          <!-- Tab Informasi -->
          <div id="tab-info">
            <form method="post">
              <div class="row">
                <div>
                  <label>Nama Lengkap</label>
                  <input class="input" type="text" name="full_name" value="<?= h($full_name) ?>" required>
                </div>
                <div>
                  <label>No. HP</label>
                  <input class="input" type="text" name="phone" value="<?= h($phone) ?>" placeholder="0812-xxxx-xxxx">
                </div>
              </div>
              <div class="row" style="margin-top:10px">
                <div>
                  <label>Email (tidak bisa diubah)</label>
                  <input class="input" type="email" value="<?= h($email) ?>" disabled>
                </div>
                <div>
                  <label>Peran</label>
                  <input class="input" type="text" value="<?= h($role) ?>" disabled>
                </div>
              </div>
              <div class="actions">
                <button class="btn" type="reset">Reset</button>
                <button class="btn btn-primary" type="submit">Simpan Perubahan</button>
                <input type="hidden" name="action" value="update_profile">
              </div>
            </form>
          </div>

          <!-- Tab Password -->
          <div id="tab-pass" class="hide">
            <form method="post" autocomplete="off">
              <div class="row">
                <div>
                  <label>Password Lama</label>
                  <input class="input" type="password" name="old_password" required>
                </div>
                <div>
                  <label>Password Baru</label>
                  <input class="input" type="password" name="new_password" required>
                </div>
              </div>
              <div class="row" style="margin-top:10px">
                <div>
                  <label>Ulangi Password Baru</label>
                  <input class="input" type="password" name="repeat_password" required>
                </div>
              </div>
              <div class="actions">
                <button class="btn" type="reset">Reset</button>
                <button class="btn btn-primary" type="submit">Ganti Password</button>
                <input type="hidden" name="action" value="change_password">
              </div>
            </form>
          </div>

        </div>
      </div>

      <div style="height:30px"></div>
    </div>
  </section>
</div>

<script>
// Ripple effect utk semua .btn
document.addEventListener('click', function(e){
  const btn = e.target.closest('.btn'); if(!btn) return;
  const circle = document.createElement('span');
  const d = Math.max(btn.clientWidth, btn.clientHeight);
  circle.className='ripple'; circle.style.width=circle.style.height=d+'px';
  circle.style.left = (e.clientX - btn.getBoundingClientRect().left - d/2)+'px';
  circle.style.top  = (e.clientY - btn.getBoundingClientRect().top  - d/2)+'px';
  btn.appendChild(circle); setTimeout(()=>circle.remove(),600);
});

// Tabs
const tabs = document.querySelectorAll('.tab');
tabs.forEach(t=>{
  t.addEventListener('click', ()=>{
    tabs.forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    document.querySelectorAll('#tab-info,#tab-pass').forEach(el=>el.classList.add('hide'));
    document.getElementById(t.dataset.tab).classList.remove('hide');
  });
});
</script>
</body>
</html>
