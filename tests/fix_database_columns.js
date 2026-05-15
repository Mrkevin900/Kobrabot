require("dotenv").config();
const knex = require("knex");

const config = {
    client: "mysql2",
    connection: {
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD || "",
        port: process.env.SQL_PORT || 3306,
        database: process.env.SQL_BASE
    }
};

async function fixDatabase() {
    const db = knex(config);
    console.log(`🔍 Vérification de la base de données: ${process.env.SQL_BASE}`);

    try {
        const table = "user_progression";
        const hasTable = await db.schema.hasTable(table);
        
        if (!hasTable) {
            console.log(`❌ Table '${table}' introuvable. Création en cours...`);
            await db.schema.createTable(table, (t) => {
                t.string("user_id", 20).primary();
                t.bigInteger("xp").defaultTo(0);
                t.integer("level").defaultTo(1);
                t.bigInteger("rp").defaultTo(0);
                t.integer("streak_count").defaultTo(0);
                t.integer("streak_shields").defaultTo(0);
                t.bigInteger("daily_voice_ms").defaultTo(0);
                t.integer("daily_msg_count").defaultTo(0);
                t.string("last_active_date", 10);
                t.boolean("is_frozen").defaultTo(false);
                t.timestamp("updated_at").defaultTo(db.fn.now());
            });
            console.log("✅ Table créée avec toutes les colonnes.");
        } else {
            console.log(`✅ Table '${table}' trouvée. Vérification des colonnes...`);
            
            const columns = [
                { name: "rp", type: "bigInteger", def: 0 },
                { name: "daily_msg_count", type: "integer", def: 0 },
                { name: "daily_voice_ms", type: "bigInteger", def: 0 },
                { name: "streak_shields", type: "integer", def: 0 },
                { name: "is_frozen", type: "boolean", def: false }
            ];

            for (const col of columns) {
                const hasCol = await db.schema.hasColumn(table, col.name);
                if (!hasCol) {
                    console.log(`➕ Ajout de la colonne: ${col.name}`);
                    await db.schema.table(table, (t) => {
                        if (col.type === "bigInteger") t.bigInteger(col.name).defaultTo(col.def);
                        else if (col.type === "integer") t.integer(col.name).defaultTo(col.def);
                        else if (col.type === "boolean") t.boolean(col.name).defaultTo(col.def);
                    });
                }
            }
            console.log("✅ Toutes les colonnes sont à jour.");
        }
    } catch (error) {
        console.error("❌ Erreur lors de la migration:", error.message);
    } finally {
        await db.destroy();
    }
}

fixDatabase();
