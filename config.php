<?php
// Database Configuration Settings
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'it_project_db');

// Session setup
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

/**
 * Get PDO Database Connection
 */
function getDBConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    try {
        // First connect without database name to ensure DB exists
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);

        // Create database if not exists
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `" . DB_NAME . "`");

        // Initialize schema tables if missing
        initSchemaIfNeeded($pdo);

        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Database connection failed: " . $e->getMessage()
        ]);
        exit;
    }
}

/**
 * Auto-initialize database tables if not existing
 */
function initSchemaIfNeeded($pdo) {
    // Check if users table exists
    $tableCheck = $pdo->query("SHOW TABLES LIKE 'users'")->fetch();
    if (!$tableCheck) {
        $schemaSql = file_get_contents(__DIR__ . '/schema.sql');
        if ($schemaSql) {
            $pdo->exec($schemaSql);
        }
    }
}
?>
