const mysql = require('mysql2/promise');
require('dotenv').config();

async function testRemoteConnection() {
    const host = '51.210.246.233';
    const user = 'u1_3lfSts6lV8';
    const password = '9wC47!nYHyB15eEF^Si^^JR7';
    const database = 's1_bot';
    
    console.log(`Testing connection to REMOTE host: ${host}`);
    
    try {
        const connection = await mysql.createConnection({
            host,
            user,
            password,
            database,
            port: 3306,
            connectTimeout: 5000
        });
        console.log(`✅ SUCCESS! Remote database connected.`);
        await connection.end();
    } catch (e) {
        console.log(`❌ FAILED: ${e.message}`);
        console.log(`Code: ${e.code}`);
    }
}

testRemoteConnection();
