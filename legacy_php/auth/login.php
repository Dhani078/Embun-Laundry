<?php
// auth/login.php
require __DIR__ . '/../config.php';
$page_title = "Masuk • Embun Laundry";

$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  verify_csrf();

  // Pakai satu field identitas: email / no. HP / nama lengkap (full_name)
  $identity = trim($_POST['identity'] ?? '');
  $password = $_POST['password'] ?? '';

  if ($identity === '' || $password === '') {
    $err = 'Email/No. HP/Nama dan kata sandi wajib diisi.';
  } else {
    // Cari user berdasarkan email, phone, atau full_name (semua case-insensitive bawaan collation)
    $sql = "SELECT id, full_name, email, phone, password_hash, role
            FROM users
            WHERE email = ? OR phone = ? OR full_name = ?
            LIMIT 1";
    $stmt = $mysqli->prepare($sql);
    $stmt->bind_param('sss', $identity, $identity, $identity);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($row = $res->fetch_assoc()) {
      $ok = false;
      $hash = $row['password_hash'];

      // 1) Cocokkan hash normal
      if (password_verify($password, $hash)) {
        $ok = true;
        // Rehash kalau algoritma lama
        if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
          $newHash = password_hash($password, PASSWORD_DEFAULT);
          $up = $mysqli->prepare("UPDATE users SET password_hash=? WHERE id=?");
          $uid = (int)$row['id'];
          $up->bind_param('si', $newHash, $uid);
          $up->execute();
          $up->close();
        }
      }
      // 2) fallback kalau dulu tersimpan plaintext
      elseif ($hash === $password) {
        $ok = true;
        $newHash = password_hash($password, PASSWORD_DEFAULT);
        $up = $mysqli->prepare("UPDATE users SET password_hash=? WHERE id=?");
        $uid = (int)$row['id'];
        $up->bind_param('si', $newHash, $uid);
        $up->execute();
        $up->close();
      }

      if ($ok) {
        $_SESSION['user_id']   = (int)$row['id'];
        $_SESSION['user_name'] = $row['full_name'];
        $_SESSION['user_role'] = $row['role'];
        header('Location: ../dashboard.php');
        exit;
      } else {
        $err = 'Kata sandi salah.';
      }
    } else {
      $err = 'Akun tidak ditemukan.';
    }
    $stmt->close();
  }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title><?= htmlspecialchars($page_title) ?></title>
<style>
:root{--bg1:#1f62f0;--bg2:#12cff0;--ring:#9ec3ff;--muted:#6b7280;--shadow:0 10px 30px rgba(0,0,0,.10)}
*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;background:#f5f7fb}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.15rem;border-radius:999px;border:1px solid transparent;font-weight:700;cursor:pointer}
.btn-primary{background:linear-gradient(90deg,var(--bg1),var(--bg2));color:#fff;box-shadow:var(--shadow);width:100%}
.small{font-size:12px;color:var(--muted)}
.auth-wrap{min-height:100vh;display:grid;grid-template-columns:520px 1fr}
.auth-card{display:flex;align-items:center;justify-content:center;background:#f5f7fb}
.card-auth{background:#fff;border:1px solid #e5e7eb;border-radius:20px;box-shadow:var(--shadow);width:min(420px,90%);padding:26px 22px}
.brand{display:flex;align-items:center;gap:.6rem}

/* === logo pakai logo.png + fallback gradasi === */
.logo{
  width:34px;height:34px;border-radius:50%;
  background:
    url('../img/logo.png') center/contain no-repeat,
    radial-gradient(circle at 30% 30%, #35d2ff, #0aa2ff);
  box-shadow:0 4px 14px rgba(0,0,0,.15);
}

.brand-name{color:#2563eb;font-weight:800}
h1{font-size:20px;margin:6px 0 0}
.form-row{display:flex;flex-direction:column;gap:6px;margin:14px 0}
.input{border:1px solid #d1d5db;padding:12px 14px;border-radius:12px;outline:none;width:100%}
.input:focus{border-color:#60a5fa;box-shadow:0 0 0 3px #3b82f622}
.input-wrap{position:relative}
.toggle-pass{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:transparent;border:0;cursor:pointer;font-size:16px;opacity:.65}
.toggle-pass:hover{opacity:.9}
.row-between{display:flex;align-items:center;justify-content:space-between;margin-top:4px}
.ck{display:flex;align-items:center;gap:.45rem}
.link{color:#2563eb;text-decoration:none}
.link:hover{text-decoration:underline}
.alert{background:#fff0f0;border:1px solid #fecaca;color:#b91c1c;border-radius:12px;padding:10px 12px;margin-top:12px}

/* === PANEL KANAN: hanya ilustrasi 3D, dipusatkan sedikit ke tengah === */
.auth-aside{
  background:linear-gradient(135deg,var(--bg1),var(--bg2));
  color:#fff;
  position:relative;
  overflow:hidden;
}

/* Ilustrasi 3D diposisikan via pseudo-element */
.auth-aside::after{
  content:"";
  position:absolute;
  left:52%;              /* geser sedikit ke kanan dari titik tengah */
  top:54%;               /* geser sedikit ke bawah dari titik tengah */
  width: clamp(320px, 60vw, 680px); 
  aspect-ratio:1/1;
  background: url('../img/3d.png') center/contain no-repeat;
  filter: drop-shadow(0 18px 28px rgba(0,0,0,.25));
  transform-origin:center;
  animation: float3d 9s ease-in-out infinite;
  pointer-events:none;
  will-change: transform;
}

/* Animasi 3D + pusatkan pakai translate(-50%,-50%) */
@keyframes float3d{
  0%{
    transform: translate(-50%, -50%)
               perspective(700px) rotateY(-12deg) rotateX(8deg)
               translateY(0) scale(1);
  }
  50%{
    transform: translate(-50%, -50%)
               perspective(700px) rotateY(12deg) rotateX(-6deg)
               translateY(-12px) scale(1.03);
  }
  100%{
    transform: translate(-50%, -50%)
               perspective(700px) rotateY(-12deg) rotateX(8deg)
               translateY(0) scale(1);
  }
}

/* Hormati preferensi user yang mematikan animasi */
@media (prefers-reduced-motion: reduce){
  .auth-aside::after{
    animation:none;
    transform: translate(-50%, -50%);
  }
}

@media (max-width: 1024px){
  .auth-wrap{grid-template-columns:1fr}
  .auth-aside{display:none}
}
</style>
</head>
<body>
<div class="auth-wrap">
  <!-- KIRI: kartu login -->
  <div class="auth-card">
    <div class="card-auth">
      <div class="brand" style="margin-bottom:6px">
        <div class="logo"></div><div class="brand-name">Embun Laundry</div>
      </div>
      <h1>Masuk</h1>
      <div class="small">Kelola bisnis laundry Anda</div>

      <?php if ($err): ?><div class="alert">⚠️ <?= htmlspecialchars($err) ?></div><?php endif; ?>

      <form method="post" class="mt-3" autocomplete="on">
        <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
        <div class="form-row">
          <label>Email / No. HP / Nama</label>
          <input class="input" type="text" name="identity" placeholder="owner@embunlaundry.id / 0812xxxx / Embun" required>
        </div>
        <div class="form-row">
          <label>Kata Sandi</label>
          <div class="input-wrap">
            <input class="input" type="password" name="password" id="password" required>
            <button type="button" class="toggle-pass" title="Tampilkan" aria-label="Tampilkan sandi"
              onclick="const i=document.getElementById('password');this.title=(i.type==='password'?(i.type='text','Sembunyikan'):(i.type='password','Tampilkan'));">👁</button>
          </div>
        </div>

        <div class="row-between small">
          <label class="ck"><input type="checkbox" name="remember"> <span>Ingat saya</span></label>
          <a class="link" href="lupasandi.php">Lupa Password?</a>
        </div>

        <div class="form-row" style="margin-top:18px">
          <button class="btn btn-primary" type="submit">Masuk</button>
        </div>

        <div class="small" style="margin-top:6px">
          Belum punya akun? <a class="link" href="<?= htmlspecialchars(base_url('register.php')) ?>">Buat akun</a>
        </div>
      </form>
    </div>
  </div>

  <!-- KANAN: hanya background gradasi + ilustrasi 3D, tanpa teks/ikon -->
  <aside class="auth-aside" aria-label="Ilustrasi 3D"></aside>
</div>
</body>
</html>
