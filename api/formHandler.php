<?php
header("Content-Type: application/json");
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = $_POST;
    // Here could add DB storage etc.
    echo json_encode([
        'success' => true,
        'message' => 'Form submitted',
        'data' => $data
    ]);
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
?>