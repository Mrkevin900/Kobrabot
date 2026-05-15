const mysql = require('mysql2/promise');
require('dotenv').config();

async function testEnvConnection() {
    console.log(`Testing connection with .env settings:`);
    console.log(`Host: ${process.env.SQL_HOST}`);
    console.log(`User: ${process.env.SQL_USER}`);
    console.log(`DB: ${process.env.SQL_BASE}`);
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.SQL_HOST,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            database: process.env.SQL_BASE,
            port: parseInt(process.env.SQL_PORT) || 3306,
            connectTimeout: 5000
        });
        console.log(`✅ SUCCESS! Database connected.`);
        await connection.end();
    } catch (e) {
        console.log(`❌ FAILED: ${e.message}`);
        console.log(`Code: ${e.code}`);
    }
}

testEnvConnection();
