const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnections() {
    const hosts = ['mysql', 'db', 'database', 'mariadb', '172.17.0.1'];
    const user = 'u1_3lfSts6lV8';
    const password = 'R=VR@!Vqia1mKOgBe+x1El+I';
    const database = 's1_bot';

    for (const host of hosts) {
        console.log(`Testing host: ${host}...`);
        try {
            const connection = await mysql.createConnection({
                host,
                user,
                password,
                database,
                connectTimeout: 5000
            });
            console.log(`✅ SUCCESS on host: ${host}`);
            await connection.end();
            return host;
        } catch (e) {
            console.log(`❌ FAILED on host: ${host}: ${e.message}`);
        }
    }
    return null;
}

testConnections().then(host => {
    if (host) console.log(`\nRecommended SQL_HOST: ${host}`);
    else console.log(`\nNo host worked. Check if the database is running and accessible.`);
    process.exit(0);
});
