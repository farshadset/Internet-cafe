<?php
require_once __DIR__ . '/../config.php';

$body = get_json_body();
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';

if (!$username || !$password) {
    json_response(['error' => 'نام کاربری و رمز عبور الزامی است'], 400);
}

$pdo = db();
$stmt = $pdo->prepare('INSERT INTO users (username, password) VALUES (?, ?)');

try {
    $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT)]);
    json_response(['success' => true]);
} catch (PDOException $e) {
    json_response(['error' => 'کاربر وجود دارد'], 400);
}
