require("dotenv").config();
const mysql = require("mysql2/promise");
const { readFileSync } = require("fs");
const { join } = require("path");

async function test() {
    const databaseName = process.env.SQL_BASE;
    console.log(`Syncing schema for database: ${databaseName}...`);
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.SQL_HOST,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            port: process.env.SQL_PORT || 3306,
            multipleStatements: true
        });

        console.log("Connected!");
        
        // Ensure database exists
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
        await connection.query(`USE \`${databaseName}\``);

        const schemaPath = join(__dirname, "../src/database/database_schema.sql");
        let schemaSql = readFileSync(schemaPath, "utf8");
        
        // Clean up schema SQL (remove database creation at top if it conflicts)
        schemaSql = schemaSql.replace(/CREATE DATABASE IF NOT EXISTS\s+[`"]?[A-Za-z0-9_]+[`"]?\s+.*;/i, "");
        schemaSql = schemaSql.replace(/USE\s+[`"]?[A-Za-z0-9_]+[`"]?\s*;/i, "");

        console.log("Applying schema...");
        await connection.query(schemaSql);
        console.log("Schema applied successfully!");

        await connection.end();
    } catch (error) {
        console.error("Error:", error.message);
        if (error.stack) console.error(error.stack);
    }
}

test();
