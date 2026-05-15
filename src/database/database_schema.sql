-- ============================================
-- 🗄️ SCHÉMA BASE DE DONNÉES KOBRABOT
-- ============================================

-- Création de la base de données
CREATE DATABASE IF NOT EXISTS kobrabot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kobrabot;

-- ============================================
-- 👥 TABLE UTILISATEURS (Profils)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(20) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    discriminator VARCHAR(10),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Levels & XP
    xp BIGINT DEFAULT 0,
    level INT DEFAULT 0,
    messages_count INT DEFAULT 0,
    
    -- Économie
    balance BIGINT DEFAULT 0,
    bank BIGINT DEFAULT 0,
    last_daily TIMESTAMP NULL,
    last_work TIMESTAMP NULL,
    
    -- Stats
    total_commands INT DEFAULT 0,
    voice_time INT DEFAULT 0,
    
    -- Préférences
    xp_notifications BOOLEAN DEFAULT TRUE,
    profile_color VARCHAR(7) DEFAULT '#0099ff',
    
    INDEX idx_xp (xp DESC),
    INDEX idx_level (level DESC),
    INDEX idx_balance (balance DESC),
    INDEX idx_last_seen (last_seen DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 
 -- ============================================
 -- 🏆 TABLE PROGRESSION (XP / RANGS / STREAKS)
 -- ============================================
 CREATE TABLE IF NOT EXISTS user_progression (
     user_id VARCHAR(20) PRIMARY KEY,
     xp BIGINT DEFAULT 0,
     level INT DEFAULT 1,
     rp BIGINT DEFAULT 0,
     streak_count INT DEFAULT 0,
     streak_shields INT DEFAULT 0,
     daily_voice_ms BIGINT DEFAULT 0,
     daily_msg_count INT DEFAULT 0,
     last_active_date VARCHAR(10),
     is_frozen BOOLEAN DEFAULT FALSE,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     
     INDEX idx_xp (xp DESC),
     INDEX idx_rp (rp DESC),
     INDEX idx_level (level DESC)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 📊 TABLE HISTORIQUE XP
-- ============================================
CREATE TABLE IF NOT EXISTS xp_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    xp_gained INT NOT NULL,
    reason VARCHAR(100),
    channel_id VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 🎖️ TABLE ACHIEVEMENTS (Succès)
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    emoji VARCHAR(50),
    reward_xp INT DEFAULT 0,
    reward_money INT DEFAULT 0,
    requirement_type VARCHAR(50),
    requirement_value INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 🏆 TABLE ACHIEVEMENTS UTILISATEURS
-- ============================================
CREATE TABLE IF NOT EXISTS user_achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    achievement_id INT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_achievement (user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_unlocked (unlocked_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 💰 TABLE TRANSACTIONS (Économie)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    type ENUM('daily', 'work', 'transfer_sent', 'transfer_received', 'shop_buy', 'reward', 'admin', 'other') NOT NULL,
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    description TEXT,
    target_user_id VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, created_at DESC),
    INDEX idx_type (type, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 🛒 TABLE SHOP (Boutique)
-- ============================================
CREATE TABLE IF NOT EXISTS shop_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    type ENUM('role', 'cosmetic', 'consumable', 'other') DEFAULT 'other',
    role_id VARCHAR(20),
    emoji VARCHAR(50),
    stock INT DEFAULT -1,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_enabled (enabled, price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 🎒 TABLE INVENTAIRE UTILISATEURS
-- ============================================
CREATE TABLE IF NOT EXISTS user_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    item_id INT NOT NULL,
    quantity INT DEFAULT 1,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_item (user_id, item_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 🔄 TABLE LOGS SYNCHRONISATION
-- ============================================
CREATE TABLE IF NOT EXISTS sync_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    type ENUM('manual', 'auto_hourly', 'slow_loop', 'button', 'force_manual') NOT NULL,
    success BOOLEAN NOT NULL,
    
    -- Données avant sync
    old_nickname VARCHAR(100),
    old_roles JSON,
    
    -- Données après sync
    new_nickname VARCHAR(100),
    new_roles JSON,
    
    -- Détails
    api_status INT,
    error_message TEXT,
    duration_ms INT,
    
    triggered_by VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_date (user_id, created_at DESC),
    INDEX idx_type (type, created_at DESC),
    INDEX idx_success (success, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 📝 TABLE LOGS ERREURS API
-- ============================================
CREATE TABLE IF NOT EXISTS api_error_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20),
    endpoint VARCHAR(255),
    http_status INT,
    error_code VARCHAR(50),
    error_message TEXT,
    request_body TEXT,
    response_body TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status (http_status, created_at DESC),
    INDEX idx_user (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 🎫 TABLE GIVEAWAYS
-- ============================================
CREATE TABLE IF NOT EXISTS giveaways (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id VARCHAR(20) UNIQUE NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    host_id VARCHAR(20) NOT NULL,
    
    prize VARCHAR(255) NOT NULL,
    winners_count INT DEFAULT 1,
    requirements TEXT,
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP NULL DEFAULT NULL,
    ended BOOLEAN DEFAULT FALSE,
    
    winners JSON,
    participants JSON,
    
    INDEX idx_ends (ends_at, ended),
    INDEX idx_host (host_id, started_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 🎟️ TABLE TICKETS
-- ============================================
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    channel_id VARCHAR(20) UNIQUE NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    type ENUM('questions', 'recrutements', 'plainte', 'autres') DEFAULT 'autres',
    
    status ENUM('open', 'closed', 'archived') DEFAULT 'open',
    claimed_by VARCHAR(20),
    
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    closed_by VARCHAR(20),
    
    messages_count INT DEFAULT 0,
    
    INDEX idx_user (user_id, opened_at DESC),
    INDEX idx_status (status, opened_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 📨 TABLE LOGS ACTIONS (Audit)
-- ============================================
CREATE TABLE IF NOT EXISTS action_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(20),
    details JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_date (user_id, created_at DESC),
    INDEX idx_action (action_type, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- ⚙️ TABLE CONFIGURATION SERVEUR
-- ============================================
CREATE TABLE IF NOT EXISTS guild_config (
    guild_id VARCHAR(20) PRIMARY KEY,
    
    -- Levels
    xp_enabled BOOLEAN DEFAULT TRUE,
    xp_per_message INT DEFAULT 15,
    xp_cooldown INT DEFAULT 60,
    level_up_message TEXT,
    level_roles JSON,
    
    -- Économie
    economy_enabled BOOLEAN DEFAULT TRUE,
    currency_symbol VARCHAR(10) DEFAULT '💰',
    daily_amount INT DEFAULT 1000,
    work_min INT DEFAULT 50,
    work_max INT DEFAULT 500,
    
    -- Autres
    welcome_message TEXT,
    logs_enabled BOOLEAN DEFAULT TRUE,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- �️ TABLE PARAMÈTRES ANTI-RAID
-- ============================================
CREATE TABLE IF NOT EXISTS anti_raid_settings (
    guild_id VARCHAR(20) PRIMARY KEY,
    
    -- Anti-raid modules
    antiraid_enabled BOOLEAN DEFAULT FALSE,
    antiguildupdate_enabled BOOLEAN DEFAULT FALSE,
    antispam_enabled BOOLEAN DEFAULT FALSE,
    antichannel_enabled BOOLEAN DEFAULT FALSE,
    antiban_enabled BOOLEAN DEFAULT FALSE,
    antibot_enabled BOOLEAN DEFAULT FALSE,
    antikick_enabled BOOLEAN DEFAULT FALSE,
    antiinvite_enabled BOOLEAN DEFAULT FALSE,
    antilink_enabled BOOLEAN DEFAULT FALSE,
    antimassban_enabled BOOLEAN DEFAULT FALSE,
    antimasskick_enabled BOOLEAN DEFAULT FALSE,
    antimassping_enabled BOOLEAN DEFAULT FALSE,
    
    -- Channels
    logs_channel_id VARCHAR(20),
    
    -- Limits
    spam_limit INT DEFAULT 4,
    massban_limit INT DEFAULT 2,
    masskick_limit INT DEFAULT 2,
    massping_limit INT DEFAULT 2,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 🚫 TABLE BLACKLIST UTILISATEURS
-- ============================================
CREATE TABLE IF NOT EXISTS user_blacklist (
    user_id VARCHAR(20) PRIMARY KEY,
    reason TEXT,
    banned_by VARCHAR(20),
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 📊 TABLE STATISTIQUES SERVEUR
-- ============================================
CREATE TABLE IF NOT EXISTS server_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    
    total_members INT DEFAULT 0,
    messages_sent INT DEFAULT 0,
    commands_used INT DEFAULT 0,
    new_members INT DEFAULT 0,
    left_members INT DEFAULT 0,
    voice_minutes INT DEFAULT 0,
    
    UNIQUE KEY unique_guild_date (guild_id, date),
    INDEX idx_guild_date (guild_id, date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 🎁 INSERTION ACHIEVEMENTS PAR DÉFAUT
-- ============================================
INSERT INTO achievements (code, name, description, emoji, reward_xp, reward_money, requirement_type, requirement_value) VALUES
('first_message', 'Premier Pas', 'Envoie ton premier message', '👋', 50, 100, 'messages', 1),
('level_10', 'Apprenti', 'Atteins le niveau 10', '🌱', 500, 1000, 'level', 10),
('level_25', 'Expert', 'Atteins le niveau 25', '⭐', 1000, 2500, 'level', 25),
('level_50', 'Maître', 'Atteins le niveau 50', '👑', 2500, 10000, 'level', 50),
('level_100', 'Légende', 'Atteins le niveau 100', '🏆', 10000, 50000, 'level', 100),
('rich_1m', 'Millionnaire', 'Possède 1 000 000 de coins', '💎', 5000, 100000, 'balance', 1000000),
('messages_100', 'Bavard', 'Envoie 100 messages', '💬', 200, 500, 'messages', 100),
('messages_1000', 'Causeur', 'Envoie 1000 messages', '📢', 1000, 2000, 'messages', 1000),
('daily_7', 'Assidu', 'Réclame ton daily 7 jours de suite', '📅', 500, 5000, 'daily_streak', 7),
('daily_30', 'Fidèle', 'Réclame ton daily 30 jours de suite', '🗓️', 2000, 20000, 'daily_streak', 30)
ON DUPLICATE KEY UPDATE name=VALUES(name);


-- ============================================
-- ✅ VUES UTILES
-- ============================================

-- Vue du leaderboard XP
CREATE OR REPLACE VIEW v_leaderboard_xp AS
SELECT 
    user_id,
    username,
    level,
    xp,
    messages_count,
    RANK() OVER (ORDER BY xp DESC) as rank
FROM users
ORDER BY xp DESC;

-- Vue du leaderboard Économie
CREATE OR REPLACE VIEW v_leaderboard_money AS
SELECT 
    user_id,
    username,
    (balance + bank) as total_money,
    balance,
    bank,
    RANK() OVER (ORDER BY (balance + bank) DESC) as rank
FROM users
ORDER BY (balance + bank) DESC;

-- Vue stats sync aujourd'hui
CREATE OR REPLACE VIEW v_sync_stats_today AS
SELECT 
    DATE(created_at) as sync_date,
    COUNT(*) as total_syncs,
    SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful_syncs,
    SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed_syncs,
    AVG(duration_ms) as avg_duration_ms,
    type
FROM sync_logs
WHERE DATE(created_at) = CURDATE()
GROUP BY DATE(created_at), type;

CREATE TABLE IF NOT EXISTS ticket_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    ticket_number VARCHAR(20),
    ticket_type VARCHAR(32),
    event VARCHAR(40) NOT NULL,
    actor_id VARCHAR(20),
    owner_id VARCHAR(20),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ticket_logs_guild_date (guild_id, created_at DESC),
    INDEX idx_ticket_logs_channel_date (channel_id, created_at DESC),
    INDEX idx_ticket_logs_event_date (event, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
