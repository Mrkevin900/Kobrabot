const { getDatabase, ensureDatabaseConnection, describeDbError } = require("../database/database");
const ModerationDb = require("./ModerationDb");
const { getRuntimeStore } = require("./runtimeStore");

const TABLE = "bot_warnings";
let schemaReady = false;
let schemaPromise = null;

async function ensureSchema(db) {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const exists = await db.schema.hasTable(TABLE);
    if (!exists) {
      await db.schema.createTable(TABLE, (table) => {
        table.increments("id").primary();
        table.string("guild_id", 32).notNullable().index();
        table.string("user_id", 32).notNullable().index();
        table.string("moderator_id", 32).notNullable().index();
        table.text("reason").notNullable();
        table.bigInteger("created_at").notNullable().defaultTo(0);
      });
    }
    schemaReady = true;
  })();

  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

function normalizeWarning(entry, id) {
  return {
    id: Number(id || entry.id || 0),
    guildId: String(entry.guildId || ""),
    userId: String(entry.userId || ""),
    moderatorId: String(entry.moderatorId || ""),
    reason: String(entry.reason || "").trim(),
    createdAt: Number(entry.createdAt) || Date.now(),
  };
}

function rowToWarning(row) {
  if (!row) return null;
  return normalizeWarning(
    {
      guildId: row.guild_id,
      userId: row.user_id,
      moderatorId: row.moderator_id,
      reason: row.reason,
      createdAt: row.created_at,
    },
    row.id,
  );
}

async function getDb(client) {
  return (await ensureDatabaseConnection(client)) || getDatabase();
}

async function addWarning(client, entry) {
  const db = await getDb(client);
  if (db) {
    try {
      await ensureSchema(db);
      const payload = normalizeWarning(entry);
      const inserted = await db(TABLE).insert({
        guild_id: payload.guildId,
        user_id: payload.userId,
        moderator_id: payload.moderatorId,
        reason: payload.reason,
        created_at: payload.createdAt,
      });
      const id = Array.isArray(inserted) ? inserted[0] : inserted;
      
      // Also log to global action logs
      await ModerationDb.logWarn(client, payload.guildId, payload.moderatorId, payload.userId, payload.reason);
      
      return normalizeWarning(payload, id);
    } catch (error) {
      client
        ?.getLogger?.()
        ?.send(`[WARN] Erreur DB warning: ${describeDbError(error)}`, "WARN");
    }
  }

  const store = getRuntimeStore(client);
  const warnings = store.has("warnings") ? store.get("warnings") : [];
  const safeWarnings = Array.isArray(warnings) ? warnings : [];
  const nextId = Number(store.get("warningsNextId") || 1);
  const record = normalizeWarning(entry, nextId);
  safeWarnings.push(record);
  store.set("warnings", safeWarnings);
  store.set("warningsNextId", nextId + 1);
  return record;
}

async function getWarningsForMember(client, guildId, userId, limit = 10) {
  const db = await getDb(client);
  if (db) {
    try {
      await ensureSchema(db);
      const rows = await db(TABLE)
        .where({
          guild_id: String(guildId),
          user_id: String(userId),
        })
        .orderBy("id", "desc")
        .limit(limit);
      return rows.map(rowToWarning);
    } catch (error) {
      client
        ?.getLogger?.()
        ?.send(`[WARN] Erreur lecture warnings: ${describeDbError(error)}`, "WARN");
    }
  }

  const store = getRuntimeStore(client);
  const warnings = store.has("warnings") ? store.get("warnings") : [];
  return (Array.isArray(warnings) ? warnings : [])
    .filter((warning) => warning.guildId === String(guildId) && warning.userId === String(userId))
    .sort((a, b) => b.id - a.id)
    .slice(0, limit);
}

module.exports = {
  TABLE,
  addWarning,
  ensureSchema,
  getWarningsForMember,
};

