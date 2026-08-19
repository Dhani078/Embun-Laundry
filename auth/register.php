<?php
require __DIR__ . '/../config.php';
$page_title = "Buat Akun • Embun Laundry";

$err = '';
$ok  = false;

// simpan nilai lama saat error supaya form tidak kosong
$old = [
  'full_name' => '',
  'email'     => '',
  'phone'     => '',
  'agree'     => ''
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  verify_csrf();

  $old['full_name'] = trim($_POST['full_name'] ?? '');
  $old['email']     = trim($_POST['email'] ?? '');
  $old['phone']     = trim($_POST['phone'] ?? '');
  $old['agree']     = isset($_POST['agree']) ? '1' : '';

  // paksa role selalu Customer
  $role = 'Customer';

  $password  = $_POST['password'] ?? '';
  $confirm   = $_POST['confirm']  ?? '';
  $agree     = isset($_POST['agree']);

  if ($old['full_name']==='' || $old['email']==='' || $password==='') {
    $err = 'Nama lengkap, email, dan kata sandi wajib diisi.';
  } elseif (!filter_var($old['email'], FILTER_VALIDATE_EMAIL)) {
    $err = 'Format email tidak valid.';
  } elseif ($password !== $confirm) {
    $err = 'Konfirmasi sandi tidak sama.';
  } elseif (!$agree) {
    $err = 'Anda harus menyetujui Syarat & Ketentuan.';
  } else {
    // cek email & nama unik (nama harus unik karena pesanan diikat ke nama)
    $stmt = $mysqli->prepare("SELECT id FROM users WHERE email=? OR full_name=? LIMIT 1");
    $stmt->bind_param('ss', $old['email'], $old['full_name']);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
      $err = 'Email atau Nama Lengkap sudah terdaftar. Gunakan yang lain.';
      $stmt->close();
    } else {
      $stmt->close();
      $hash = password_hash($password, PASSWORD_DEFAULT);
      $stmt = $mysqli->prepare("INSERT INTO users (full_name,email,phone,role,password_hash) VALUES (?,?,?,?,?)");
      $stmt->bind_param('sssss', $old['full_name'], $old['email'], $old['phone'], $role, $hash);
      if ($stmt->execute()) {
        $_SESSION['user_id']   = $stmt->insert_id;
        $_SESSION['user_name'] = $old['full_name'];
        $_SESSION['user_role'] = $role; // selalu Customer
        header('Location: ../dashboard.php');
        exit;
      } else {
        $err = 'Registrasi gagal: ' . htmlspecialchars($stmt->error);
      }
      $stmt->close();
    }
  }
}
function h($s){ return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8'); }
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title><?= h($page_title) ?></title>
<style>
:root{
  --bg1:#1f62f0; --bg2:#12cff0; --muted:#6b7280; --ink:#0f172a; --ring:#94b5ff;
  --shadow:0 12px 30px rgba(0,0,0,.10);
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:var(--ink);background:#f5f7fb}

/* background dengan blob lembut */
.page{
  min-height:100vh; display:grid; place-items:center; padding:40px 14px; position:relative; overflow:hidden;
  background: radial-gradient(1200px 600px at -10% -20%, #cde7ff 0, transparent 55%),
              radial-gradient(800px 420px at 120% 120%, #d7fff6 0, transparent 60%);
}
.page::before,.page::after{
  content:""; position:absolute; border-radius:50%; filter:blur(70px); opacity:.22; pointer-events:none;
  animation:float 16s ease-in-out infinite;
}
.page::before{width:520px;height:520px; left:-200px; top:-140px; background:linear-gradient(135deg,var(--bg1),var(--bg2));}
.page::after{ width:420px;height:420px; right:-160px; bottom:-120px; background:linear-gradient(135deg,#20e3b2,#5ea3ff); animation-delay:-6s;}
@keyframes float{50%{transform:translateY(-12px) scale(1.02)}}

.card{
  background:#fff; border:1px solid #e5e7eb; border-radius:22px; box-shadow:var(--shadow);
  width:min(760px,95%); padding:26px 26px 24px; position:relative;
}

/* header brand */
.brand{display:flex; align-items:center; gap:.65rem; margin-bottom:8px}
.logo-img{width:36px; height:36px; border-radius:50%; object-fit:contain; display:block; box-shadow:0 0 0 3px #e9f2ff}
.brand-name{color:#2563eb; font-weight:800}

/* judul */
h1{font-size:20px; margin:4px 0 6px}
.small{font-size:12px; color:var(--muted)}

/* grid form */
.grid{display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:14px}
@media (max-width: 720px){ .grid{grid-template-columns:1fr} }

label{font-size:13px; font-weight:600; color:#334155}
.input,.select{
  border:1px solid #d1d5db; padding:12px 12px; border-radius:12px; outline:0; width:100%;
  background:#fff; transition: box-shadow .15s ease, border-color .15s ease, transform .06s ease;
}
.input:focus,.select:focus{border-color:#60a5fa; box-shadow:0 0 0 3px #3b82f622}
.input:active{transform:scale(.998)}

/* password field with toggle */
.passwrap{position:relative}
.toggle{
  position:absolute; right:10px; top:50%; transform:translateY(-50%); border:0; background:transparent;
  cursor:pointer; font-size:18px; opacity:.7;
}

/* checkbox agree */
.ck{display:flex; align-items:flex-start; gap:.55rem; margin:10px 0 0}

/* alert */
.alert{
  background:#fff0f0; border:1px solid #fecaca; color:#b91c1c; border-radius:12px; padding:10px 12px; margin:8px 0 12px;
}

/* tombol */
.actions{margin-top:14px}
.btn{
  position:relative; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; gap:.5rem;
  padding:.9rem 1.15rem; border-radius:999px; border:0; font-weight:800; cursor:pointer; width:100%;
  background:linear-gradient(90deg,var(--bg1),var(--bg2)); color:#fff; box-shadow:var(--shadow); transition: transform .06s ease;
}
.btn:active{transform:scale(.985)}
.ripple{position:absolute; border-radius:50%; transform:scale(0); animation:rip .6s linear; background:#ffffff66; pointer-events:none}
@keyframes rip{to{transform:scale(5); opacity:0}}

/* link */
.link{color:#2563eb; text-decoration:none}
.link:hover{text-decoration:underline}

/* footer kecil */
.bottom{margin-top:8px; text-align:center}
</style>
</head>
<body>
<div class="page">
  <div class="card">

    <!-- Brand -->
    <div class="brand">
      <img src="../img/Logo.png" alt="Embun Laundry" class="logo-img" width="36" height="36" decoding="async" fetchpriority="high">
      <div class="brand-name">Embun Laundry</div>
    </div>

    <h1>Buat Akun Embun Laundry</h1>
    <div class="small" style="margin-top:-2px">Bergabung dan kelola kebutuhan laundry Anda</div>

    <?php if ($err): ?>
      <div class="alert">⚠️ <?= h($err) ?></div>
    <?php endif; ?>

    <form method="post" class="form" novalidate>
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <div class="grid">
        <div>
          <label>Nama Lengkap</label>
          <input class="input" type="text" name="full_name" value="<?= h($old['full_name']) ?>" required>
        </div>
        <div>
          <label>Email</label>
          <input class="input" type="email" name="email" value="<?= h($old['email']) ?>" required>
        </div>
        <div>
          <label>No. HP</label>
          <input class="input" type="text" name="phone" placeholder="0812-3456-7890" value="<?= h($old['phone']) ?>">
        </div>
        <div class="passwrap">
          <label>Kata Sandi</label>
          <input class="input" id="pw1" type="password" name="password" required>
          <button type="button" class="toggle" data-for="pw1" title="Tampilkan/Sembunyikan">👁️</button>
        </div>
        <div class="passwrap">
          <label>Konfirmasi Sandi</label>
          <input class="input" id="pw2" type="password" name="confirm" required>
          <button type="button" class="toggle" data-for="pw2" title="Tampilkan/Sembunyikan">👁️</button>
        </div>
      </div>

      <label class="ck">
        <input type="checkbox" name="agree" value="1" <?= $old['agree']?'checked':'' ?>>
        <span>Saya setuju dengan
          <a class="link" href="#" onclick="alert('Contoh halaman S&K');return false;">Syarat &amp; Ketentuan</a>
          dan
          <a class="link" href="#" onclick="alert('Contoh halaman Privasi');return false;">Kebijakan Privasi</a>
        </span>
      </label>

      <div class="actions">
        <button class="btn" type="submit">Buat Akun</button>
      </div>

      <div class="small bottom">
        Sudah punya akun? <a class="link" href="login.php">Masuk di sini</a>
      </div>
    </form>
  </div>
</div>

<script>
// Ripple untuk semua .btn
document.addEventListener('click', function(e){
  const btn = e.target.closest('.btn');
  if(!btn) return;
  const c = document.createElement('span');
  const d = Math.max(btn.clientWidth, btn.clientHeight);
  c.className='ripple';
  c.style.width = c.style.height = d+'px';
  const rect = btn.getBoundingClientRect();
  c.style.left = (e.clientX - rect.left - d/2)+'px';
  c.style.top  = (e.clientY - rect.top  - d/2)+'px';
  btn.appendChild(c);
  setTimeout(()=>c.remove(), 600);
});

// Toggle show/hide password
document.querySelectorAll('.toggle').forEach(tg=>{
  tg.addEventListener('click', ()=>{
    const id = tg.getAttribute('data-for');
    const el = document.getElementById(id);
    if(!el) return;
    el.type = (el.type === 'password') ? 'text' : 'password';
    tg.textContent = (el.type === 'password') ? '👁️' : '🙈';
  });
});
</script>
</body>
</html>
