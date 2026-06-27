const { readFileSync } = require("fs");
const { join } = require("path");
const knex = require("knex");
const mysql = require("mysql2/promise");

let database = null;
let isConnected = false;
let reconnectPromise = null;

function getConnectionConfig(includeDatabase = true) {
  let host = process.env.SQL_HOST || "127.0.0.1";
  let port = parseInt(process.env.SQL_PORT) || 3306;

  // Robust parsing if host contains port (common in Pterodactyl copy-paste)
  if (host.includes(":")) {
    const [h, p] = host.split(":");
    host = h;
    port = parseInt(p) || port;
  }

  return {
    host,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD || "",
    port: port,
    ...(includeDatabase ? { database: process.env.SQL_BASE } : {}),
  };
}

function getKnexConfig() {
  return {
    client: "mysql2",
    connection: getConnectionConfig(true),
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
    },
    acquireConnectionTimeout: 10000,
  };
}

function describeDbError(error) {
  if (!error) return "Unknown database error";
  const parts = [error.code, error.errno, error.sqlState, error.message].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(" | ") : String(error);
}

function escapeMysqlIdentifier(identifier) {
  const value = String(identifier || "").trim();
  if (!value) {
    throw new Error("SQL_BASE est vide ou invalide.");
  }

  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(
      `Nom de base invalide: "${value}". Utilisez uniquement lettres, chiffres et underscore.`,
    );
  }

  return `\`${value}\``;
}

function loadBootstrapSchema(databaseName) {
  const schemaPath = join(__dirname, "database_schema.sql");
  const rawSchema = readFileSync(schemaPath, "utf8");
  const escapedDatabase = escapeMysqlIdentifier(databaseName);

  return rawSchema
    .replace(
      /CREATE DATABASE IF NOT EXISTS\s+[`"]?[A-Za-z0-9_]+[`"]?\s+/i,
      `CREATE DATABASE IF NOT EXISTS ${escapedDatabase} `,
    )
    .replace(/USE\s+[`"]?[A-Za-z0-9_]+[`"]?\s*;/i, `USE ${escapedDatabase};`);
}

async function bootstrapMissingDatabase(client) {
  const databaseName = process.env.SQL_BASE;
  const serverConnection = await mysql.createConnection({
    ...getConnectionConfig(false),
    multipleStatements: true,
  });

  try {
    client
      ?.getLogger?.()
      ?.send(
        `Base "${databaseName}" introuvable, creation automatique en cours...`,
        "WARN",
      );

    const schemaSql = loadBootstrapSchema(databaseName);
    await serverConnection.query(schemaSql);

    client
      ?.getLogger?.()
      ?.send(`Base "${databaseName}" creee et schema applique.`, "READY");
  } finally {
    await serverConnection.end().catch(() => {});
  }
}

async function destroyDatabaseSilently() {
  if (!database) return;
  try {
    await database.destroy();
  } catch {
    // ignore shutdown errors during recovery
  } finally {
    database = null;
    isConnected = false;
  }
}

async function ensureDatabaseConnection(client) {
  if (database && isConnected) {
    try {
      await database.raw("SELECT 1");
      return database;
    } catch (error) {
      client
        ?.getLogger?.()
        ?.send(
          `[DB] Ping failed, reconnecting: ${describeDbError(error)}`,
          "WARN",
        );
      await destroyDatabaseSilently();
    }
  }

  if (reconnectPromise) {
    await reconnectPromise;
    return database;
  }

  reconnectPromise = (async () => {
    const connector = client?.database;
    if (connector && typeof connector.connect === "function") {
      const ok = await connector.connect();
      if (!ok) {
        isConnected = false;
      }
    }
  })();

  try {
    await reconnectPromise;
  } finally {
    reconnectPromise = null;
  }

  return database;
}

class Database {
  constructor(client) {
    this.client = client;
    this.db = null;
  }

  async connect() {
    try {
      if (database && isConnected) {
        this.client.getLogger().send("Database already connected", "NOTIF");
        return true;
      }

      database = knex(getKnexConfig());
      await database.raw("SELECT 1");

      this.db = database;
      isConnected = true;
      this.client.getLogger().send("MySQL connection established", "READY");

      // Verify and bootstrap vital tables if missing
      await this.checkVitalTables();

      // Auto create GMod tables
      await this.initGmodTables();

      return true;
    } catch (error) {
      if (error?.errno === 1049) {
        this.client
          .getLogger()
          .send(
            `Database connection error: ${describeDbError(error)}`,
            "ERROR",
          );
        await destroyDatabaseSilently();

        try {
          await bootstrapMissingDatabase(this.client);

          database = knex(getKnexConfig());
          await database.raw("SELECT 1");

          this.db = database;
          isConnected = true;
          this.client
            .getLogger()
            .send("MySQL connection established after bootstrap", "READY");

          // Verify and bootstrap vital tables if missing
          await this.checkVitalTables();

          // Auto create GMod tables
          await this.initGmodTables();

          return true;
        } catch (bootstrapError) {
          this.client
            .getLogger()
            .send(
              `Database bootstrap error: ${describeDbError(bootstrapError)}`,
              "ERROR",
            );
          this.client
            .getLogger()
            .send(`Stack: ${bootstrapError.stack}`, "DEBUG");
          await destroyDatabaseSilently();
          return false;
        }
      }

      this.client
        .getLogger()
        .send(`Database connection error: ${describeDbError(error)}`, "ERROR");
      this.client.getLogger().send(`Stack: ${error.stack}`, "DEBUG");
      await destroyDatabaseSilently();
      return false;
    }
  }

  async checkVitalTables() {
    try {
      const knexInstance = this.db;
      if (!knexInstance) return;
      const hasUsers = await knexInstance.schema.hasTable("users");
      const hasGiveaways = await knexInstance.schema.hasTable("giveaways");
      const hasProgression = await knexInstance.schema.hasTable("user_progression");
      if (!hasUsers || !hasGiveaways || !hasProgression) {
        this.client.getLogger().send("Tables vitales manquantes ou base vide. Initialisation du schema...", "WARN");
        await bootstrapMissingDatabase(this.client);
      }
    } catch (error) {
      this.client.getLogger().send(`Erreur lors de la verification des tables vitales: ${error.message}`, "ERROR");
    }
  }

  async initGmodTables() {
    try {
      const knexInstance = this.db;
      const hasPlayers = await knexInstance.schema.hasTable("gmod_players");
      if (!hasPlayers) {
        await knexInstance.schema.createTable("gmod_players", (table) => {
          table.string("steamid", 30).primary();
          table.string("rpname", 100).notNullable();
          table.integer("wallet").defaultTo(0);
          table.integer("bank").defaultTo(0);
          table.string("job", 50).defaultTo("Citizen");
          table.integer("playtime").defaultTo(0);
          table.string("usergroup", 50).defaultTo("user");
          table.string("discord_id", 20).nullable();
          table.timestamp("last_seen").defaultTo(knexInstance.fn.now());
        });
        this.client.getLogger().send("MySQL table 'gmod_players' initialized", "READY");
      }

      const hasActions = await knexInstance.schema.hasTable("gmod_actions");
      if (!hasActions) {
        await knexInstance.schema.createTable("gmod_actions", (table) => {
          table.increments("id").primary();
          table.string("steamid", 30).notNullable();
          table.string("action_type", 50).notNullable();
          table.text("action_value").notNullable();
          table.enum("status", ["pending", "sent", "executed", "failed"]).defaultTo("pending");
          table.timestamp("created_at").defaultTo(knexInstance.fn.now());
          table.timestamp("executed_at").nullable();
          table.text("error_message").nullable();
        });
        this.client.getLogger().send("MySQL table 'gmod_actions' initialized", "READY");
      }
    } catch (error) {
      this.client.getLogger().send(`Error initializing GMod tables: ${error.message}`, "ERROR");
    }
  }

  async disconnect() {
    try {
      if (database) {
        await database.destroy();
        database = null;
        isConnected = false;
        this.client.getLogger().send("MySQL connection closed", "NOTIF");
      }
    } catch (error) {
      this.client
        .getLogger()
        .send(`Database close error: ${describeDbError(error)}`, "ERROR");
    }
  }

  getDatabase() {
    return database;
  }

  isConnected() {
    return isConnected;
  }
}

module.exports = Database;
module.exports.getDatabase = () => database;
module.exports.ensureDatabaseConnection = ensureDatabaseConnection;
module.exports.describeDbError = describeDbError;
module.exports.database = null;
