<?php
// partials/head.php
?><!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title><?php echo isset($page_title) ? h($page_title) . ' · ' : '';?>Embun Laundry</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='46' fill='%2300A8FF'/%3E%3Cpath d='M50 20c10 0 18 8 18 18s-8 18-18 18-18-8-18-18 8-18 18-18zm0 8a10 10 0 100 20 10 10 0 000-20z' fill='white'/%3E%3C/svg%3E"/>
<link rel="stylesheet" href="<?php echo base_url('assets/style.css');?>"/>
</head>
<body>
