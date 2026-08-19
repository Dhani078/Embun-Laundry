-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: embun_laundry
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `couriers`
--

DROP TABLE IF EXISTS `couriers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `couriers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) DEFAULT NULL,
  `full_name` varchar(80) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `vehicle` varchar(40) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `rating` decimal(3,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `couriers`
--

LOCK TABLES `couriers` WRITE;
/*!40000 ALTER TABLE `couriers` DISABLE KEYS */;
INSERT INTO `couriers` VALUES (1,'CR-001','Randy','0812-3456-7890','Motor',1,4.80,'2025-10-22 18:18:10','2025-10-22 18:18:10'),(2,'CR-002','Budi','0857-1111-2222','Motor',1,4.60,'2025-10-22 18:18:10','2025-10-22 18:18:10'),(3,'CR-003','DAN','12312312','Mobil',1,5.00,'2026-01-12 21:37:21','2026-01-12 21:37:21');
/*!40000 ALTER TABLE `couriers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `tag` enum('VIP','Reguler','Sering','Baru') NOT NULL DEFAULT 'Reguler',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'CUST-8112','dhani','082148564979','dhani','Reguler','2025-10-22 09:43:19','2025-11-04 05:11:39'),(2,'CUST-4671','20000',NULL,NULL,'Reguler','2025-10-22 08:31:27','2025-11-04 05:11:39'),(3,'CUST-2465','dhani123',NULL,NULL,'Reguler','2025-10-22 09:42:18','2025-11-04 05:11:39'),(4,'CUST-3298','dhani12','082148564979','Sultan Adam','Reguler','2025-10-22 10:08:52','2025-11-04 05:11:39'),(5,'CUST-0873','dedi','082148564979','suldam','Baru','2025-10-22 15:27:48','2026-06-22 19:49:22'),(6,'CUST-9993','dhani1','2131','1231','Reguler','2025-10-23 07:32:34','2025-11-04 05:11:39'),(7,'CUST-9975','dhani078','078665','kayutangi','Reguler','2025-11-12 11:48:15','2025-12-03 08:15:46'),(8,'CUST-0164','test','08321312','kayutangi','Baru','2026-01-12 14:32:32','2026-06-22 19:49:22'),(9,'CUST-5560','tesbanget','4123','2232','Baru','2026-05-01 06:19:10','2026-06-22 19:49:22'),(10,'CUST-3702','dasdsa','3213','dsadass','Baru','2026-05-13 10:47:25','2026-06-22 19:49:22'),(11,'CUST-9880','dd','42','sdad','Baru','2026-05-13 10:47:35','2026-06-22 19:49:22'),(12,'CUST-4675','dasdas','21312','dsadsadsa','Baru','2026-05-13 10:47:46','2026-06-22 19:49:22'),(13,'CUST-0205','ewqe','2312312','12121','Baru','2026-05-13 10:47:52','2026-06-22 19:49:22');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `daily_checkins`
--

DROP TABLE IF EXISTS `daily_checkins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `daily_checkins` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `day` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_day` (`user_id`,`day`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_checkins`
--

LOCK TABLES `daily_checkins` WRITE;
/*!40000 ALTER TABLE `daily_checkins` DISABLE KEYS */;
INSERT INTO `daily_checkins` VALUES (1,4,'2025-10-23','2025-10-23 11:55:50'),(2,4,'2025-10-27','2025-10-27 11:45:51');
/*!40000 ALTER TABLE `daily_checkins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
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
  `finished_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_code` (`order_code`),
  KEY `idx_orders_created` (`created_at`),
  KEY `idx_orders_finished` (`finished_at`),
  KEY `idx_orders_service` (`service_id`),
  KEY `idx_orders_status` (`status`),
  KEY `fk_orders_createdby` (`created_by`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (46,'INV2512030444','dedi','083211','kayutangi',1,3,20000,0,60000,0,'unpaid',NULL,'baru','2026-06-23 01:46:50','2026-06-23 01:46:50'),(47,'INV2601127570','test','08321312','kayutangi',1,5,20000,15000,85000,0,'unpaid',NULL,'baru','2026-06-23 01:46:50','2026-06-23 01:46:50'),(48,'INV260112E63C','test','231321','sultan adam',1,50,20000,0,1000000,1000000,'paid',NULL,'baru','2026-06-23 01:46:50','2026-06-23 01:46:50'),(49,'ORD-2605010AA','tesbanget','4123','2232',1,3,20000,0,60000,0,'unpaid',NULL,'baru','2026-06-23 01:46:50','2026-06-23 01:46:50'),(50,'INV260513CDC8','dasdsa','3213','dsadass',1,3,20000,0,60000,0,'unpaid',NULL,'baru','2026-06-23 01:46:50','2026-06-23 01:46:50'),(51,'INV260513B0C8','dd','42','sdad',2,3,20000,0,60000,0,'unpaid',NULL,'baru','2026-06-23 01:46:50','2026-06-23 01:46:50'),(52,'INV2605138D4F','dasdas','21312','dsadsadsa',3,3,15000,0,45000,0,'unpaid',NULL,'baru','2026-06-23 01:46:50','2026-06-23 01:46:50'),(53,'INV26051349B5','ewqe','2312312','12121',4,3,35000,0,105000,0,'unpaid',NULL,'baru','2026-06-23 01:46:50','2026-06-23 01:46:50');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_resets`
--

DROP TABLE IF EXISTS `password_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_resets` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_token` (`token_hash`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_resets`
--

LOCK TABLES `password_resets` WRITE;
/*!40000 ALTER TABLE `password_resets` DISABLE KEYS */;
INSERT INTO `password_resets` VALUES (1,1,'f7c1c0569427f0c890b13a64155865fdad5e39723edebccba6c1186a3867a62d','2025-10-25 05:23:05','2025-10-25 04:23:37','2025-10-25 10:23:05'),(2,4,'6b5c82f04e80f17ad907854fa38f1baa1c2371b1ac2fc92b8612aa6249fa0b90','2025-10-25 05:26:37','2025-10-25 04:26:59','2025-10-25 10:26:37'),(3,1,'e2c75f337aa3c4234a3947ba87c1f3b8a6597f07a7cdcd2f006e6eebdf9c5f6b','2025-10-28 03:18:02','2025-10-28 02:18:10','2025-10-28 09:18:02');
/*!40000 ALTER TABLE `password_resets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
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
  `raw_callback` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_callback`)),
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (19,47,'QRIS','manual',NULL,85000,'pending','DHLDR|INV2601127570|85000|1768224798',NULL,NULL,'2026-01-12 14:33:18',NULL,NULL),(20,48,'QRIS','manual',NULL,1000000,'paid','DHLDR|INV260112E63C|1000000|1768224960',NULL,NULL,'2026-01-12 14:36:00','2026-01-12 14:36:05',NULL);
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pickup_delivery`
--

DROP TABLE IF EXISTS `pickup_delivery`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pickup_delivery` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
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
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_code` (`task_code`),
  KEY `idx_type` (`type`),
  KEY `idx_date` (`schedule_date`),
  KEY `idx_status` (`status`),
  KEY `idx_courier` (`courier_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pickup_delivery`
--

LOCK TABLES `pickup_delivery` WRITE;
/*!40000 ALTER TABLE `pickup_delivery` DISABLE KEYS */;
INSERT INTO `pickup_delivery` VALUES (1,'PU-001','pickup','ORD-10231','Rina Putri','0812-9988-7766','Jl. Kamboja No.5, Menteng','completed',1,'2025-10-22','09:00:00','10:00:00','Ambil 3 kg','2025-10-22 18:18:10','2025-10-22 13:01:46'),(2,'PU-002','pickup','ORD-10229','Dhea Anjani','0852-5555-2222','Jl. Cemara No.8, Senayan','assigned',2,'2025-10-22','14:00:00','15:00:00','Ada parkir basement','2025-10-22 18:18:10','2025-10-22 18:18:10'),(3,'DL-001','delivery','ORD-10215','Andi Saputra','0813-3333-4444','Jl. Melati No.2, Tebet','onroute',1,'2025-10-22','16:00:00','17:00:00','COD','2025-10-22 18:18:10','2025-10-22 18:18:10'),(4,'PU-003','pickup','INV25102335EC','dedi','saas2','dsa','',2,'2025-10-23','14:19:00','19:19:00',NULL,'2025-10-23 14:14:18','2025-10-23 14:14:18'),(5,'DL-002','delivery','ORD-2510233F8','dedi','082148564979','suldam','',1,'2025-10-23','19:14:00','00:14:00',NULL,'2025-10-23 14:14:56','2025-10-23 14:14:56'),(6,'DL-003','delivery','INV251112CA97','dhani078','078665','kayutangi','',2,'2025-11-12','02:03:00','02:05:00','otw','2025-11-12 18:53:18','2025-11-12 18:53:18'),(7,'PU-222','delivery','INV260112E63C','test','231321','sultan adam','',3,'2026-01-12','21:02:00','23:35:00','OTW','2026-01-12 21:38:21','2026-01-12 21:38:21');
/*!40000 ALTER TABLE `pickup_delivery` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `promos`
--

DROP TABLE IF EXISTS `promos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `promos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `type` enum('percent','fixed') NOT NULL DEFAULT 'percent',
  `value` int(11) NOT NULL DEFAULT 0,
  `service_id` int(11) DEFAULT NULL,
  `min_kg` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `start_at` datetime DEFAULT NULL,
  `end_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_time` (`start_at`,`end_at`),
  KEY `idx_service` (`service_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `promos`
--

LOCK TABLES `promos` WRITE;
/*!40000 ALTER TABLE `promos` DISABLE KEYS */;
INSERT INTO `promos` VALUES (1,'Diskon 10% Semua Layanan','percent',10,NULL,0,1,NULL,NULL,'2025-10-22 22:21:12'),(2,'Potongan Rp5.000 Cuci Kilat','fixed',5000,NULL,0,1,NULL,NULL,'2025-10-22 22:21:12'),(3,'Promo Kg Hemat (min 5kg) 15%','percent',15,NULL,5,1,NULL,NULL,'2025-10-22 22:21:12'),(4,'JUMAT BERKAH','',10000,NULL,0,1,'2026-01-12 21:39:00','2026-01-22 21:39:00','2026-01-12 21:39:46');
/*!40000 ALTER TABLE `promos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `services` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
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
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `services`
--

LOCK TABLES `services` WRITE;
/*!40000 ALTER TABLE `services` DISABLE KEYS */;
INSERT INTO `services` VALUES (1,NULL,'Cuci Kering',NULL,'kg',20000,5,'Reguler',1,1,NULL,'2025-10-22 06:19:34','2025-10-22 13:00:19'),(2,NULL,'Setrika',NULL,'kg',20000,4,'Reguler',0,1,NULL,'2025-10-22 06:19:34','2025-10-22 17:52:24'),(3,NULL,'Cuci Lipat',NULL,'kg',15000,6,'Reguler',0,1,NULL,'2025-10-22 06:19:34','2025-10-22 17:52:24'),(4,NULL,'Dry Cleaning',NULL,'kg',35000,24,'Reguler',0,1,NULL,'2025-10-22 06:19:34','2025-10-22 17:52:24');
/*!40000 ALTER TABLE `services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_vouchers`
--

DROP TABLE IF EXISTS `user_vouchers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_vouchers` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `promo_id` int(10) unsigned DEFAULT NULL,
  `code` varchar(32) NOT NULL,
  `name` varchar(128) NOT NULL,
  `type` enum('flat','percent') NOT NULL DEFAULT 'flat',
  `value` int(11) NOT NULL DEFAULT 0,
  `min_spend` int(11) NOT NULL DEFAULT 0,
  `max_discount` int(11) NOT NULL DEFAULT 0,
  `expires_at` datetime DEFAULT NULL,
  `used_at` datetime DEFAULT NULL,
  `source` varchar(32) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_code` (`code`),
  KEY `idx_user` (`user_id`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_vouchers`
--

LOCK TABLES `user_vouchers` WRITE;
/*!40000 ALTER TABLE `user_vouchers` DISABLE KEYS */;
INSERT INTO `user_vouchers` VALUES (1,4,3,'PRM-ED901C','Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)','percent',15,0,0,'2025-11-06 05:56:03','2025-11-04 12:10:49','claim','2025-10-23 11:56:03'),(2,4,2,'PRM-2A5A7A','Potongan Rp5.000 Cuci Kilat (Voucher Kamu)','flat',5000,0,0,'2025-11-06 05:56:51','2025-10-23 12:04:35','claim','2025-10-23 11:56:51'),(3,4,1,'PRM-B88769','Diskon 10% Semua Layanan (Voucher Kamu)','percent',10,0,0,'2025-11-06 05:56:54','2025-10-23 12:01:04','claim','2025-10-23 11:56:54'),(4,4,3,'PRM-A31AC6','Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)','percent',15,0,0,'2025-11-06 06:01:31','2025-10-28 08:32:18','claim','2025-10-23 12:01:31'),(5,4,3,'PRM-33935C','Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)','percent',15,0,0,'2025-11-06 06:04:13','2025-10-23 12:16:38','claim','2025-10-23 12:04:13'),(6,4,1,'PRM-0303ED','Diskon 10% Semua Layanan (Voucher Kamu)','percent',10,0,0,'2025-11-06 06:46:22','2025-10-23 13:18:29','claim','2025-10-23 12:46:22'),(7,4,3,'PRM-995325','Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)','percent',15,0,0,'2025-11-19 09:06:22',NULL,'claim','2025-11-05 16:06:22'),(8,4,3,'PRM-514B18','Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)','percent',15,0,0,'2025-11-19 09:06:24','2025-11-05 16:06:53','claim','2025-11-05 16:06:24'),(9,1,3,'PRM-84E3AE','Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)','percent',15,0,0,'2025-11-26 11:46:16',NULL,'claim','2025-11-12 18:46:16'),(10,7,3,'PRM-B15DEC','Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)','percent',15,0,0,'2025-11-26 11:47:40','2025-11-12 18:48:15','claim','2025-11-12 18:47:40'),(11,9,3,'PRM-C8CF52','Promo Kg Hemat (min 5kg) 15% (Voucher Kamu)','percent',15,0,0,'2026-01-26 14:32:04','2026-01-12 21:32:32','claim','2026-01-12 21:32:04'),(12,9,2,'PRM-FAD8A0','Potongan Rp5.000 Cuci Kilat (Voucher Kamu)','flat',5000,0,0,'2026-01-26 14:34:50',NULL,'claim','2026-01-12 21:34:50');
/*!40000 ALTER TABLE `user_vouchers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(120) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `avatar_path` varchar(255) DEFAULT NULL,
  `role` enum('Admin','Owner','Staff','Customer') NOT NULL DEFAULT 'Customer',
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'dhani1','dhanisepeda1@gmail.com','0821312312',NULL,'Staff','$2y$10$I5nfvdQm77QlfE2pKzjNk.cyUhDlulBmNvOxEeo1FN6224mO/BR7W','2025-10-22 06:26:16'),(2,'dhani078','dhani@gmail.com','082148564979',NULL,'Customer','$2y$10$LgOi/yr6En9B7tHm1sDafOPaHHS5CbCUyb2eiWkJXdQh4ygRQsHcO','2025-10-22 06:31:20'),(3,'dhani12','dhanisep@gmail.com','0821312',NULL,'Customer','$2y$10$x.ht9BPiArRuMJjJHwMiLunJ87W1fIp5HWaQXIt55t888rRohm2li','2025-10-22 06:34:33'),(4,'dedi','dedi@gmail.com','08231321',NULL,'Customer','$2y$10$ON8BL2AcwzkHJ4sP.mp05eAvs396fScQn4890MZF1zAUWX1Ey7Cpe','2025-10-22 13:15:31'),(5,'desi','desi@gmail.com','08231312',NULL,'Customer','$2y$10$bGXwLZTHD1uH7k0fr2GT4.sM6i8IvCguasc0VmKdCLl1GJgSRPAbS','2025-10-23 04:49:51'),(6,'dhani','Dhani123@gmail.com','0823123123',NULL,'Customer','$2y$10$pHL64Bbgn6EEdAgu/T2XduyytcBKMrXK56Wd0ZzWaUJfwP6CisPTS','2025-11-12 10:45:36'),(7,'dhani078','Dhani078@gmail.com','088888888',NULL,'Customer','$2y$10$K/ddUAlniI0f797ZCt/S7eihQoxIvZxfNML.t5tzRPoJ5f/542Ssu','2025-11-12 10:47:27'),(8,'user','user@gmail.com','082312312',NULL,'Customer','$2y$10$MFoJW/WY0BzeFV5Fz5ooC.T3OZwSOH3QEKiJzTz3MRMPzw5YCzNLa','2025-12-03 07:44:07'),(9,'test','test@gmail.com','0821222222222',NULL,'Customer','$2y$10$lDT8CmHg4LgrIUHFvE/JG.8nGXcqtJ/FnFCrnra1BEtD93Po3F0n6','2026-01-12 13:31:24'),(10,'tesbanget','Dhani12345@gmail.com','08213213',NULL,'Customer','$2y$10$KQaWTj9a.jGD009ADhNSz.PB6byB0E7GAY9aZzzQxRxtVUbE/WG.e','2026-05-01 04:18:56'),(11,'Test User','test@test.com','081234567890',NULL,'Customer','$2y$10$pzRy1CtsQwx7dGWCHyQ.Oe2B39Z2xwUDg4MLWYzjLiEDFs236P5uS','2026-06-22 17:22:22'),(12,'admin','admin@gmail.com','08324324','admin','Admin','$2y$10$ZYycLdU.aUfQ2M5z2gHxWO9MQ.tTakhazfIJVgSMPIOgqmlAbgrP2','2026-06-22 17:31:21'),(13,'Verification Tester','tester@verification.com','08123456789',NULL,'Admin','$2y$10$gcUiS3tjrt9g84lEqG.YRuyyInBitH6MrXP4TVrb3RXHHzct8grvO','2026-06-22 17:40:51');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voucher_claims`
--

DROP TABLE IF EXISTS `voucher_claims`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voucher_claims` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `promo_id` int(10) unsigned DEFAULT NULL,
  `voucher_id` int(10) unsigned DEFAULT NULL,
  `source` varchar(32) NOT NULL,
  `amount` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_voucher` (`voucher_id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voucher_claims`
--

LOCK TABLES `voucher_claims` WRITE;
/*!40000 ALTER TABLE `voucher_claims` DISABLE KEYS */;
INSERT INTO `voucher_claims` VALUES (1,4,3,1,'claim',15,'2025-10-23 11:56:03'),(2,4,2,2,'claim',5000,'2025-10-23 11:56:51'),(3,4,1,3,'claim',10,'2025-10-23 11:56:54'),(4,4,1,3,'code',6000,'2025-10-23 12:01:04'),(5,4,3,4,'claim',15,'2025-10-23 12:01:31'),(6,4,3,5,'claim',15,'2025-10-23 12:04:13'),(7,4,2,2,'code',5000,'2025-10-23 12:04:35'),(8,4,3,5,'code',9000,'2025-10-23 12:16:38'),(9,4,1,6,'claim',10,'2025-10-23 12:46:22'),(10,4,1,6,'code',6000,'2025-10-23 13:18:29'),(11,4,3,4,'code',9000,'2025-10-28 08:32:18'),(12,4,3,1,'code',9000,'2025-11-04 12:10:49'),(13,4,3,7,'claim',15,'2025-11-05 16:06:22'),(14,4,3,8,'claim',15,'2025-11-05 16:06:24'),(15,4,3,8,'code',3000,'2025-11-05 16:06:53'),(16,1,3,9,'claim',15,'2025-11-12 18:46:16'),(17,7,3,10,'claim',15,'2025-11-12 18:47:40'),(18,7,3,10,'code',15000,'2025-11-12 18:48:15'),(19,9,3,11,'claim',15,'2026-01-12 21:32:04'),(20,9,3,11,'code',15000,'2026-01-12 21:32:32'),(21,9,2,12,'claim',5000,'2026-01-12 21:34:50');
/*!40000 ALTER TABLE `voucher_claims` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-19 19:50:55
