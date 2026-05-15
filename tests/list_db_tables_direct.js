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
        const [rows] = await connection.query("SHOW TABLES");
        console.log("Tables in database:");
        rows.forEach(row => {
            console.log(`- ${Object.values(row)[0]}`);
        });

        await connection.end();
    } catch (error) {
        console.error("Error:", error.message);
    }
}

test();
