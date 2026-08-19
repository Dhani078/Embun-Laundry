<?php
require_once __DIR__ . '/config.php';
require_login();

/* =========================
   RBAC & UTIL
   ========================= */
$role       = $_SESSION['user_role'] ?? 'Customer';
$isStaff    = in_array($role, ['Admin','Owner','Staff'], true);
$isCustomer = !$isStaff;
$myName     = trim($_SESSION['user_name'] ?? '');

function find_order(mysqli $db, int $orderId, bool $isCustomer, string $myName) {
  if ($isCustomer) {
    $st = $db->prepare("SELECT * FROM orders WHERE id=? AND customer_name=? LIMIT 1");
    $st->bind_param('is', $orderId, $myName);
  } else {
    $st = $db->prepare("SELECT * FROM orders WHERE id=? LIMIT 1");
    $st->bind_param('i', $orderId);
  }
  $st->execute(); $res = $st->get_result(); $row = $res->fetch_assoc(); $st->close();
  return $row ?: null;
}

function recalc_order_payment(mysqli $db, int $orderId) {
  $st = $db->prepare("SELECT COALESCE(SUM(amount),0) FROM payments WHERE order_id=? AND status='paid'");
  $st->bind_param('i', $orderId); $st->execute(); $st->bind_result($paidSum); $st->fetch(); $st->close();

  $st = $db->prepare("SELECT total_amount FROM orders WHERE id=?");
  $st->bind_param('i', $orderId); $st->execute(); $st->bind_result($total); $st->fetch(); $st->close();

  $status = ($paidSum <= 0) ? 'unpaid' : (($paidSum < $total) ? 'partial' : 'paid');

  $st = $db->prepare("UPDATE orders SET paid_amount=?, payment_status=? WHERE id=?");
  $st->bind_param('isi', $paidSum, $status, $orderId);
  $st->execute(); $st->close();
}

/* =========================
   POST ACTIONS (NO OUTPUT ABOVE!)
   ========================= */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  verify_csrf();
  $action = $_POST['action'] ?? '';

  // Create invoice / QR
  if ($action === 'create_payment') {
    $orderId = (int)($_POST['order_id'] ?? 0);
    $method  = $_POST['method'] ?? 'QRIS';

    $order = find_order($mysqli, $orderId, $isCustomer, $myName);
    if (!$order) { http_response_code(404); echo "Order tidak ditemukan / tidak berhak."; exit; }

    $outstanding = max(0, (int)$order['total_amount'] - (int)$order['paid_amount']);
    if ($outstanding <= 0) {
      header('Location: '.base_url('pay.php').'?order_id='.$orderId.'&msg=lunas'); exit;
    }

    // Simulasi payload QR (untuk produksi ganti panggil gateway)
    $nowStr    = (new DateTime())->format('Y-m-d H:i:s');
    $qrPayload = "DHLDR|".$order['order_code']."|".$outstanding."|".time();

    $provider = 'manual'; $status = 'pending';
    $st = $mysqli->prepare("INSERT INTO payments(order_id,method,provider,amount,status,qr_payload,created_at) VALUES (?,?,?,?,?,?,?)");
    $st->bind_param('ississs', $orderId, $method, $provider, $outstanding, $status, $qrPayload, $nowStr);
    $st->execute(); $pid = $mysqli->insert_id; $st->close();

    header('Location: '.base_url('pay.php').'?id='.$pid.'&msg=created'); exit;
  }

  // Staff: mark paid manual (misal verifikasi transfer)
  if ($action === 'mark_paid' && $isStaff) {
    $pid = (int)($_POST['payment_id'] ?? 0);
    $st  = $mysqli->prepare("SELECT order_id, status FROM payments WHERE id=?");
    $st->bind_param('i',$pid); $st->execute(); $st->bind_result($oid,$pstatus);
    if ($st->fetch()) { $st->close();
      if ($pstatus !== 'paid') {
        $now = (new DateTime())->format('Y-m-d H:i:s');
        $u = $mysqli->prepare("UPDATE payments SET status='paid', paid_at=? WHERE id=?");
        $u->bind_param('si',$now,$pid); $u->execute(); $u->close();
        recalc_order_payment($mysqli, (int)$oid);
      }
      header('Location: '.base_url('pay.php').'?id='.$pid.'&msg=paid'); exit;
    } else { $st->close(); http_response_code(404); echo "Pembayaran tidak ditemukan."; exit; }
  }
}

/* =========================
   VIEW DATA
   ========================= */
$payment = null; $order = null;
$msg = $_GET['msg'] ?? '';

if (isset($_GET['id'])) {
  $pid = (int)$_GET['id'];
  if ($isCustomer) {
    $st = $mysqli->prepare("SELECT p.*, o.order_code, o.customer_name, o.total_amount, o.paid_amount
                            FROM payments p JOIN orders o ON o.id=p.order_id
                            WHERE p.id=? AND o.customer_name=? LIMIT 1");
    $st->bind_param('is',$pid,$myName);
  } else {
    $st = $mysqli->prepare("SELECT p.*, o.order_code, o.customer_name, o.total_amount, o.paid_amount
                            FROM payments p JOIN orders o ON o.id=p.order_id
                            WHERE p.id=? LIMIT 1");
    $st->bind_param('i',$pid);
  }
  $st->execute(); $res=$st->get_result(); $payment=$res->fetch_assoc(); $st->close();
  if ($payment) {
    $orderId = (int)$payment['order_id'];
    $order = find_order($mysqli, $orderId, $isCustomer, $myName);
  }
} else if (isset($_GET['order_id'])) {
  $orderId = (int)$_GET['order_id'];
  $order = find_order($mysqli, $orderId, $isCustomer, $myName);
}

$page_title = "Pembayaran • Embun Laundry";
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title><?= h($page_title) ?></title>
<style>
:root{
  --bg:#0b1220; --bg-soft:#0f172a; --card:#0f172a; --line:#1f2937; --muted:#93a2b5; --text:#e5ecf5;
  --shadow:0 20px 50px rgba(0,0,0,.35);
  --blue:#4f7dfd; --green:#22c55e; --red:#ef4444; --amber:#f59e0b; --indigo:#6366f1;
  --grad: linear-gradient(120deg,#4f7dfd, #12cff0 50%, #22c55e);
  --radius:18px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:var(--text);background:radial-gradient(1200px 600px at 10% -20%, #14213a 0, #0b1220 40%)}
a{text-decoration:none;color:#bcd3ff}
.wrap{max-width:980px;margin:34px auto;padding:0 18px}
.header{
  display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;
  padding:10px 12px;border:1px solid #1b2740;background:linear-gradient(120deg,#0c1530,#0b132b);
  border-radius:16px;box-shadow:var(--shadow);position:relative;overflow:hidden
}
.header::before{
  content:""; position:absolute; inset:-40px -60px auto auto; width:220px; height:220px;
  background:conic-gradient(from 0deg, #1f62f0, #12cff0, #22c55e, #1f62f0); filter:blur(38px); opacity:.18; border-radius:50%;
  animation:spin 12s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}
.brand{display:flex;align-items:center;gap:10px}
.logo{width:38px;height:38px;border-radius:12px;background:radial-gradient(circle at 30% 30%,#35d2ff,#0aa2ff);box-shadow:0 6px 18px rgba(0,0,0,.35)}
.title{font-weight:900}
.btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:.5rem;padding:.7rem 1rem;border-radius:999px;border:1px solid #263145;background:#121a34;cursor:pointer;font-weight:800;color:#e8f0ff}
.btn:hover{transform:translateY(-1px)}
.btn:active{transform:translateY(0)}
.btn-primary{background:var(--grad); border:0; color:#fff; box-shadow:0 10px 24px rgba(79,125,253,.3)}
.btn-ghost{background:transparent;border-color:#2b3656}
.badge{display:inline-flex;align-items:center;gap:6px;padding:.3rem .7rem;border-radius:999px;font-size:12px;font-weight:800;border:1px solid #2b3656;background:#101a36;color:#a6b7d6}
.badge.ok{background:#0f2b1d;border-color:#1c5935;color:#a9f5c4}
.badge.warn{background:#2b1f0f;border-color:#5b3a10;color:#ffde9a}
.badge.danger{background:#2b0f0f;border-color:#5b1010;color:#ffb4b4}

.card{
  background:linear-gradient(180deg,#0f172a,#0b132b); border:1px solid #1b2740; border-radius:var(--radius);
  box-shadow:var(--shadow); padding:18px; position:relative; overflow:hidden
}
.card::after{
  content:""; position:absolute; inset:auto -40px -60px auto; width:180px; height:180px; background:radial-gradient(circle at 30% 30%,#4f7dfd33,#12cff033); filter:blur(18px);
}
.h1{font-size:22px;font-weight:900;margin:2px 0 6px}
.sub{font-size:12px;color:var(--muted)}
.grid{display:grid; gap:16px}
.cols{grid-template-columns:1.3fr 1fr}
.kv{display:grid;grid-template-columns:160px 1fr;gap:8px;margin:10px 0}
.hr{height:1px;background:#1e2a47;margin:14px 0}
.qr{
  display:grid;place-items:center;border:1px dashed #2b3656;border-radius:14px;padding:16px;min-height:260px;
  background:repeating-linear-gradient(-45deg,#0c1530 0,#0c1530 10px,#0b132b 10px,#0b132b 20px);
  animation:shine 2.2s linear infinite;
}
@keyframes shine{0%{filter:saturate(1)}50%{filter:saturate(1.2)}100%{filter:saturate(1)}}
.sel{display:flex;gap:10px;flex-wrap:wrap}
.pulse{position:relative}
.pulse::after{
  content:""; position:absolute; right:-10px; top:-6px; width:8px; height:8px; border-radius:50%; background:#22c55e;
  box-shadow:0 0 0 0 rgba(34,197,94,.7); animation:pulse 1.8s infinite;
}
@keyframes pulse{to{box-shadow:0 0 0 10px rgba(34,197,94,0)}}
.toast{
  position:fixed; right:18px; top:18px; padding:12px 14px; border-radius:12px; background:#0f172a; color:#e7f0ff; border:1px solid #1f2b49; box-shadow:var(--shadow);
  transform:translateY(-10px); opacity:0; animation:toast .5s ease forwards;
}
@keyframes toast{to{transform:translateY(0);opacity:1}}
.link{color:#bcd3ff;text-decoration:underline dotted}
.ripple{position:absolute;border-radius:50%;transform:scale(0);animation:ripple .6s linear;background:#ffffff44;pointer-events:none}
@keyframes ripple{to{transform:scale(6);opacity:0}}
.copy{font-size:12px;color:#bcd3ff;text-decoration:underline;cursor:pointer}
.progress{display:flex;align-items:center;gap:10px;margin:6px 0 12px}
.step{display:flex;align-items:center;gap:8px}
.dot{width:10px;height:10px;border-radius:50%}
.dot.gray{background:#3a486f}.dot.act{background:#4f7dfd}.dot.ok{background:#22c55e}
.skeleton{height:16px;border-radius:8px;background:linear-gradient(90deg,#0c1530 25%,#162447 37%,#0c1530 63%);background-size:400% 100%;animation:skeleton 1.4s ease infinite}
@keyframes skeleton{0%{background-position:100% 50%}100%{background-position:0 50%}}
.btn-row{display:flex;gap:10px;flex-wrap:wrap}
.notice{background:#0d1934;border:1px dashed #2b3656;color:#bcd3ff;border-radius:12px;padding:10px 12px}
</style>
</head>
<body>

<div class="wrap">
  <div class="header">
    <div class="brand">
      <div class="logo"></div>
      <div>
        <div class="title">Embun Laundry</div>
        <div class="sub">Pembayaran Pesanan</div>
      </div>
    </div>
    <div class="btn-row">
      <a class="btn btn-ghost" href="<?= h(base_url('pesanan.php')) ?>">← Kembali ke Pesanan</a>
      <a class="btn" href="<?= h(base_url('dashboard.php')) ?>">🏠 Dashboard</a>
    </div>
  </div>

  <?php if ($msg): ?>
    <div class="toast"><?= h(ucfirst($msg)) ?></div>
  <?php endif; ?>

  <div class="card">
    <div class="h1">Pembayaran</div>
    <div class="sub">Bayar pesanan Anda via <b>QRIS</b> / e-Wallet. Status dipantau realtime.</div>

    <?php if (!$order && !$payment): ?>
      <div class="hr"></div>
      <div class="badge danger">Order/Pembayaran tidak ditemukan atau Anda tidak berhak.</div>
    <?php endif; ?>

    <?php if ($order && !$payment): 
      $outstanding = max(0, (int)$order['total_amount'] - (int)$order['paid_amount']);
    ?>
      <div class="kv">
        <div>Order</div><div><b><?= h($order['order_code']) ?></b> • <?= h($order['customer_name']) ?></div>
        <div>Total</div><div><b><?= rupiah($order['total_amount']) ?></b></div>
        <div>Terbayar</div><div><?= rupiah($order['paid_amount']) ?></div>
        <div>Sisa</div><div><b><?= rupiah($outstanding) ?></b></div>
      </div>

      <?php if ($outstanding <= 0): ?>
        <div class="badge ok">Sudah <b>LUNAS</b> ✅</div>
      <?php else: ?>
        <div class="hr"></div>

        <div class="progress">
          <div class="step"><span class="dot ok"></span><span class="sub">Order</span></div>
          <div class="step"><span class="dot act"></span><span class="sub">Buat Tagihan</span></div>
          <div class="step"><span class="dot gray"></span><span class="sub">Bayar</span></div>
          <div class="step"><span class="dot gray"></span><span class="sub">Selesai</span></div>
        </div>

        <form method="post" class="grid" style="grid-template-columns:1fr;gap:12px;margin-top:8px">
          <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
          <input type="hidden" name="action" value="create_payment">
          <input type="hidden" name="order_id" value="<?= (int)$order['id'] ?>">
          <div>
            <div class="sub" style="margin-bottom:6px">Pilih metode</div>
            <div class="sel">
              <label class="badge"><input type="radio" name="method" value="QRIS" checked> QRIS</label>
              <label class="badge"><input type="radio" name="method" value="DANA"> DANA</label>
              <label class="badge"><input type="radio" name="method" value="GOPAY"> GoPay</label>
              <label class="badge"><input type="radio" name="method" value="OVO"> OVO</label>
            </div>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" type="submit">⚡ Buat Tagihan</button>
          </div>
        </form>

        <div class="notice" style="margin-top:10px">
          Demo: QR dibuat lokal (simulasi). Untuk produksi, sambungkan ke Midtrans / Xendit / dsb.
        </div>
      <?php endif; ?>
    <?php endif; ?>

    <?php if ($payment && $order): 
      $outstanding = max(0, (int)$order['total_amount'] - (int)$order['paid_amount']);
      $pstat = $payment['status'];
    ?>
      <div class="grid cols" style="margin-top:10px">
        <div>
          <div class="kv" style="margin-bottom:10px">
            <div>Order</div><div><b><?= h($order['order_code']) ?></b> • <?= h($order['customer_name']) ?></div>
            <div>Metode</div><div><b><?= h($payment['method']) ?></b> <span class="sub">(<?= h($payment['provider']) ?>)</span></div>
            <div>Jumlah</div><div><b><?= rupiah($payment['amount']) ?></b></div>
            <div>Status</div>
            <div>
              <?php if ($pstat==='pending'): ?>
                <span class="badge pulse">Menunggu Pembayaran…</span>
              <?php elseif ($pstat==='paid'): ?>
                <span class="badge ok">Terbayar</span>
              <?php elseif (in_array($pstat,['failed','expired','cancelled'])): ?>
                <span class="badge danger"><?= h($pstat) ?></span>
              <?php else: ?>
                <span class="badge"><?= h($pstat) ?></span>
              <?php endif; ?>
            </div>
          </div>

          <div class="progress">
            <div class="step"><span class="dot ok"></span><span class="sub">Order</span></div>
            <div class="step"><span class="dot ok"></span><span class="sub">Tagihan</span></div>
            <div class="step"><span class="dot <?= $pstat==='paid'?'ok':'act' ?>"></span><span class="sub">Bayar</span></div>
            <div class="step"><span class="dot <?= $pstat==='paid'?'ok':'gray' ?>"></span><span class="sub">Selesai</span></div>
          </div>

          <div class="btn-row" style="margin-top:8px">
            <?php if ($isStaff && $pstat==='pending'): ?>
              <form method="post">
                <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
                <input type="hidden" name="action" value="mark_paid">
                <input type="hidden" name="payment_id" value="<?= (int)$payment['id'] ?>">
                <button class="btn">✅ Konfirmasi Manual (Staff)</button>
              </form>
            <?php endif; ?>
            <?php if ($pstat==='paid'): ?>
              <button class="btn btn-ghost" onclick="window.print()">🧾 Cetak Bukti</button>
            <?php endif; ?>
          </div>

          <div class="hr"></div>
          <div class="sub">Sisa pada order ini: <b><?= rupiah($outstanding) ?></b></div>
        </div>

        <div>
          <?php if ($pstat==='pending'): ?>
            <div class="qr">
              <div id="qrcode"></div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
              <span class="copy" id="copyPayload">Salin payload</span>
              <span class="sub">QRIS kompatibel: DANA/OVO/GoPay</span>
            </div>
            <div class="skeleton" style="margin-top:8px"></div>
          <?php elseif ($pstat==='paid'): ?>
            <div class="badge ok">Pembayaran diterima. Terima kasih! 🎉</div>
          <?php else: ?>
            <div class="badge danger">Pembayaran <?= h($pstat) ?>. Buat ulang tagihan.</div>
          <?php endif; ?>
        </div>
      </div>
    <?php endif; ?>
  </div>
</div>

<!-- QR generator -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
// Ripple untuk semua .btn
document.addEventListener('click', function(e){
  const btn = e.target.closest('.btn'); if(!btn) return;
  const c = document.createElement('span'); const d=Math.max(btn.clientWidth, btn.clientHeight);
  c.className='ripple'; c.style.width=c.style.height=d+'px';
  c.style.left=(e.clientX-btn.getBoundingClientRect().left-d/2)+'px';
  c.style.top =(e.clientY-btn.getBoundingClientRect().top -d/2)+'px';
  btn.appendChild(c); setTimeout(()=>c.remove(),600);
});

// Confetti mini (tanpa lib)
function confettiBurst(){
  const count=120, end=Date.now()+800; const colors=['#4f7dfd','#12cff0','#22c55e','#eab308','#ef4444'];
  (function frame(){
    // buat partikel
    const el = document.createElement('div');
    const size = Math.random()*6+4;
    el.style.position='fixed'; el.style.left=(Math.random()*100)+'%'; el.style.top='-10px';
    el.style.width=size+'px'; el.style.height=size+'px'; el.style.background=colors[(Math.random()*colors.length)|0];
    el.style.borderRadius='50%'; el.style.boxShadow='0 0 8px #0004'; el.style.zIndex=9999;
    el.style.transition='transform 1s linear, opacity 1s linear';
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.transform='translateY('+(window.innerHeight+40)+'px) rotate('+(Math.random()*720)+'deg)'; el.style.opacity='0.8';});
    setTimeout(()=>el.remove(),1000);
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

// Jika ada QR pending → render + polling
<?php if ($payment && ($payment['status']??'')==='pending'): ?>
(function(){
  var payload = <?= json_encode($payment['qr_payload']) ?>;
  var el = document.getElementById('qrcode');
  if (el && window.QRCode) { new QRCode(el, {text: payload, width: 220, height: 220}); }

  // copy payload
  var cp = document.getElementById('copyPayload');
  if (cp) { cp.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(payload); cp.textContent='Disalin ✓'; setTimeout(()=>cp.textContent='Salin payload',1500);}catch(e){} }); }

  // polling status setiap 3s
  async function poll(){
    try{
      const res = await fetch('<?= h(base_url('pay_status.php')) ?>?id=<?= (int)$payment['id'] ?>');
      const js = await res.json();
      if (js.ok) {
        const st = js.status || '';
        const el = document.getElementById('pstatus');
        if (el) el.textContent = st;
        if (st === 'paid') {
          confettiBurst();
          setTimeout(()=>location.reload(), 600);
          return;
        }
      }
    }catch(e){}
    setTimeout(poll, 3000);
  }
  poll();
})();
<?php endif; ?>
</script>
</body>
</html>
