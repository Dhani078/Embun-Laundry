<?php
require_once __DIR__ . '/../config.php';

// TIDAK require_login(); halaman publik untuk reset sandi

/* =========================
   HELPERS
   ========================= */
function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function base_link(string $path){ return rtrim(base_url($path), '/'); }
function has_table(mysqli $db, string $name): bool {
  $res = $db->query("SHOW TABLES LIKE '".$db->real_escape_string($name)."'");
  return $res && $res->num_rows>0;
}
function has_col(mysqli $db, string $table, string $col): bool {
  $res = $db->query("SHOW COLUMNS FROM `".$db->real_escape_string($table)."` LIKE '".$db->real_escape_string($col)."'");
  return $res && $res->num_rows>0;
}
function now_str(){ return (new DateTime())->format('Y-m-d H:i:s'); }

/* =========================
   USERS: kolom dinamis
   ========================= */
$cols = [];
$r = $mysqli->query("SHOW COLUMNS FROM users");
while($c = $r->fetch_assoc()) $cols[]=$c['Field'];
$hasEmail   = in_array('email',$cols,true);
$hasName    = in_array('name',$cols,true) || in_array('full_name',$cols,true);
$colNameKey = in_array('full_name',$cols,true) ? 'full_name' : (in_array('name',$cols,true)?'name':null);
$hasHash    = in_array('password_hash',$cols,true);
$hasPlain   = in_array('password',$cols,true); // fallback

/* =========================
   Tabel password_resets
   ========================= */
if (!has_table($mysqli,'password_resets')) {
  @$mysqli->query("
    CREATE TABLE IF NOT EXISTS `password_resets` (
      `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      `user_id` INT UNSIGNED NOT NULL,
      `token_hash` VARCHAR(64) NOT NULL,
      `expires_at` DATETIME NOT NULL,
      `used_at` DATETIME NULL DEFAULT NULL,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `idx_token` (`token_hash`),
      KEY `idx_user` (`user_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  ");
}

/* =========================
   ACTIONS
   ========================= */
$toast=null; $toastType='success'; $view='request'; $prefillEmail='';
$tokenParam = trim($_GET['token'] ?? '');
if ($tokenParam !== '') $view='reset';

// REQUEST LINK
if ($_SERVER['REQUEST_METHOD']==='POST' && ($_POST['action'] ?? '')==='request') {
  $identifier = trim($_POST['identifier'] ?? '');
  $prefillEmail = $identifier;

  if ($identifier==='') { $toastType='error'; $toast='Isi email atau username dulu ya.'; }
  else {
    // Cari user by email atau name/full_name
    $sql = "SELECT id".($colNameKey?(", `$colNameKey` AS uname"):"").",".($hasEmail? "email":"'' AS email")." FROM users WHERE ";
    $types=''; $vals=[];
    if ($hasEmail) { $sql.=" (email=?) "; $types.='s'; $vals[]=$identifier; }
    if ($colNameKey) {
      $sql .= $hasEmail ? " OR " : "";
      $sql .= " ($colNameKey=?) "; $types.='s'; $vals[]=$identifier;
    }
    $sql .= " LIMIT 1";
    $st=$mysqli->prepare($sql); $st->bind_param($types, ...$vals); $st->execute(); $u=$st->get_result()->fetch_assoc(); $st->close();

    // Demi keamanan: tetap tampilkan sukses walau user tak ditemukan
    if (!$u) { $toast='Jika akun terdaftar, tautan reset telah dikirim.'; }
    else {
      $uid=(int)$u['id'];
      // Bersihkan reset lama aktif
      $mysqli->query("DELETE FROM password_resets WHERE user_id={$uid} AND used_at IS NULL");

      // Buat token
      $raw   = bin2hex(random_bytes(32));
      $hash  = hash('sha256', $raw);
      $expAt = (new DateTime('+1 hour'))->format('Y-m-d H:i:s');

      $st=$mysqli->prepare("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)");
      $st->bind_param('iss', $uid,$hash,$expAt); $st->execute(); $st->close();

      $resetUrl = base_link('lupasandi.php').'?token='.$raw;

      // Kirim email (jika mail() tersedia/terkonfigurasi)
      $sent=false;
      if (function_exists('mail') && filter_var($u['email']??'', FILTER_VALIDATE_EMAIL)) {
        $to   = $u['email'];
        $sub  = 'Reset Password - Embun Laundry';
        $msg  = "Halo ".($u['uname'] ?? '').",\n\n".
                "Klik tautan berikut untuk mengatur ulang kata sandi (berlaku 1 jam):\n".
                $resetUrl."\n\nJika tidak meminta reset, abaikan email ini.";
        $hdr  = "From: no-reply@".parse_url(base_url('/'),PHP_URL_HOST)."\r\nContent-Type: text/plain; charset=UTF-8";
        $sent = @mail($to,$sub,$msg,$hdr);
      }

      // Pesan ke user
      $toast = $sent
        ? 'Cek email kamu—tautan reset sudah dikirim.'
        : 'Tautan reset sudah dibuat. Jika email tidak aktif, gunakan tautan ini.';
      // DEMO: tampilkan link jika email gagal (agar tetap usable)
      if (!$sent) {
        $_SESSION['__fallback_reset_url'] = $resetUrl; // ditampilkan di UI di bawah
      }
    }
  }
  $view='request';
}

// RESET PASSWORD
if ($_SERVER['REQUEST_METHOD']==='POST' && ($_POST['action'] ?? '')==='reset') {
  $tokenIn = trim($_POST['token'] ?? '');
  $pass1 = $_POST['password'] ?? '';
  $pass2 = $_POST['password2'] ?? '';
  $view='reset'; $tokenParam=$tokenIn;

  if ($tokenIn==='' || strlen($tokenIn) < 32) { $toastType='error'; $toast='Token tidak valid.'; }
  elseif ($pass1==='' || strlen($pass1)<6) { $toastType='error'; $toast='Password minimal 6 karakter.'; }
  elseif ($pass1!==$pass2) { $toastType='error'; $toast='Ulangi password tidak cocok.'; }
  else {
    $hashTok = hash('sha256', $tokenIn);
    $st=$mysqli->prepare("SELECT id,user_id,expires_at,used_at FROM password_resets WHERE token_hash=? LIMIT 1");
    $st->bind_param('s',$hashTok); $st->execute(); $row=$st->get_result()->fetch_assoc(); $st->close();

    if (!$row) { $toastType='error'; $toast='Token tidak dikenal / sudah dipakai.'; }
    elseif (!empty($row['used_at'])) { $toastType='error'; $toast='Token sudah digunakan.'; }
    elseif (strtotime($row['expires_at']) < time()) { $toastType='error'; $toast='Token kadaluarsa.'; }
    else {
      $uid=(int)$row['user_id'];
      $newHash = password_hash($pass1, PASSWORD_DEFAULT);

      if ($hasHash) {
        $st=$mysqli->prepare("UPDATE users SET password_hash=? WHERE id=?");
        $st->bind_param('si',$newHash,$uid); $st->execute(); $st->close();
      } elseif ($hasPlain) {
        $st=$mysqli->prepare("UPDATE users SET password=? WHERE id=?");
        $st->bind_param('si',$newHash,$uid); $st->execute(); $st->close();
      } else {
        $toastType='error'; $toast='Kolom password tidak ditemukan di tabel users.'; $uid=0;
      }

      if ($uid>0) {
        $now=now_str();
        $st=$mysqli->prepare("UPDATE password_resets SET used_at=? WHERE id=?");
        $st->bind_param('si',$now,$row['id']); $st->execute(); $st->close();
        $toast='Password berhasil diubah. Silakan login.';
        $view='done';
      }
    }
  }
}

/* =========================
   UI VARIANTS
   ========================= */
$fallbackLink = $_SESSION['__fallback_reset_url'] ?? null;
if ($fallbackLink && $view!=='request') unset($_SESSION['__fallback_reset_url']);
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Lupa Sandi · Embun Laundry</title>
<style>
:root{
  --bg:#0b1220; --card:#111827; --line:#243044; --muted:#9aa4b2; --text:#e5e7eb;
  --blue:#2563eb; --cyan:#12cff0; --green:#10b981; --pink:#ec4899; --amber:#f59e0b; --red:#ef4444;
  --shadow:0 18px 42px rgba(0,0,0,.35);
  --radius:18px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:radial-gradient(1200px 600px at 10% 10%, #1b2a4a 0, transparent 60%), radial-gradient(800px 400px at 90% 0%, #3a256a 0, transparent 60%), #0b1220; color:var(--text);}

/* floating orbs background */
.bgfx{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.orb{position:absolute;border-radius:50%;filter:blur(16px);opacity:.35;mix-blend-mode:screen;animation:float 9s ease-in-out infinite}
.orb.a{width:240px;height:240px;left:-40px;top:20px;background:#2563eb}
.orb.b{width:300px;height:300px;right:-60px;top:-30px;background:#12cff0;animation-duration:11s}
.orb.c{width:260px;height:260px;left:40%;bottom:-80px;background:#8b5cf6;animation-duration:13s}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}

/* container */
.wrap{min-height:100%;display:grid;place-items:center;padding:18px}
.card{position:relative;z-index:1;background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
  border:1px solid #26344d; box-shadow:var(--shadow); border-radius:22px; padding:20px; width:min(520px,96%); overflow:hidden; transform:translateZ(0)}
.card::after{content:""; position:absolute; inset:auto -80px -80px auto; width:220px; height:220px; border-radius:50%;
  background:radial-gradient(60% 60% at 50% 50%, rgba(18,207,240,.18), transparent 60%); filter:blur(2px);}

/* header */
.brand{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.logo{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#0f172a;border:1px solid #20304a}
.title{font-weight:900;font-size:20px}

/* form */
.row{display:flex;gap:12px}
.row>div{flex:1}
.input, .btn, select{width:100%}
label{font-size:12px;color:var(--muted);display:block;margin-bottom:6px}
.input, select{background:#0b1527;border:1px solid #243044;color:#e5e7eb;padding:12px 14px;border-radius:12px;outline:none;transition:border .2s, box-shadow .2s}
.input:focus, select:focus{border-color:#60a5fa; box-shadow:0 0 0 3px #3b82f622}
.help{font-size:12px;color:var(--muted)}
.form-sec{display:flex;flex-direction:column;gap:10px}

/* buttons */
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.6rem;
  padding:.7rem 1rem;border-radius:999px;border:1px solid #2a3b5a;background:#0b1527;color:#e5e7eb;font-weight:800;cursor:pointer;transition:transform .05s, box-shadow .2s}
.btn:active{transform:scale(.98)}
.btn-primary{background:linear-gradient(92deg, var(--blue), var(--cyan));border:none;color:#fff;box-shadow:var(--shadow)}
.btn-ghost{background:transparent}
.btn-danger{background:linear-gradient(92deg,#ef4444,#f97316);border:none;color:#fff}
.btn[disabled]{opacity:.6;cursor:not-allowed}

/* ripple */
.ripple{position:absolute;border-radius:50%;transform:scale(0);animation:ripple .6s linear;background:#ffffff66;pointer-events:none}
@keyframes ripple{to{transform:scale(6);opacity:0}}

/* sub actions */
.actions{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
.link{color:#9ab6ff;text-decoration:none}
.link:hover{text-decoration:underline}

/* toggle show password */
.showpw{position:absolute;right:10px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:12px;color:#cbd5e1;opacity:.9}

/* toast */
.toast{position:fixed;left:50%;transform:translateX(-50%) translateY(8px);bottom:18px;background:#111827;color:#fff;padding:12px 14px;border-radius:12px;box-shadow:var(--shadow);z-index:5;opacity:0;animation:show .25s ease forwards}
.toast.warn{background:#f59e0b;color:#111827}
.toast.error{background:#ef4444}
@keyframes show{to{opacity:1;transform:translateX(-50%) translateY(0)}}

/* success check */
.check{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;margin:10px auto;background:#08361f;border:1px solid #14532d;animation:pop .25s ease}
@keyframes pop{from{transform:scale(.8);opacity:.6}to{transform:scale(1);opacity:1}}
svg{display:block}

/* tiny note button */
.copy{display:inline-flex;align-items:center;gap:.4rem;border:1px dashed #294166;padding:.25rem .5rem;border-radius:999px;font-size:12px;cursor:pointer}
.copy:hover{background:#0b1527}
</style>
</head>
<body>

<div class="bgfx">
  <div class="orb a"></div>
  <div class="orb b"></div>
  <div class="orb c"></div>
</div>

<div class="wrap">
  <div class="card" id="card">
    <div class="brand">
      <div class="logo">🧺</div>
      <div class="title"><?= $view==='reset' ? 'Atur Ulang Kata Sandi' : 'Lupa Kata Sandi' ?></div>
    </div>
    <div class="help" style="margin-bottom:10px">
      <?= $view==='reset'
        ? 'Masukkan kata sandi baru untuk akunmu. Token berlaku 1 jam.'
        : 'Masukkan email atau username. Kami akan kirim tautan reset (jika email aktif).' ?>
    </div>

    <?php if ($view==='request'): ?>
      <form method="post" class="form-sec" id="reqForm" autocomplete="off" spellcheck="false">
        <input type="hidden" name="action" value="request">
        <div>
          <label>Email / Username</label>
          <input class="input" name="identifier" value="<?= h($prefillEmail) ?>" placeholder="email@contoh.com / username" required>
        </div>
        <?php if ($fallbackLink): ?>
          <div class="help" style="margin-top:2px">
            <span style="opacity:.8">Tautan reset (fallback):</span>
            <div style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <code style="font-size:12px;background:#0b1527;border:1px solid #243044;padding:.35rem .5rem;border-radius:8px"><?= h($fallbackLink) ?></code>
              <a class="copy" href="<?= h($fallbackLink) ?>">Buka</a>
              <button type="button" class="copy" id="btnCopy" data-copy="<?= h($fallbackLink) ?>">Salin</button>
            </div>
          </div>
        <?php endif; ?>
        <div class="actions">
          <a class="link" href="<?= h(base_url('auth/login.php')) ?>">← Kembali ke Login</a>
          <button class="btn btn-primary" id="btnSend">Kirim Tautan Reset</button>
        </div>
      </form>
    <?php elseif ($view==='reset'): ?>
      <form method="post" class="form-sec" id="resetForm" autocomplete="off">
        <input type="hidden" name="action" value="reset">
        <input type="hidden" name="token" value="<?= h($tokenParam) ?>">
        <div class="row">
          <div style="position:relative">
            <label>Password Baru</label>
            <input class="input" type="password" name="password" id="pw1" minlength="6" required placeholder="Min. 6 karakter">
            <span class="showpw" data-for="pw1">👁️</span>
          </div>
          <div style="position:relative">
            <label>Ulangi Password</label>
            <input class="input" type="password" name="password2" id="pw2" minlength="6" required>
            <span class="showpw" data-for="pw2">👁️</span>
          </div>
        </div>
        <div class="actions">
          <a class="link" href="<?= h(base_url('login.php')) ?>">← Batal</a>
          <button class="btn btn-danger" id="btnSave">Simpan Password</button>
        </div>
      </form>
    <?php else: ?>
      <div class="check">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M20 7L9 18l-5-5" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div style="text-align:center;margin:10px 0 14px;font-weight:800">Password sudah diperbarui 🎉</div>
      <div style="display:flex;justify-content:center">
        <a href="<?= h(base_url('login.php')) ?>" class="btn btn-primary" style="width:auto">Masuk Sekarang</a>
      </div>
    <?php endif; ?>
  </div>
</div>

<?php if ($toast): ?>
  <div class="toast <?= h($toastType) ?>" id="toast"><?= h($toast) ?></div>
<?php endif; ?>

<script>
// Ripple efek
document.addEventListener('click', function(e){
  const btn = e.target.closest('.btn, .copy'); if(!btn) return;
  const circle = document.createElement('span');
  const d = Math.max(btn.clientWidth, btn.clientHeight);
  circle.style.width = circle.style.height = d+'px';
  const r = btn.getBoundingClientRect();
  circle.style.left = (e.clientX - r.left - d/2) + 'px';
  circle.style.top  = (e.clientY - r.top  - d/2) + 'px';
  circle.className='ripple';
  btn.appendChild(circle); setTimeout(()=>circle.remove(), 600);
});

// Tilt micro-animasi pada card
(function(){
  const card=document.getElementById('card');
  card.addEventListener('mousemove', (e)=>{
    const r=card.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width, y=(e.clientY-r.top)/r.height;
    card.style.transform=`perspective(1000px) rotateX(${(0.5-y)*4}deg) rotateY(${(x-0.5)*4}deg) translateY(-2px)`;
  });
  card.addEventListener('mouseleave', ()=> card.style.transform='translateY(-2px)');
})();

// Toast auto hide
const toast = document.getElementById('toast');
if (toast){ setTimeout(()=>toast.style.display='none', 2600); }

// Copy fallback link
document.getElementById('btnCopy')?.addEventListener('click', async (e)=>{
  try{
    await navigator.clipboard.writeText(e.target.dataset.copy||'');
    const t=document.createElement('div'); t.className='toast'; t.textContent='Disalin ke clipboard'; document.body.appendChild(t);
    setTimeout(()=>{t.remove()},1500);
  }catch{}
});

// Tahan tombol kirim beberapa detik biar anti-spam
document.getElementById('btnSend')?.addEventListener('click', (e)=>{
  const btn=e.currentTarget; setTimeout(()=>{btn.disabled=true; setTimeout(()=>btn.disabled=false, 6000);}, 10);
});

// Toggle show password
document.querySelectorAll('.showpw').forEach(el=>{
  el.addEventListener('click', ()=>{
    const id = el.getAttribute('data-for'); const inp = document.getElementById(id);
    if (!inp) return; inp.type = inp.type==='password' ? 'text' : 'password';
  });
});
</script>
</body>
</html>
