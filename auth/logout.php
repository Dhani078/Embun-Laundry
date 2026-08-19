<?php
require __DIR__ . '/../config.php';
session_unset();
session_destroy();
header('Location: ' . base_url('../index.php'));
exit;
