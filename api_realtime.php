<?php
// api_realtime.php
require_once __DIR__ . '/config.php';

if (!is_logged_in()) {
  http_response_code(401);
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}

header('Content-Type: application/json; charset=utf-8');

$page = $_GET['page'] ?? 'dashboard';

$role       = $_SESSION['user_role'] ?? 'Customer';
$isStaff    = in_array($role, ['Admin','Owner','Staff'], true);
$isCustomer = !$isStaff;
$myName     = trim($_SESSION['user_name'] ?? '');
$userId     = (int)($_SESSION['user_id'] ?? 0);

if ($page === 'dashboard') {
  $range = $_GET['range'] ?? '7d';
  $svcFilter = isset($_GET['svc']) ? (int)$_GET['svc'] : null;

  $todayStart    = (new DateTime('today'))->setTime(0,0,0);
  $tomorrowStart = (clone $todayStart)->modify('+1 day');

  switch ($range) {
    case '7d':  $start = (clone $todayStart)->modify('-6 days');  $end = (clone $tomorrowStart); break;
    case '30d': $start = (clone $todayStart)->modify('-29 days'); $end = (clone $tomorrowStart); break;
    default:    $range='today'; $start=$todayStart; $end=$tomorrowStart; break;
  }

  $kpi = ['orders'=>0, 'progress'=>0, 'done'=>0, 'revenue'=>0];
  $qBase   = " FROM orders WHERE created_at >= ? AND created_at < ? ";
  $types   = 'ss';
  $params  = [$start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s')];

  if ($svcFilter) { $qBase .= " AND service_id=? "; $types .= 'i'; $params[] = $svcFilter; }
  if ($isCustomer && $myName !== '') { $qBase .= " AND customer_name=? "; $types .= 's'; $params[] = $myName; }

  // orders
  $stmt = $mysqli->prepare("SELECT COUNT(*) ".$qBase);
  $stmt->bind_param($types, ...$params); $stmt->execute(); $stmt->bind_result($kpi['orders']); $stmt->fetch(); $stmt->close();

  // progress
  $stmt = $mysqli->prepare("SELECT COUNT(*) ".$qBase." AND status='proses'");
  $stmt->bind_param($types, ...$params); $stmt->execute(); $stmt->bind_result($kpi['progress']); $stmt->fetch(); $stmt->close();

  // done
  $qDoneBase   = " FROM orders WHERE finished_at >= ? AND finished_at < ? AND status='selesai' ";
  $typesDone   = 'ss';
  $paramsDone  = [$start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s')];
  if ($svcFilter) { $qDoneBase .= " AND service_id=? "; $typesDone.='i'; $paramsDone[]=$svcFilter; }
  if ($isCustomer && $myName!=='') { $qDoneBase .= " AND customer_name=? "; $typesDone.='s'; $paramsDone[]=$myName; }

  $stmt = $mysqli->prepare("SELECT COUNT(*) ".$qDoneBase);
  $stmt->bind_param($typesDone, ...$paramsDone); $stmt->execute(); $stmt->bind_result($kpi['done']); $stmt->fetch(); $stmt->close();

  // revenue
  $stmt = $mysqli->prepare("SELECT COALESCE(SUM(total_amount),0) ".$qBase." AND status!='batal'");
  $stmt->bind_param($types, ...$params); $stmt->execute(); $stmt->bind_result($kpi['revenue']); $stmt->fetch(); $stmt->close();

  // bar chart
  $barLabels = []; $barData = [];
  if ($range === 'today') {
    for ($h=0; $h<=23; $h++) { $barLabels[] = sprintf('%02d:00', $h); }
    $barData = array_fill(0, count($barLabels), 0);
    $stmt = $mysqli->prepare("SELECT HOUR(created_at) h, COUNT(*) c ".$qBase." GROUP BY h");
    $stmt->bind_param($types, ...$params); $stmt->execute(); $res = $stmt->get_result();
    while ($r = $res->fetch_assoc()) {
      $h = (int)$r['h'];
      if ($h >= 0 && $h <= 23) $barData[$h] = (int)$r['c'];
    }
    $stmt->close();
  } else {
    $days = ($range==='7d') ? 7 : 30;
    for ($i=$days-1; $i>=0; $i--) $barLabels[] = (new DateTime("-$i days"))->format('d M');
    $barData = array_fill(0, count($barLabels), 0);
    $stmt = $mysqli->prepare("SELECT DATE(created_at) d, COUNT(*) c ".$qBase." GROUP BY d ORDER BY d");
    $stmt->bind_param($types, ...$params); $stmt->execute(); $res = $stmt->get_result();
    $map=[]; while ($r=$res->fetch_assoc()) $map[(new DateTime($r['d']))->format('d M')] = (int)$r['c'];
    foreach ($barLabels as $i=>$lab) if (isset($map[$lab])) $barData[$i] = $map[$lab];
    $stmt->close();
  }

  // pie chart
  $pieLabels=[]; $pieData=[]; $totalCnt = 0;
  $sqlPie = "
    SELECT s.name, COUNT(*) cnt
    FROM orders o JOIN services s ON s.id=o.service_id
    WHERE o.created_at >= ? AND o.created_at < ? " .
    ($svcFilter?" AND o.service_id=? ":"") .
    ($isCustomer && $myName!=='' ? " AND o.customer_name=? " : "") .
    " GROUP BY o.service_id ORDER BY cnt DESC";
  $stmt = $mysqli->prepare($sqlPie);
  $typesPie  = 'ss'; $paramsPie = [$start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s')];
  if ($svcFilter) { $typesPie.='i'; $paramsPie[]=$svcFilter; }
  if ($isCustomer && $myName!=='') { $typesPie.='s'; $paramsPie[]=$myName; }
  $stmt->bind_param($typesPie, ...$paramsPie); $stmt->execute(); $res = $stmt->get_result();
  while ($r=$res->fetch_assoc()){ $pieLabels[]=$r['name']; $pieData[]=(int)$r['cnt']; $totalCnt += (int)$r['cnt']; }
  $stmt->close();

  // line chart
  $lineLabels=[]; $lineRevenue=[];
  $periodDays = ($range==='30d') ? 30 : 7;
  for ($i=$periodDays-1; $i>=0; $i--) $lineLabels[] = (new DateTime("-$i days"))->format('d M');
  $lineRevenue = array_fill(0,count($lineLabels),0);
  $stmt = $mysqli->prepare("SELECT DATE(created_at) d, COALESCE(SUM(total_amount),0) rev ".$qBase." GROUP BY d ORDER BY d");
  $stmt->bind_param($types, ...$params); $stmt->execute(); $res = $stmt->get_result();
  $map=[]; while ($r=$res->fetch_assoc()) $map[(new DateTime($r['d']))->format('d M')] = (int)$r['rev'];
  foreach ($lineLabels as $i=>$lab) if (isset($map[$lab])) $lineRevenue[$i] = $map[$lab];
  $stmt->close();

  echo json_encode([
    'kpi' => [
      'orders' => (int)$kpi['orders'],
      'progress' => (int)$kpi['progress'],
      'done' => (int)$kpi['done'],
      'revenue' => (int)$kpi['revenue'],
      'formatted_revenue' => rupiah($kpi['revenue'])
    ],
    'bar' => [
      'labels' => $barLabels,
      'data' => array_values($barData)
    ],
    'pie' => [
      'labels' => $pieLabels,
      'data' => array_values($pieData),
      'total' => $totalCnt
    ],
    'line' => [
      'labels' => $lineLabels,
      'data' => array_values($lineRevenue)
    ]
  ]);
  exit;
}

if ($page === 'laporan') {
  $tab   = $_GET['tab']   ?? 'pendapatan';
  $group = $_GET['group'] ?? 'bulan';
  $startS = $_GET['start'] ?? '';
  $endS   = $_GET['end']   ?? '';

  $start = $end = null;
  if ($startS!=='' && $endS!=='') {
    $start = DateTime::createFromFormat('Y-m-d',$startS);
    $end   = DateTime::createFromFormat('Y-m-d',$endS);
  }
  if (!$start || !$end) {
    $start = new DateTime(date('Y-01-01'));
    $end   = new DateTime(date('Y-12-31'));
  }
  $start->setTime(0,0,0);
  $end->setTime(23,59,59);

  $diffDays     = (int)$start->diff($end)->format('%a') + 1;
  $prevStart    = (clone $start)->modify("-{$diffDays} days");
  $prevEnd      = (clone $start)->modify('-1 day');

  $startStr     = $start->format('Y-m-d H:i:s');
  $endStr       = $end->format('Y-m-d H:i:s');
  $prevStartStr = $prevStart->format('Y-m-d H:i:s');
  $prevEndStr   = $prevEnd->format('Y-m-d H:i:s');

  $hasPaidCol = $mysqli->query("SHOW COLUMNS FROM orders LIKE 'paid_amount'")->num_rows > 0;
  if ($hasPaidCol) {
    $paidExpr    = "IFNULL(paid_amount,0)";
    $unpaidExpr  = "GREATEST(total_amount - IFNULL(paid_amount,0), 0)";
    $amtExpr     = "CASE WHEN paid_amount IS NULL OR paid_amount=0 THEN total_amount ELSE paid_amount END";
    $amtExprO    = "CASE WHEN o.paid_amount IS NULL OR o.paid_amount=0 THEN o.total_amount ELSE o.paid_amount END";
  } else {
    $paidExpr    = "total_amount";
    $unpaidExpr  = "0";
    $amtExpr     = "total_amount";
    $amtExprO    = "o.total_amount";
  }

  $customerFilter = ($isCustomer && $myName!=='') ? " AND customer_name = ?" : "";

  $bindDates = function(mysqli_stmt $st, string $a, string $b) use ($isCustomer, $myName){
    if ($isCustomer && $myName!=='') {
      $n = $myName;
      $st->bind_param('sss', $a, $b, $n);
    } else {
      $st->bind_param('ss', $a, $b);
    }
  };

  // KPIs
  $revNow=0; $ordNow=0; $avgWeight=0;
  $st=$mysqli->prepare("
    SELECT COALESCE(SUM($amtExpr),0), COUNT(*), ROUND(AVG(weight_kg),1)
    FROM orders
    WHERE created_at BETWEEN ? AND ? AND (status IS NULL OR status<>'batal') $customerFilter
  ");
  $bindDates($st, $startStr, $endStr); $st->execute(); $st->bind_result($revNow,$ordNow,$avgWeight); $st->fetch(); $st->close();

  $revPrev=0;
  $st=$mysqli->prepare("
    SELECT COALESCE(SUM($amtExpr),0)
    FROM orders
    WHERE created_at BETWEEN ? AND ? AND (status IS NULL OR status<>'batal') $customerFilter
  ");
  $bindDates($st, $prevStartStr, $prevEndStr); $st->execute(); $st->bind_result($revPrev); $st->fetch(); $st->close();

  $hasExpenses = $isStaff && $mysqli->query("SHOW TABLES LIKE 'expenses'")->num_rows>0;
  $expNow = 0;
  if ($hasExpenses){
    $st=$mysqli->prepare("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE created_at BETWEEN ? AND ?");
    $st->bind_param('ss',$startStr,$endStr); $st->execute(); $st->bind_result($expNow); $st->fetch(); $st->close();
  }
  $profit = max(0, $revNow - $expNow);
  $margin = $revNow>0 ? round($profit/$revNow*100,1) : 0.0;

  // Laporan Chart (Lunas vs Belum Lunas)
  $grp = ($group==='hari'?'hari':($group==='minggu'?'minggu':'bulan'));
  $sqlBase = "FROM orders WHERE created_at BETWEEN ? AND ? AND (status IS NULL OR status<>'batal') $customerFilter";

  if ($grp==='hari') {
    $sql="SELECT DATE(created_at) g, COALESCE(SUM($paidExpr),0) paid, COALESCE(SUM($unpaidExpr),0) unpaid $sqlBase GROUP BY DATE(created_at) ORDER BY g";
  } elseif ($grp==='minggu') {
    $sql="SELECT CONCAT(YEAR(created_at),'-W',LPAD(WEEK(created_at,3),2,'0')) g, COALESCE(SUM($paidExpr),0) paid, COALESCE(SUM($unpaidExpr),0) unpaid $sqlBase GROUP BY YEARWEEK(created_at,3) ORDER BY YEARWEEK(created_at,3)";
  } else {
    $sql="SELECT DATE_FORMAT(created_at,'%Y-%m') g, COALESCE(SUM($paidExpr),0) paid, COALESCE(SUM($unpaidExpr),0) unpaid $sqlBase GROUP BY DATE_FORMAT(created_at,'%Y-%m') ORDER BY DATE_FORMAT(created_at,'%Y-%m')";
  }
  $st=$mysqli->prepare($sql);
  $bindDates($st, $startStr, $endStr); $st->execute(); $res=$st->get_result();
  $labels=[]; $seriesPaid=[]; $seriesUnpaid=[];
  while($r=$res->fetch_assoc()){
    $labels[]       = $r['g'];
    $seriesPaid[]   = (int)$r['paid'];
    $seriesUnpaid[] = (int)$r['unpaid'];
  }
  $st->close();

  // Daily Table
  $daily=[];
  $st=$mysqli->prepare("
    SELECT DATE(created_at) d, COUNT(*) orders, COALESCE(SUM($amtExpr),0) revenue, COALESCE(SUM(weight_kg),0) weight
    FROM orders
    WHERE created_at BETWEEN ? AND ? AND (status IS NULL OR status<>'batal') $customerFilter
    GROUP BY DATE(created_at) ORDER BY d
  ");
  $bindDates($st, $startStr, $endStr); $st->execute(); $res=$st->get_result();
  while($r=$res->fetch_assoc()){
    $r['avg_per_order'] = $r['orders']>0 ? round($r['revenue']/$r['orders']) : 0;
    $r['formatted_revenue'] = rupiah($r['revenue']);
    $r['formatted_avg'] = rupiah($r['avg_per_order']);
    $r['formatted_d'] = date('d/m/Y', strtotime($r['d']));
    $daily[]=$r;
  }
  $st->close();

  // byService
  $byService=[];
  if ($isStaff && $mysqli->query("SHOW TABLES LIKE 'services'")->num_rows){
    $st=$mysqli->prepare("
      SELECT s.name, COUNT(*) cnt, COALESCE(SUM($amtExprO),0) revenue
      FROM orders o JOIN services s ON s.id=o.service_id
      WHERE o.created_at BETWEEN ? AND ? AND (o.status IS NULL OR o.status<>'batal') $customerFilter
      GROUP BY s.id ORDER BY revenue DESC
    ");
    $bindDates($st, $startStr, $endStr); $st->execute(); $res=$st->get_result();
    while($r=$res->fetch_assoc()) {
      $r['formatted_revenue'] = rupiah($r['revenue']);
      $byService[]=$r;
    }
    $st->close();
  }

  // topCust
  $topCust=[];
  if ($isStaff){
    $st=$mysqli->prepare("
      SELECT customer_name, COUNT(*) cnt, COALESCE(SUM($amtExpr),0) revenue
      FROM orders
      WHERE created_at BETWEEN ? AND ? AND (status IS NULL OR status<>'batal')
      GROUP BY customer_name ORDER BY revenue DESC LIMIT 10
    ");
    $st->bind_param('ss',$startStr,$endStr); $st->execute(); $res=$st->get_result();
    while($r=$res->fetch_assoc()) {
      $r['formatted_revenue'] = rupiah($r['revenue']);
      $topCust[]=$r;
    }
    $st->close();
  }

  echo json_encode([
    'kpi' => [
      'revenue' => $revNow,
      'formatted_revenue' => rupiah($revNow),
      'growth_pct' => pct_change($revNow, $revPrev),
      'orders' => $ordNow,
      'avg_weight' => $avgWeight,
      'margin' => $margin,
      'profit' => $profit,
      'formatted_profit' => rupiah($profit)
    ],
    'chart' => [
      'labels' => $labels,
      'paid' => $seriesPaid,
      'unpaid' => $seriesUnpaid
    ],
    'daily' => $daily,
    'byService' => $byService,
    'topCust' => $topCust
  ]);
  exit;
}
