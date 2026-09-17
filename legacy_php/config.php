<?php
// config.php — DB connection + helpers
if (session_status() === PHP_SESSION_NONE) session_start();

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'embun_laundry');

$mysqli = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($mysqli->connect_errno) {
  http_response_code(500);
  echo "<h3>Gagal konek database: (" . $mysqli->connect_errno . ") " . htmlspecialchars($mysqli->connect_error) . "</h3>";
  exit;
}
$mysqli->set_charset('utf8mb4');

if (!function_exists('base_url')) {
  function base_url(string $path = ''): string {
    $prefix = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
    if ($prefix === '.' || $prefix === '/') $prefix = '';
    return $prefix . '/' . ltrim($path, '/');
  }
}

if (!function_exists('h')) {
  function h($s) { return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8'); }
}

if (!function_exists('rupiah')) {
  function rupiah($angka) { return 'Rp ' . number_format((float)$angka, 0, ',', '.'); }
}

if (!function_exists('is_logged_in')) {
  function is_logged_in(): bool { return isset($_SESSION['user_id']); }
}

if (!function_exists('require_login')) {
  function require_login() {
    if (!is_logged_in()) {
      header('Location: ' . base_url('auth/login.php'));
      exit;
    }
  }
}

if (!function_exists('csrf_token')) {
  function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
      $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
  }
}

if (!function_exists('verify_csrf')) {
  function verify_csrf() {
    $token = $_POST['csrf_token'] ?? '';
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
      http_response_code(403);
      die("<h1>403 Forbidden</h1><p>Sesi kadaluarsa atau CSRF token tidak valid. Silakan muat ulang halaman.</p>");
    }
  }
}
