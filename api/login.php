<?php
require_once __DIR__ . '/../config.php';

$body = get_json_body();
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';

if (!$username || !$password) {
    json_response(['error' => 'نام کاربری و رمز عبور الزامی است'], 400);
}

$pdo = db();
$stmt = $pdo->prepare('SELECT password FROM users WHERE username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($user && password_verify($password, $user['password'])) {
    json_response(['success' => true]);
} else {
    json_response(['error' => 'نام کاربری یا رمز عبور اشتباه است'], 401);
}
