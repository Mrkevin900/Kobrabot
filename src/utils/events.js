const { getDatabase, ensureDatabaseConnection, describeDbError } = require("../database/database");
const { getRuntimeStore } = require("./runtimeStore");

const TABLE = "bot_events";
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
        table.string("channel_id", 32).notNullable();
        table.string("message_id", 32).notNullable().unique();
        table.string("author_id", 32).notNullable().index();
        table.string("title", 180).notNullable();
        table.text("description").notNullable();
        table.string("when_text", 180).notNullable();
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

async function addEventRecord(client, entry) {
  const db = (await ensureDatabaseConnection(client)) || getDatabase();
  if (db) {
    try {
      await ensureSchema(db);
      const inserted = await db(TABLE).insert({
        guild_id: String(entry.guildId),
        channel_id: String(entry.channelId),
        message_id: String(entry.messageId),
        author_id: String(entry.authorId),
        title: String(entry.title),
        description: String(entry.description),
        when_text: String(entry.whenText),
        created_at: Number(entry.createdAt) || Date.now(),
      });
      return Array.isArray(inserted) ? inserted[0] : inserted;
    } catch (error) {
      client
        ?.getLogger?.()
        ?.send(`[EVENT] Erreur DB evenement: ${describeDbError(error)}`, "WARN");
    }
  }

  const store = getRuntimeStore(client);
  const events = store.has("events") ? store.get("events") : [];
  const safeEvents = Array.isArray(events) ? events : [];
  const nextId = Number(store.get("eventsNextId") || 1);
  safeEvents.push({
    id: nextId,
    guildId: String(entry.guildId),
    channelId: String(entry.channelId),
    messageId: String(entry.messageId),
    authorId: String(entry.authorId),
    title: String(entry.title),
    description: String(entry.description),
    whenText: String(entry.whenText),
    createdAt: Number(entry.createdAt) || Date.now(),
  });
  store.set("events", safeEvents);
  store.set("eventsNextId", nextId + 1);
  return nextId;
}

module.exports = {
  TABLE,
  addEventRecord,
  ensureSchema,
};

