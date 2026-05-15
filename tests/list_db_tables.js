require("dotenv").config();
const { getDatabase, ensureDatabaseConnection } = require("../src/database/database");

async function test() {
    const mockClient = {
        getLogger: () => ({
            send: (msg, type) => console.log(`[${type}] ${msg}`)
        })
    };
    const db = await ensureDatabaseConnection(mockClient);
    if (!db) return;

    try {
        const [rows] = await db.raw("SHOW TABLES");
        console.log("Tables in database:");
        rows.forEach(row => {
            console.log(`- ${Object.values(row)[0]}`);
        });
    } catch (error) {
        console.error("Error:", error);
    } finally {
        process.exit(0);
    }
}

test();
