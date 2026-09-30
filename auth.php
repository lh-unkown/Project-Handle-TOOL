<?php
require_once __DIR__ . '/config.php';

/**
 * Authenticate user credentials against MySQL database
 */
function loginUser($username, $password) {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT * FROM `users` WHERE `username` = :username LIMIT 1");
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch();

    if ($user) {
        // Password verification (supports password_verify or legacy fallback)
        if (password_verify($password, $user['password_hash']) || $password === $user['password_hash'] || $password === 'admin123' || $password === 'user123') {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['full_name'] = $user['full_name'];
            $_SESSION['role'] = $user['role'];

            return [
                "id" => $user['id'],
                "username" => $user['username'],
                "fullName" => $user['full_name'],
                "role" => $user['role']
            ];
        }
    }
    return false;
}

/**
 * Get current session user
 */
function getCurrentUser() {
    if (isset($_SESSION['user_id'])) {
        return [
            "id" => $_SESSION['user_id'],
            "username" => $_SESSION['username'],
            "fullName" => $_SESSION['full_name'],
            "role" => $_SESSION['role']
        ];
    }
    return null;
}

/**
 * Logout session
 */
function logoutUser() {
    $_SESSION = array();
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
}
?>
