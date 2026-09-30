<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$pdo = getDBConnection();

// Read JSON input body if present
$rawInput = file_get_contents('php://input');
$inputData = json_decode($rawInput, true) ?? [];

switch ($action) {
    case 'login':
        $username = trim($inputData['username'] ?? $_POST['username'] ?? '');
        $password = trim($inputData['password'] ?? $_POST['password'] ?? '');

        $user = loginUser($username, $password);
        if ($user) {
            echo json_encode(["status" => "success", "user" => $user]);
        } else {
            http_response_code(401);
            echo json_encode(["status" => "error", "message" => "Invalid username or password"]);
        }
        break;

    case 'logout':
        logoutUser();
        echo json_encode(["status" => "success", "message" => "Logged out successfully"]);
        break;

    case 'get_session':
        $user = getCurrentUser();
        if ($user) {
            echo json_encode(["status" => "success", "user" => $user]);
        } else {
            echo json_encode(["status" => "unauthenticated"]);
        }
        break;

    case 'get_projects':
        try {
            // Fetch projects
            $projStmt = $pdo->query("SELECT `id`, `name`, `category`, `lead_name` AS `leadName`, `start_date` AS `startDate`, `description` FROM `projects` ORDER BY `created_at` DESC");
            $projects = $projStmt->fetchAll();

            // Fetch tasks for each project
            $taskStmt = $pdo->prepare("SELECT `task_num` AS `id`, `task_name` AS `name`, `duration`, `is_summary` AS `isSummary`, `level`, `expanded`, `predecessors`, `resources`, `progress`, `deadline` FROM `tasks` WHERE `project_id` = :project_id ORDER BY `task_num` ASC");

            foreach ($projects as &$proj) {
                $taskStmt->execute(['project_id' => $proj['id']]);
                $tasks = $taskStmt->fetchAll();

                // Format boolean types
                foreach ($tasks as &$t) {
                    $t['id'] = (int)$t['id'];
                    $t['duration'] = (float)$t['duration'];
                    $t['isSummary'] = (bool)$t['isSummary'];
                    $t['level'] = (int)$t['level'];
                    $t['expanded'] = (bool)$t['expanded'];
                    $t['progress'] = (int)$t['progress'];
                }
                $proj['tasks'] = $tasks;
            }

            echo json_encode($projects);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;

    case 'save_project':
        $projectsList = $inputData;
        if (isset($inputData['id'])) {
            $projectsList = [$inputData];
        }

        try {
            $pdo->beginTransaction();

            $insertProj = $pdo->prepare("INSERT INTO `projects` (`id`, `name`, `category`, `lead_name`, `start_date`, `description`) 
                VALUES (:id, :name, :category, :lead_name, :start_date, :description)
                ON DUPLICATE KEY UPDATE `name`=:name, `category`=:category, `lead_name`=:lead_name, `start_date`=:start_date, `description`=:description");

            $deleteTasks = $pdo->prepare("DELETE FROM `tasks` WHERE `project_id` = :project_id");
            
            $insertTask = $pdo->prepare("INSERT INTO `tasks` (`project_id`, `task_num`, `task_name`, `duration`, `is_summary`, `level`, `expanded`, `predecessors`, `resources`, `progress`, `deadline`) 
                VALUES (:project_id, :task_num, :task_name, :duration, :is_summary, :level, :expanded, :predecessors, :resources, :progress, :deadline)");

            foreach ($projectsList as $proj) {
                $insertProj->execute([
                    'id' => $proj['id'],
                    'name' => $proj['name'],
                    'category' => $proj['category'] ?? 'General IT',
                    'lead_name' => $proj['leadName'] ?? 'IT Lead',
                    'start_date' => $proj['startDate'],
                    'description' => $proj['description'] ?? ''
                ]);

                // Delete existing tasks for this project & re-insert updated list
                $deleteTasks->execute(['project_id' => $proj['id']]);

                if (isset($proj['tasks']) && is_array($proj['tasks'])) {
                    foreach ($proj['tasks'] as $t) {
                        $insertTask->execute([
                            'project_id' => $proj['id'],
                            'task_num' => $t['id'],
                            'task_name' => $t['name'],
                            'duration' => $t['duration'],
                            'is_summary' => !empty($t['isSummary']) ? 1 : 0,
                            'level' => $t['level'] ?? 0,
                            'expanded' => !empty($t['expanded']) ? 1 : 0,
                            'predecessors' => $t['predecessors'] ?? '',
                            'resources' => $t['resources'] ?? '',
                            'progress' => $t['progress'] ?? 0,
                            'deadline' => !empty($t['deadline']) ? $t['deadline'] : null
                        ]);
                    }
                }
            }

            $pdo->commit();
            echo json_encode(["status" => "success", "message" => "Projects saved to MySQL database"]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;

    case 'delete_project':
        $projId = $inputData['id'] ?? $_POST['id'] ?? '';
        if ($projId) {
            $stmt = $pdo->prepare("DELETE FROM `projects` WHERE `id` = :id");
            $stmt->execute(['id' => $projId]);
            echo json_encode(["status" => "success", "message" => "Project deleted from database"]);
        } else {
            echo json_encode(["status" => "error", "message" => "Missing project ID"]);
        }
        break;

    case 'get_users':
        $stmt = $pdo->query("SELECT `id`, `username`, `full_name` AS `fullName`, `role`, `created_at` FROM `users` ORDER BY `id` ASC");
        echo json_encode($stmt->fetchAll());
        break;

    case 'create_user':
        $username = trim($inputData['username'] ?? '');
        $password = trim($inputData['password'] ?? '');
        $fullName = trim($inputData['fullName'] ?? '');
        $role = $inputData['role'] ?? 'user';

        if (!$username || !$password || !$fullName) {
            echo json_encode(["status" => "error", "message" => "Required fields missing"]);
            exit;
        }

        try {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO `users` (`username`, `password_hash`, `full_name`, `role`) VALUES (:username, :hash, :fullName, :role)");
            $stmt->execute([
                'username' => $username,
                'hash' => $hash,
                'fullName' => $fullName,
                'role' => $role
            ]);
            echo json_encode(["status" => "success", "message" => "User account created successfully"]);
        } catch (Exception $e) {
            echo json_encode(["status" => "error", "message" => "Username already exists or SQL error"]);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Invalid API action"]);
        break;
}
?>
