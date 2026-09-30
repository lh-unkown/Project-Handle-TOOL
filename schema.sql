-- MySQL / MariaDB Database Schema for IT Project Follow-Up System

CREATE DATABASE IF NOT EXISTS `it_project_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `it_project_db`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS `projects` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(50) DEFAULT 'General IT',
  `lead_name` VARCHAR(100) DEFAULT 'IT Lead',
  `start_date` DATE NOT NULL,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tasks Table
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `project_id` VARCHAR(50) NOT NULL,
  `task_num` INT NOT NULL,
  `task_name` VARCHAR(255) NOT NULL,
  `duration` DECIMAL(5,1) DEFAULT 1.0,
  `is_summary` TINYINT(1) DEFAULT 0,
  `level` INT DEFAULT 0,
  `expanded` TINYINT(1) DEFAULT 1,
  `predecessors` VARCHAR(100) DEFAULT '',
  `resources` VARCHAR(150) DEFAULT '',
  `progress` INT DEFAULT 0,
  `deadline` DATE NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Default Accounts (Passwords: admin123, user123)
-- Password hashes generated via password_hash()
INSERT INTO `users` (`username`, `password_hash`, `full_name`, `role`) VALUES
('admin', '$2y$10$e0MYzXyjpJS7Pd0RVvHwHe1T.wWnS43R8KqF4.m3QpB9.uR48l.lK', 'IT System Admin', 'admin'),
('user', '$2y$10$e0MYzXyjpJS7Pd0RVvHwHe1T.wWnS43R8KqF4.m3QpB9.uR48l.lK', 'IT Staff Member', 'user')
ON DUPLICATE KEY UPDATE `username`=`username`;

-- Seed Initial Clean Sample Project
INSERT INTO `projects` (`id`, `name`, `category`, `lead_name`, `start_date`, `description`) VALUES
('proj_001', 'Core IT Infrastructure Upgrade', 'Infrastructure', 'Saman Kumara', '2026-10-01', 'Server virtualization, network switch upgrade, and backup configuration.')
ON DUPLICATE KEY UPDATE `name`=`name`;

INSERT INTO `tasks` (`project_id`, `task_num`, `task_name`, `duration`, `is_summary`, `level`, `expanded`, `predecessors`, `resources`, `progress`, `deadline`) VALUES
('proj_001', 1, 'Infrastructure Upgrade Phase 1', 6.0, 1, 0, 1, '', 'Saman Kumara (Lead)', 40, '2026-10-15'),
('proj_001', 2, 'Requirements & Hardware Setup', 2.0, 0, 1, 1, '', 'Nimal Perera', 100, NULL),
('proj_001', 3, 'Virtualization Cluster Install', 3.0, 0, 1, 1, '2', 'Ruwan Jayasinghe', 50, NULL),
('proj_001', 4, 'Final QA & DNS Switchover', 1.0, 0, 1, 1, '3', 'Kasun Silva', 0, NULL)
ON DUPLICATE KEY UPDATE `task_name`=`task_name`;
