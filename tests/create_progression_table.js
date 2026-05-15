require("dotenv").config();
const knex = require("knex");

const db = knex({
  client: "mysql2",
  connection: {
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_BASE,
    port: process.env.SQL_PORT || 3306,
  }
});

async function createTable() {
  try {
    console.log("Creating user_progression table...");
    
    const exists = await db.schema.hasTable("user_progression");
    if (!exists) {
      await db.schema.createTable("user_progression", (table) => {
        table.string("user_id", 20).primary();
        table.bigInteger("xp").defaultTo(0);
        table.integer("level").defaultTo(1);
        table.bigInteger("rp").defaultTo(0);
        table.integer("streak_count").defaultTo(0);
        table.integer("streak_shields").defaultTo(0);
        table.bigInteger("daily_voice_ms").defaultTo(0);
        table.string("last_active_date", 10).nullable();
        table.boolean("is_frozen").defaultTo(false);
        table.timestamp("updated_at").defaultTo(db.fn.now());
        
        table.index("xp");
        table.index("rp");
        table.index("level");
      });
      console.log("Table user_progression created successfully!");
    } else {
      console.log("Table user_progression already exists.");
    }
  } catch (error) {
    console.error("Error creating table:", error);
  } finally {
    await db.destroy();
  }
}

createTable();
