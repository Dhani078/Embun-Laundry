<?php
require_once __DIR__ . '/config.php';
require_login();

header('Content-Type: application/json; charset=utf-8');

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) { echo json_encode(['ok'=>false]); exit; }

$role       = $_SESSION['user_role'] ?? 'Customer';
$isStaff    = in_array($role, ['Admin','Owner','Staff'], true);
$isCustomer = !$isStaff;
$myName     = trim($_SESSION['user_name'] ?? '');

if ($isCustomer) {
  $st = $mysqli->prepare("SELECT p.id, p.status, p.order_id FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=? AND o.customer_name=?");
  $st->bind_param('is',$id,$myName);
} else {
  $st = $mysqli->prepare("SELECT id, status, order_id FROM payments WHERE id=?");
  $st->bind_param('i',$id);
}
$st->execute(); $st->bind_result($pid,$status,$oid);
if ($st->fetch()) {
  $st->close();
  echo json_encode(['ok'=>true,'status'=>$status,'order_id'=>$oid]);
} else {
  $st->close();
  echo json_encode(['ok'=>false]);
}
