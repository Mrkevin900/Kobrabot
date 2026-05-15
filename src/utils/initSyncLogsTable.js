const Logger = require("./logger.runtime");
const database = require("../database/database").database;

async function initSyncLogsTable(logger = null) {
  const log = logger && typeof logger.send === "function" ? logger : new Logger();

  try {
    const hasTable = await database.schema.hasTable("SyncLogs");

    if (hasTable) {
      log.send("Table SyncLogs existe deja", "DATABASE");
      return true;
    }

    await database.schema.createTable("SyncLogs", (table) => {
      table.increments("id").primary();
      table.string("userId", 255).unique().nullable().index();
      table.string("rpName", 255).nullable();
      table.string("status", 20).notNullable();
      table.string("reason", 500).nullable();
      table.json("changes").nullable();
      table.timestamp("createdAt").defaultTo(database.fn.now());
      table.index("status");
      table.index("createdAt");
    });

    log.send("Table SyncLogs creee avec succes", "DATABASE");
    return true;
  } catch (error) {
    log.send(`Erreur creation table SyncLogs: ${error.message}`, "ERROR");
    return false;
  }
}

module.exports = initSyncLogsTable;

