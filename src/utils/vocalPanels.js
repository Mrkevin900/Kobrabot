const TABLE = "bot_vocal_panels";
let schemaReady = false;
let schemaPromise = null;

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeEntry(entry) {
  if (!entry) return null;
  return {
    guildId: String(entry.guildId || ""),
    channelId: String(entry.channelId || ""),
    ownerId: String(entry.ownerId || ""),
    mode: entry.mode || "public",
    whitelist: Array.isArray(entry.whitelist) ? entry.whitelist : [],
    blacklist: Array.isArray(entry.blacklist) ? entry.blacklist : [],
    savedLists:
      Array.isArray(entry.savedLists) && entry.savedLists.length >= 4
        ? entry.savedLists.slice(0, 4)
        : [null, null, null, null],
    restrictMic: Boolean(entry.restrictMic),
    restrictVideo: Boolean(entry.restrictVideo),
    createdAt: Number(entry.createdAt) || Date.now(),
    updatedAt: Number(entry.updatedAt) || Date.now(),
  };
}

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
        table.string("owner_id", 32).notNullable();
        table.string("mode", 16).notNullable().defaultTo("public");
        table.text("whitelist_json").notNullable();
        table.text("blacklist_json").notNullable();
        table.text("saved_lists_json").notNullable();
        table.boolean("restrict_mic").notNullable().defaultTo(false);
        table.boolean("restrict_video").notNullable().defaultTo(false);
        table.bigInteger("created_at").notNullable().defaultTo(0);
        table.bigInteger("updated_at").notNullable().defaultTo(0);
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

function rowToEntry(row) {
  if (!row) return null;
  return normalizeEntry({
    guildId: row.guild_id,
    channelId: row.channel_id,
    ownerId: row.owner_id,
    mode: row.mode,
    whitelist: safeParseJson(row.whitelist_json, []),
    blacklist: safeParseJson(row.blacklist_json, []),
    savedLists: safeParseJson(row.saved_lists_json, [null, null, null, null]),
    restrictMic: Boolean(row.restrict_mic),
    restrictVideo: Boolean(row.restrict_video),
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
  });
}

async function getPanel(db, guildId, channelId) {
  await ensureSchema(db);
  const row = await db(TABLE)
    .select(
      "guild_id",
      "channel_id",
      "owner_id",
      "mode",
      "whitelist_json",
      "blacklist_json",
      "saved_lists_json",
      "restrict_mic",
      "restrict_video",
      "created_at",
      "updated_at",
    )
    .where({
      guild_id: guildId,
      channel_id: channelId,
    })
    .first();

  return rowToEntry(row);
}

async function upsertPanel(db, entryInput) {
  await ensureSchema(db);
  const entry = normalizeEntry(entryInput);
  if (!entry?.guildId || !entry?.channelId || !entry?.ownerId) return false;

  const payload = {
    guild_id: entry.guildId,
    channel_id: entry.channelId,
    owner_id: entry.ownerId,
    mode: entry.mode,
    whitelist_json: JSON.stringify(entry.whitelist),
    blacklist_json: JSON.stringify(entry.blacklist),
    saved_lists_json: JSON.stringify(entry.savedLists),
    restrict_mic: entry.restrictMic ? 1 : 0,
    restrict_video: entry.restrictVideo ? 1 : 0,
    created_at: entry.createdAt,
    updated_at: Date.now(),
  };

  const existing = await db(TABLE)
    .where({ guild_id: entry.guildId, channel_id: entry.channelId })
    .first();
  if (existing) {
    await db(TABLE)
      .where({ guild_id: entry.guildId, channel_id: entry.channelId })
      .update(payload);
  } else {
    await db(TABLE).insert(payload);
  }
  return true;
}

async function deletePanel(db, guildId, channelId) {
  await ensureSchema(db);
  const affected = await db(TABLE)
    .where({
      guild_id: guildId,
      channel_id: channelId,
    })
    .delete();
  return Number(affected) || 0;
}

module.exports = {
  TABLE,
  ensureSchema,
  getPanel,
  upsertPanel,
  deletePanel,
};
