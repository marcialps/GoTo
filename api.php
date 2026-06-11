<?php
/**
 * Hora Solution API - PHP Backend for JSON Persistence
 * Designed for Shared Hosting environments like HostGator
 */

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$db_file = 'db.json';

// Helper to send JSON response
function sendResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

// GET: Load Data
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($db_file)) {
        $content = file_get_contents($db_file);
        if ($content === false) {
            sendResponse(["error" => "Could not read database file"], 500);
        }
        echo $content;
        exit;
    } else {
        // Return default structure if file doesn't exist
        $default = [
            "customers" => [],
            "payments" => [],
            "saasTypes" => ["Hora Clínica", "Hora Barber", "Hora Pet"],
            "config" => (object)[]
        ];
        echo json_encode($default);
        exit;
    }
}

// POST: Save Data
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    
    if (empty($input)) {
        sendResponse(["error" => "Empty data received"], 400);
    }

    // Optional: Validate JSON
    $data = json_decode($input);
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendResponse(["error" => "Invalid JSON data"], 400);
    }

    // Save to file
    if (file_put_contents($db_file, $input)) {
        sendResponse(["success" => true]);
    } else {
        sendResponse(["error" => "Failed to write to db.json. Check file permissions."], 500);
    }
}

// Fallback for other methods
sendResponse(["error" => "Method not allowed"], 405);
