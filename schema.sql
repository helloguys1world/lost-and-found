CREATE DATABASE IF NOT EXISTS lost_and_found;
USE lost_and_found;

-- 1. users & profiles
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
    profile_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    full_name VARCHAR(100),
    phone_number VARCHAR(20),
    address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 2. item_categories
CREATE TABLE IF NOT EXISTS item_categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- Insert some default categories
INSERT IGNORE INTO item_categories (category_name) VALUES 
('Electronics'), ('Documents'), ('Books'), ('Keys'), ('Clothing'), ('Other');

-- 3. lost_items
CREATE TABLE IF NOT EXISTS lost_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    unique_item_id VARCHAR(20) UNIQUE,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    description TEXT,
    brand VARCHAR(100),
    color VARCHAR(50),
    identifying_marks TEXT,
    location_lost VARCHAR(255) NOT NULL,
    date_lost DATE NOT NULL,
    status ENUM('Lost', 'Found', 'Claimed', 'Under Verification', 'Returned') DEFAULT 'Lost',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES item_categories(category_id) ON DELETE CASCADE
);

-- 4. found_items
CREATE TABLE IF NOT EXISTS found_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    unique_item_id VARCHAR(20) UNIQUE,
    user_id INT NOT NULL, -- The user who found it
    category_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    description TEXT,
    brand VARCHAR(100),
    color VARCHAR(50),
    identifying_marks TEXT,
    location_found VARCHAR(255) NOT NULL,
    date_found DATE NOT NULL,
    status ENUM('Lost', 'Found', 'Claimed', 'Under Verification', 'Returned') DEFAULT 'Found',
    tracking_id VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES item_categories(category_id) ON DELETE CASCADE
);

-- 5. claims & item_matches
CREATE TABLE IF NOT EXISTS claims (
    claim_id INT AUTO_INCREMENT PRIMARY KEY,
    claim_unique_id VARCHAR(20) UNIQUE,
    found_item_id INT NOT NULL,
    claimer_user_id INT NOT NULL,
    color VARCHAR(50),
    brand VARCHAR(100),
    identifying_marks TEXT,
    location_lost VARCHAR(255),
    date_lost DATE,
    proof_description TEXT,
    proof_file_path VARCHAR(255),
    status ENUM('Pending', 'Under Verification', 'Approved', 'Rejected') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (found_item_id) REFERENCES found_items(item_id) ON DELETE CASCADE,
    FOREIGN KEY (claimer_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS item_matches (
    match_id INT AUTO_INCREMENT PRIMARY KEY,
    lost_item_id INT NOT NULL,
    found_item_id INT NOT NULL,
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lost_item_id) REFERENCES lost_items(item_id) ON DELETE CASCADE,
    FOREIGN KEY (found_item_id) REFERENCES found_items(item_id) ON DELETE CASCADE
);

-- 6. notifications, admin_logs, & reports
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    action_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('open', 'resolved') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
