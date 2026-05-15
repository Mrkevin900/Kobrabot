require("dotenv").config();
const mysql = require("mysql2/promise");

async function test() {
    console.log("Connecting to MySQL...");
    try {
        const connection = await mysql.createConnection({
            host: process.env.SQL_HOST,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            database: process.env.SQL_BASE,
            port: process.env.SQL_PORT || 3306
        });

        console.log("Connected!");
        
        const sql = `
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
        `;

        console.log("Creating action_logs table...");
        await connection.query(sql);
        console.log("Table created successfully!");

        await connection.end();
    } catch (error) {
        console.error("Error:", error.message);
    }
}

test();
