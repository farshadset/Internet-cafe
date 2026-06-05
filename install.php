<?php
require_once __DIR__ . '/config.php';

$pdo = db();

$sql = "
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tracking_code VARCHAR(50) UNIQUE NOT NULL,
    username VARCHAR(255),
    data JSON NOT NULL,
    status ENUM('pending', 'processing', 'completed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    result TEXT NULL,
    result_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS banners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    src TEXT NOT NULL,
    link VARCHAR(255) DEFAULT '',
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(50) PRIMARY KEY,
    role ENUM('customer', 'admin') NOT NULL,
    username VARCHAR(255),
    text TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_meta (
    meta_key VARCHAR(255) PRIMARY KEY,
    meta_value TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
";

$pdo->exec($sql);
echo json_response(['success' => true, 'message' => 'جداول با موفقیت ایجاد شدند.']);
