const TABLE = "bot_vocal_triggers";
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
        table.string("guild_id", 32).notNullable();
        table.string("channel_id", 32).notNullable();
        table.bigInteger("created_at").notNullable().defaultTo(0);
        table.unique(["guild_id", "channel_id"]);
        table.index(["guild_id"]);
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

async function getGuildTriggers(db, guildId) {
  await ensureSchema(db);
  const rows = await db(TABLE).select("guild_id", "channel_id", "created_at").where({
    guild_id: guildId,
  });

  return rows.map((row) => ({
    guildId: row.guild_id,
    channelId: row.channel_id,
    createdAt: Number(row.created_at) || 0,
  }));
}

async function addTrigger(db, guildId, channelId) {
  await ensureSchema(db);
  const existing = await db(TABLE)
    .where({ guild_id: guildId, channel_id: channelId })
    .first();
  if (existing) return false;

  await db(TABLE).insert({
    guild_id: guildId,
    channel_id: channelId,
    created_at: Date.now(),
  });
  return true;
}

async function removeTrigger(db, guildId, channelId) {
  await ensureSchema(db);
  const affected = await db(TABLE)
    .where({ guild_id: guildId, channel_id: channelId })
    .delete();
  return Number(affected) || 0;
}

module.exports = {
  TABLE,
  ensureSchema,
  getGuildTriggers,
  addTrigger,
  removeTrigger,
};
