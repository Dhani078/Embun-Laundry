-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 22 Jun 2026 pada 18.53
-- Versi server: 10.4.32-MariaDB
-- Versi PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `dhani_laundry`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `couriers`
--

CREATE TABLE `couriers` (
  `id` int(11) NOT NULL,
  `code` varchar(20) DEFAULT NULL,
  `full_name` varchar(80) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `vehicle` varchar(40) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `rating` decimal(3,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `couriers`
--

INSERT INTO `couriers` (`id`, `code`, `full_name`, `phone`, `vehicle`, `is_active`, `rating`, `created_at`, `updated_at`) VALUES
(1, 'CR-001', 'Randy', '0812-3456-7890', 'Motor', 1, 4.80, '2025-10-22 18:18:10', '2025-10-22 18:18:10'),
(2, 'CR-002', 'Budi', '0857-1111-2222', 'Motor', 1, 4.60, '2025-10-22 18:18:10', '2025-10-22 18:18:10'),
(3, 'CR-003', 'DAN', '12312312', 'Mobil', 1, 5.00, '2026-01-12 21:37:21', '2026-01-12 21:37:21');

-- --------------------------------------------------------

--
-- Struktur dari tabel `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `code` varchar(20) NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `tag` enum('VIP','Reguler','Sering','Baru') NOT NULL DEFAULT 'Reguler',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `customers`
--

INSERT INTO `customers` (`id`, `code`, `full_name`, `phone`, `address`, `tag`, `created_at`, `updated_at`) VALUES
(1, 'CUST-8112', 'dhani', '082148564979', 'dhani', 'Reguler', '2025-10-22 09:43:19', '2025-11-04 05:11:39'),
(2, 'CUST-4671', '20000', NULL, NULL, 'Reguler', '2025-10-22 08:31:27', '2025-11-04 05:11:39'),
(3, 'CUST-2465', 'dhani123', NULL, NULL, 'Reguler', '2025-10-22 09:42:18', '2025-11-04 05:11:39'),
(4, 'CUST-3298', 'dhani12', '082148564979', 'Sultan Adam', 'Reguler', '2025-10-22 10:08:52', '2025-11-04 05:11:39'),
(5, 'CUST-0873', 'dedi', '082148564979', 'suldam', 'Reguler', '2025-10-22 15:27:48', '2026-01-12 14:33:27'),
(6, 'CUST-9993', 'dhani1', '2131', '1231', 'Reguler', '2025-10-23 07:32:34', '2025-11-04 05:11:39'),
(7, 'CUST-9975', 'dhani078', '078665', 'kayutangi', 'Reguler', '2025-11-12 11:48:15', '2025-12-03 08:15:46'),
(8, 'CUST-0164', 'test', '08321312', 'kayutangi', 'Reguler', '2026-01-12 14:32:32', '2026-05-12 14:26:41'),
(9, 'CUST-5560', 'tesbanget', '4123', '2232', 'Baru', '2026-05-01 06:19:10', '2026-05-12 14:26:41'),
(10, 'CUST-3702', 'dasdsa', '3213', 'dsadass', 'Baru', '2026-05-13 10:47:25', '2026-05-13 10:48:47'),
(11, 'CUST-9880', 'dd', '42', 'sdad', 'Baru', '2026-05-13 10:47:35', '2026-05-13 10:48:47'),
(12, 'CUST-4675', 'dasdas', '21312', 'dsadsadsa', 'Baru', '2026-05-13 10:47:46', '2026-05-13 10:48:47'),
(13, 'CUST-0205', 'ewqe', '2312312', '12121', 'Baru', '2026-05-13 10:47:52', '2026-05-13 10:48:47');

-- --------------------------------------------------------

--
-- Struktur dari tabel `daily_checkins`
--

CREATE TABLE `daily_checkins` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `day` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `daily_checkins`
--

INSERT INTO `daily_checkins` (`id`, `user_id`, `day`, `created_at`) VALUES
(1, 4, '2025-10-23', '2025-10-23 11:55:50'),
(2, 4, '2025-10-27', '2025-10-27 11:45:51');

-- --------------------------------------------------------

--
-- Struktur dari tabel `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `order_code` varchar(20) NOT NULL,
  `customer_name` varchar(100) NOT NULL,
  `customer_phone` varchar(32) DEFAULT NULL,
  `customer_address` varchar(255) DEFAULT NULL,
  `service_id` int(11) NOT NULL,
  `weight_kg` int(11) NOT NULL,
  `price_per_kg` int(11) NOT NULL,
  `discount` int(11) NOT NULL DEFAULT 0,
  `total_amount` int(11) NOT NULL,
  `paid_amount` int(11) NOT NULL DEFAULT 0,
  `payment_status` enum('unpaid','partial','paid','refunded') NOT NULL DEFAULT 'unpaid',
  `created_by` int(11) DEFAULT NULL,
  `status` enum('baru','proses','selesai','batal') NOT NULL DEFAULT 'baru',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `finished_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `orders`
--

INSERT INTO `orders` (`id`, `order_code`, `customer_name`, `customer_phone`, `customer_address`, `service_id`, `weight_kg`, `price_per_kg`, `discount`, `total_amount`, `paid_amount`, `payment_status`, `created_by`, `status`, `created_at`, `finished_at`) VALUES
(46, 'INV2512030444', 'dedi', '083211', 'kayutangi', 1, 3, 20000, 0, 60000, 0, 'unpaid', NULL, 'baru', '2025-12-03 08:41:08', NULL),
(47, 'INV2601127570', 'test', '08321312', 'kayutangi', 1, 5, 20000, 15000, 85000, 0, 'unpaid', NULL, 'baru', '2026-01-12 14:32:32', NULL),
(48, 'INV260112E63C', 'test', '231321', 'sultan adam', 1, 50, 20000, 0, 1000000, 1000000, 'paid', NULL, 'baru', '2026-01-12 14:33:59', NULL),
(49, 'ORD-2605010AA', 'tesbanget', '4123', '2232', 1, 3, 20000, 0, 60000, 0, 'unpaid', NULL, 'baru', '2026-05-01 06:19:10', NULL),
(50, 'INV260513CDC8', 'dasdsa', '3213', 'dsadass', 1, 3, 20000, 0, 60000, 0, 'unpaid', NULL, 'baru', '2026-05-13 10:47:25', NULL),
(51, 'INV260513B0C8', 'dd', '42', 'sdad', 2, 3, 20000, 0, 60000, 0, 'unpaid', NULL, 'baru', '2026-05-13 10:47:35', NULL),
(52, 'INV2605138D4F', 'dasdas', '21312', 'dsadsadsa', 3, 3, 15000, 0, 45000, 0, 'unpaid', NULL, 'baru', '2026-05-13 10:47:46', NULL),
(53, 'INV26051349B5', 'ewqe', '2312312', '12121', 4, 3, 35000, 0, 105000, 0, 'unpaid', NULL, 'baru', '2026-05-13 10:47:52', NULL);

-- --------------------------------------------------------

--
-- Struktur dari tabel `password_resets`
--

CREATE TABLE `password_resets` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `password_resets`
--

INSERT INTO `password_resets` (`id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`) VALUES
(1, 1, 'f7c1c0569427f0c890b13a64155865fdad5e39723edebccba6c1186a3867a62d', '2025-10-25 05:23:05', '2025-10-25 04:23:37', '2025-10-25 10:23:05'),
(2, 4, '6b5c82f04e80f17ad907854fa38f1baa1c2371b1ac2fc92b8612aa6249fa0b90', '2025-10-25 05:26:37', '2025-10-25 04:26:59', '2025-10-25 10:26:37'),
(3, 1, 'e2c75f337aa3c4234a3947ba87c1f3b8a6597f07a7cdcd2f006e6eebdf9c5f6b', '2025-10-28 03:18:02', '2025-10-28 02:18:10', '2025-10-28 09:18:02');

-- --------------------------------------------------------

--
-- Struktur dari tabel `payments`
--

CREATE TABLE `payments` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `method` enum('QRIS','DANA','OVO','GOPAY','TRANSFER','CASH') NOT NULL,
  `provider` varchar(32) DEFAULT 'manual',
  `provider_ref` varchar(64) DEFAULT NULL,
  `amount` int(11) NOT NULL,
  `status` enum('pending','paid','failed','expired','cancelled') NOT NULL DEFAULT 'pending',
  `qr_payload` text DEFAULT NULL,
  `qr_png_url` text DEFAULT NULL,
  `checkout_url` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  `raw_callback` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_callback`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `payments`
--

INSERT INTO `payments` (`id`, `order_id`, `method`, `provider`, `provider_ref`, `amount`, `status`, `qr_payload`, `qr_png_url`, `checkout_url`, `created_at`, `paid_at`, `raw_callback`) VALUES
(19, 47, 'QRIS', 'manual', NULL, 85000, 'pending', 'DHLDR|INV2601127570|85000|1768224798', NULL, NULL, '2026-01-12 14:33:18', NULL, NULL),
(20, 48, 'QRIS', 'manual', NULL, 1000000, 'paid', 'DHLDR|INV260112E63C|1000000|1768224960', NULL, NULL, '2026-01-12 14:36:00', '2026-01-12 14:36:05', NULL);

-- --------------------------------------------------------

--
-- Struktur dari tabel `pickup_delivery`
--

CREATE TABLE `pickup_delivery` (
  `id` int(11) NOT NULL,
  `task_code` varchar(20) DEFAULT NULL,
  `type` enum('pickup','delivery') NOT NULL,
  `order_code` varchar(40) DEFAULT NULL,
  `customer_name` varchar(80) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `status` enum('scheduled','assigned','onroute','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  `courier_id` int(11) DEFAULT NULL,
  `schedule_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `pickup_delivery`
--

INSERT INTO `pickup_delivery` (`id`, `task_code`, `type`, `order_code`, `customer_name`, `phone`, `address`, `status`, `courier_id`, `schedule_date`, `start_time`, `end_time`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'PU-001', 'pickup', 'ORD-10231', 'Rina Putri', '0812-9988-7766', 'Jl. Kamboja No.5, Menteng', 'completed', 1, '2025-10-22', '09:00:00', '10:00:00', 'Ambil 3 kg', '2025-10-22 18:18:10', '2025-10-22 13:01:46'),
(2, 'PU-002', 'pickup', 'ORD-10229', 'Dhea Anjani', '0852-5555-2222', 'Jl. Cemara No.8, Senayan', 'assigned', 2, '2025-10-22', '14:00:00', '15:00:00', 'Ada parkir basement', '2025-10-22 18:18:10', '2025-10-22 18:18:10'),
(3, 'DL-001', 'delivery', 'ORD-10215', 'Andi Saputra', '0813-3333-4444', 'Jl. Melati No.2, Tebet', 'onroute', 1, '2025-10-22', '16:00:00', '17:00:00', 'COD', '2025-10-22 18:18:10', '2025-10-22 18:18:10'),
(4, 'PU-003', 'pickup', 'INV25102335EC', 'dedi', 'saas2', 'dsa', '', 2, '2025-10-23', '14:19:00', '19:19:00', NULL, '2025-10-23 14:14:18', '2025-10-23 14:14:18'),
(5, 'DL-002', 'delivery', 'ORD-2510233F8', 'dedi', '082148564979', 'suldam', '', 1, '2025-10-23', '19:14:00', '00:14:00', NULL, '2025-10-23 14:14:56', '2025-10-23 14:14:56'),
(6, 'DL-003', 'delivery', 'INV251112CA97', 'dhani078', '078665', 'kayutangi', '', 2, '2025-11-12', '02:03:00', '02:05:00', 'otw', '2025-11-12 18:53:18', '2025-11-12 18:53:18'),
(7, 'PU-222', 'delivery', 'INV260112E63C', 'test', '231321', 'sultan adam', '', 3, '2026-01-12', '21:02:00', '23:35:00', 'OTW', '2026-01-12 21:38:21', '2026-01-12 21:38:21');

-- --------------------------------------------------------

--
-- Struktur dari tabel `promos`
--

CREATE TABLE `promos` (
  `id` int(11) NOT NULL,
  `name` varchar(120) NOT NULL,
  `type` enum('percent','fixed') NOT NULL DEFAULT 'percent',
  `value` int(11) NOT NULL DEFAULT 0,
  `service_id` int(11) DEFAULT NULL,
  `min_kg` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `start_at` datetime DEFAULT NULL,
  `end_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `promos`
--

INSERT INTO `promos` (`id`, `name`, `type`, `value`, `service_id`, `min_kg`, `is_active`, `start_at`, `end_at`, `created_at`) VALUES
(1, 'Diskon 10% Semua Layanan', 'percent', 10, NULL, 0, 1, NULL, NULL, '2025-10-22 22:21:12'),
(2, 'Potongan Rp5.000 Cuci Kilat', 'fixed', 5000, NULL, 0, 1, NULL, NULL, '2025-10-22 22:21:12'),
(3, 'Promo Kg Hemat (min 5kg) 15%', 'percent', 15, NULL, 5, 1, NULL, NULL, '2025-10-22 22:21:12'),
(4, 'JUMAT BERKAH', '', 10000, NULL, 0, 1, '2026-01-12 21:39:00', '2026-01-22 21:39:00', '2026-01-12 21:39:46');

-- --------------------------------------------------------

--
-- Struktur dari tabel `services`
--

CREATE TABLE `services` (
  `id` int(11) NOT NULL,
  `code` varchar(20) DEFAULT NULL,
  `name` varchar(80) NOT NULL,
  `description` text DEFAULT NULL,
  `unit` varchar(20) NOT NULL DEFAULT 'kg',
  `price` int(11) NOT NULL,
  `duration_hours` int(11) NOT NULL,
  `category` varchar(20) NOT NULL DEFAULT 'Reguler',
  `is_popular` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `badge` varchar(30) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `services`
--

INSERT INTO `services` (`id`, `code`, `name`, `description`, `unit`, `price`, `duration_hours`, `category`, `is_popular`, `is_active`, `badge`, `created_at`, `updated_at`) VALUES
(1, NULL, 'Cuci Kering', NULL, 'kg', 20000, 5, 'Reguler', 1, 1, NULL, '2025-10-22 06:19:34', '2025-10-22 13:00:19'),
(2, NULL, 'Setrika', NULL, 'kg', 20000, 4, 'Reguler', 0, 1, NULL, '2025-10-22 06:19:34', '2025-10-22 17:52:24'),
(3, NULL, 'Cuci Lipat', NULL, 'kg', 15000, 6, 'Reguler', 0, 1, NULL, '2025-10-22 06:19:34', '2025-10-22 17:52:24'),
(4, NULL, 'Dry Cleaning', NULL, 'kg', 35000, 24, 'Reguler', 0, 1, NULL, '2025-10-22 06:19:34', '2025-10-22 17:52:24');

-- --------------------------------------------------------

--
-- Struktur dari tabel `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(120) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `avatar_path` varchar(255) DEFAULT NULL,
  `role` enum('Admin','Owner','Staff','Customer') NOT NULL DEFAULT 'Customer',
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `users`
--

INSERT INTO `users` (`id`, `full_name`, `email`, `phone`, `avatar_path`, `role`, `password_hash`, `created_at`) VALUES
(1, 'dhani1', 'dhanisepeda1@gmail.com', '0821312312', NULL, 'Staff', '$2y$10$I5nfvdQm77QlfE2pKzjNk.cyUhDlulBmNvOxEeo1FN6224mO/BR7W', '2025-10-22 06:26:16'),
(2, 'dhani078', 'dhani@gmail.com', '082148564979', NULL, 'Customer', '$2y$10$LgOi/yr6En9B7tHm1sDafOPaHHS5CbCUyb2eiWkJXdQh4ygRQsHcO', '2025-10-22 06:31:20'),
(3, 'dhani12', 'dhanisep@gmail.com', '0821312', NULL, 'Customer', '$2y$10$x.ht9BPiArRuMJjJHwMiLunJ87W1fIp5HWaQXIt55t888rRohm2li', '2025-10-22 06:34:33'),
(4, 'dedi', 'dedi@gmail.com', '08231321', NULL, 'Customer', '$2y$10$ON8BL2AcwzkHJ4sP.mp05eAvs396fScQn4890MZF1zAUWX1Ey7Cpe', '2025-10-22 13:15:31'),
(5, 'desi', 'desi@gmail.com', '08231312', NULL, 'Customer', '$2y$10$bGXwLZTHD1uH7k0fr2GT4.sM6i8IvCguasc0VmKdCLl1GJgSRPAbS', '2025-10-23 04:49:51'),
(6, 'dhani', 'Dhani123@gmail.com', '0823123123', NULL, 'Customer', '$2y$10$pHL64Bbgn6EEdAgu/T2XduyytcBKMrXK56Wd0ZzWaUJfwP6CisPTS', '2025-11-12 10:45:36'),
(7, 'dhani078', 'Dhani078@gmail.com', '088888888', NULL, 'Customer', '$2y$10$K/ddUAlniI0f797ZCt/S7eihQoxIvZxfNML.t5tzRPoJ5f/542Ssu', '2025-11-12 10:47:27'),
(8, 'user', 'user@gmail.com', '082312312', NULL, 'Customer', '$2y$10$MFoJW/WY0BzeFV5Fz5ooC.T3OZwSOH3QEKiJzTz3MRMPzw5YCzNLa', '2025-12-03 07:44:07'),
(9, 'test', 'test@gmail.com', '0821222222222', NULL, 'Customer', '$2y$10$lDT8CmHg4LgrIUHFvE/JG.8nGXcqtJ/FnFCrnra1BEtD93Po3F0n6', '2026-01-12 13:31:24'),
(10, 'tesbanget', 'Dhani12345@gmail.com', '08213213', NULL, 'Customer', '$2y$10$KQaWTj9a.jGD009ADhNSz.PB6byB0E7GAY9aZzzQxRxtVUbE/WG.e', '2026-05-01 04:18:56');

-- --------------------------------------------------------

--
-- Struktur dari tabel `user_vouchers`
--

CREATE TABLE `user_vouchers` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `promo_id` int(10) UNSIGNED DEFAULT NULL,
  `code` varchar(32) NOT NULL,
  `name` varchar(128) NOT NULL,
  `type` enum('flat','percent') NOT NULL DEFAULT 'flat',
  `value` int(11) NOT NULL DEFAULT 0,
  `min_spend` int(11) NOT NULL DEFAULT 0,
  `max_discount` int(11) NOT NULL DEFAULT 0,
  `expires_at` datetime DEFAULT NULL,
  `used_at` datetime DEFAULT NULL,
  `source` varchar(32) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `user_vouchers`
--

INSERT INTO `user_vouchers` (`id`, `user_id`, `promo_id`, `code`, `name`, `type`, `value`, `min_spend`, `max_discount`, `expires_at`, `used_at`, `source`, `created_at`) VALUES
(1, 4, 3, 'PRM-ED901C', 'Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)', 'percent', 15, 0, 0, '2025-11-06 05:56:03', '2025-11-04 12:10:49', 'claim', '2025-10-23 11:56:03'),
(2, 4, 2, 'PRM-2A5A7A', 'Potongan Rp5.000 Cuci Kilat (Voucher Kamu)', 'flat', 5000, 0, 0, '2025-11-06 05:56:51', '2025-10-23 12:04:35', 'claim', '2025-10-23 11:56:51'),
(3, 4, 1, 'PRM-B88769', 'Diskon 10% Semua Layanan (Voucher Kamu)', 'percent', 10, 0, 0, '2025-11-06 05:56:54', '2025-10-23 12:01:04', 'claim', '2025-10-23 11:56:54'),
(4, 4, 3, 'PRM-A31AC6', 'Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)', 'percent', 15, 0, 0, '2025-11-06 06:01:31', '2025-10-28 08:32:18', 'claim', '2025-10-23 12:01:31'),
(5, 4, 3, 'PRM-33935C', 'Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)', 'percent', 15, 0, 0, '2025-11-06 06:04:13', '2025-10-23 12:16:38', 'claim', '2025-10-23 12:04:13'),
(6, 4, 1, 'PRM-0303ED', 'Diskon 10% Semua Layanan (Voucher Kamu)', 'percent', 10, 0, 0, '2025-11-06 06:46:22', '2025-10-23 13:18:29', 'claim', '2025-10-23 12:46:22'),
(7, 4, 3, 'PRM-995325', 'Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)', 'percent', 15, 0, 0, '2025-11-19 09:06:22', NULL, 'claim', '2025-11-05 16:06:22'),
(8, 4, 3, 'PRM-514B18', 'Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)', 'percent', 15, 0, 0, '2025-11-19 09:06:24', '2025-11-05 16:06:53', 'claim', '2025-11-05 16:06:24'),
(9, 1, 3, 'PRM-84E3AE', 'Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)', 'percent', 15, 0, 0, '2025-11-26 11:46:16', NULL, 'claim', '2025-11-12 18:46:16'),
(10, 7, 3, 'PRM-B15DEC', 'Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)', 'percent', 15, 0, 0, '2025-11-26 11:47:40', '2025-11-12 18:48:15', 'claim', '2025-11-12 18:47:40'),
(11, 9, 3, 'PRM-C8CF52', 'Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)', 'percent', 15, 0, 0, '2026-01-26 14:32:04', '2026-01-12 21:32:32', 'claim', '2026-01-12 21:32:04'),
(12, 9, 2, 'PRM-FAD8A0', 'Potongan Rp5.000 Cuci Kilat (Voucher Kamu)', 'flat', 5000, 0, 0, '2026-01-26 14:34:50', NULL, 'claim', '2026-01-12 21:34:50');

-- --------------------------------------------------------

--
-- Struktur dari tabel `voucher_claims`
--

CREATE TABLE `voucher_claims` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `promo_id` int(10) UNSIGNED DEFAULT NULL,
  `voucher_id` int(10) UNSIGNED DEFAULT NULL,
  `source` varchar(32) NOT NULL,
  `amount` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `voucher_claims`
--

INSERT INTO `voucher_claims` (`id`, `user_id`, `promo_id`, `voucher_id`, `source`, `amount`, `created_at`) VALUES
(1, 4, 3, 1, 'claim', 15, '2025-10-23 11:56:03'),
(2, 4, 2, 2, 'claim', 5000, '2025-10-23 11:56:51'),
(3, 4, 1, 3, 'claim', 10, '2025-10-23 11:56:54'),
(4, 4, 1, 3, 'code', 6000, '2025-10-23 12:01:04'),
(5, 4, 3, 4, 'claim', 15, '2025-10-23 12:01:31'),
(6, 4, 3, 5, 'claim', 15, '2025-10-23 12:04:13'),
(7, 4, 2, 2, 'code', 5000, '2025-10-23 12:04:35'),
(8, 4, 3, 5, 'code', 9000, '2025-10-23 12:16:38'),
(9, 4, 1, 6, 'claim', 10, '2025-10-23 12:46:22'),
(10, 4, 1, 6, 'code', 6000, '2025-10-23 13:18:29'),
(11, 4, 3, 4, 'code', 9000, '2025-10-28 08:32:18'),
(12, 4, 3, 1, 'code', 9000, '2025-11-04 12:10:49'),
(13, 4, 3, 7, 'claim', 15, '2025-11-05 16:06:22'),
(14, 4, 3, 8, 'claim', 15, '2025-11-05 16:06:24'),
(15, 4, 3, 8, 'code', 3000, '2025-11-05 16:06:53'),
(16, 1, 3, 9, 'claim', 15, '2025-11-12 18:46:16'),
(17, 7, 3, 10, 'claim', 15, '2025-11-12 18:47:40'),
(18, 7, 3, 10, 'code', 15000, '2025-11-12 18:48:15'),
(19, 9, 3, 11, 'claim', 15, '2026-01-12 21:32:04'),
(20, 9, 3, 11, 'code', 15000, '2026-01-12 21:32:32'),
(21, 9, 2, 12, 'claim', 5000, '2026-01-12 21:34:50');

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `couriers`
--
ALTER TABLE `couriers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indeks untuk tabel `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indeks untuk tabel `daily_checkins`
--
ALTER TABLE `daily_checkins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_user_day` (`user_id`,`day`),
  ADD KEY `idx_user` (`user_id`);

--
-- Indeks untuk tabel `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `order_code` (`order_code`),
  ADD KEY `idx_orders_created` (`created_at`),
  ADD KEY `idx_orders_finished` (`finished_at`),
  ADD KEY `idx_orders_service` (`service_id`),
  ADD KEY `idx_orders_status` (`status`),
  ADD KEY `fk_orders_createdby` (`created_by`);

--
-- Indeks untuk tabel `password_resets`
--
ALTER TABLE `password_resets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_token` (`token_hash`),
  ADD KEY `idx_user` (`user_id`);

--
-- Indeks untuk tabel `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order_id` (`order_id`),
  ADD KEY `idx_status` (`status`);

--
-- Indeks untuk tabel `pickup_delivery`
--
ALTER TABLE `pickup_delivery`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `task_code` (`task_code`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_date` (`schedule_date`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_courier` (`courier_id`);

--
-- Indeks untuk tabel `promos`
--
ALTER TABLE `promos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_time` (`start_at`,`end_at`),
  ADD KEY `idx_service` (`service_id`);

--
-- Indeks untuk tabel `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indeks untuk tabel `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indeks untuk tabel `user_vouchers`
--
ALTER TABLE `user_vouchers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_code` (`code`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_expires` (`expires_at`);

--
-- Indeks untuk tabel `voucher_claims`
--
ALTER TABLE `voucher_claims`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_voucher` (`voucher_id`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `couriers`
--
ALTER TABLE `couriers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT untuk tabel `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT untuk tabel `daily_checkins`
--
ALTER TABLE `daily_checkins`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT untuk tabel `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=54;

--
-- AUTO_INCREMENT untuk tabel `password_resets`
--
ALTER TABLE `password_resets`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT untuk tabel `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT untuk tabel `pickup_delivery`
--
ALTER TABLE `pickup_delivery`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT untuk tabel `promos`
--
ALTER TABLE `promos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT untuk tabel `services`
--
ALTER TABLE `services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT untuk tabel `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT untuk tabel `user_vouchers`
--
ALTER TABLE `user_vouchers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT untuk tabel `voucher_claims`
--
ALTER TABLE `voucher_claims`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- Ketidakleluasaan untuk tabel pelimpahan (Dumped Tables)
--

--
-- Ketidakleluasaan untuk tabel `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_createdby` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_orders_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `fk_pay_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `pickup_delivery`
--
ALTER TABLE `pickup_delivery`
  ADD CONSTRAINT `fk_pd_courier` FOREIGN KEY (`courier_id`) REFERENCES `couriers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `promos`
--
ALTER TABLE `promos`
  ADD CONSTRAINT `fk_promos_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
