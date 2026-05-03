const TABLE = "bot_levels";
let schemaReady = false;
let schemaPromise = null;

function xpForLevel(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  const n = safeLevel - 1;
  // Cumulative XP required to reach `level`
  // L2=100, L3=300, L4=600...
  return 50 * n * (n + 1);
}

async function ensureSchema(db) {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const exists = await db.schema.hasTable(TABLE);
    if (!exists) {
      await db.schema.createTable(TABLE, (table) => {
        table.string("guild_id", 32).notNullable();
        table.string("user_id", 32).notNullable();
        table.bigInteger("xp").notNullable().defaultTo(0);
        table.integer("level").notNullable().defaultTo(1);
        table.bigInteger("last_message_at").notNullable().defaultTo(0);
        table.timestamp("created_at").defaultTo(db.fn.now());
        table.timestamp("updated_at").defaultTo(db.fn.now());
        table.primary(["guild_id", "user_id"]);
        table.index(["guild_id", "xp"]);
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

async function getProfile(db, guildId, userId) {
  await ensureSchema(db);

  let row = await db(TABLE)
    .where({ guild_id: guildId, user_id: userId })
    .first();

  if (!row) {
    await db(TABLE).insert({
      guild_id: guildId,
      user_id: userId,
      xp: 0,
      level: 1,
      last_message_at: 0,
    });

    row = { guild_id: guildId, user_id: userId, xp: 0, level: 1, last_message_at: 0 };
  }

  return {
    guildId: row.guild_id,
    userId: row.user_id,
    xp: Number(row.xp) || 0,
    level: Number(row.level) || 1,
    lastMessageAt: Number(row.last_message_at) || 0,
  };
}

async function addXp(db, guildId, userId, amount, cooldownSeconds = 45, options = {}) {
  const now = Date.now();
  const profile = await getProfile(db, guildId, userId);
  const ignoreCooldown = options?.ignoreCooldown === true;

  if (!ignoreCooldown && now - profile.lastMessageAt < cooldownSeconds * 1000) {
    return { changed: false, profile };
  }

  const gain = Math.max(1, Number(amount) || 1);
  const nextXp = profile.xp + gain;

  let nextLevel = profile.level;
  while (nextXp >= xpForLevel(nextLevel + 1)) {
    nextLevel += 1;
  }

  await db(TABLE)
    .where({ guild_id: guildId, user_id: userId })
    .update({
      xp: nextXp,
      level: nextLevel,
      last_message_at: now,
      updated_at: db.fn.now(),
    });

  return {
    changed: true,
    leveledUp: nextLevel > profile.level,
    previousLevel: profile.level,
    profile: {
      ...profile,
      xp: nextXp,
      level: nextLevel,
      lastMessageAt: now,
    },
  };
}

async function getRank(db, guildId, xp) {
  await ensureSchema(db);

  const row = await db(TABLE)
    .where("guild_id", guildId)
    .andWhere("xp", ">", xp)
    .count({ c: "*" })
    .first();

  return (Number(row?.c) || 0) + 1;
}

async function getLeaderboard(db, guildId, limit = 10) {
  await ensureSchema(db);

  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
  const rows = await db(TABLE)
    .where("guild_id", guildId)
    .orderBy("level", "desc")
    .orderBy("xp", "desc")
    .limit(safeLimit);

  return rows.map((row) => ({
    guildId: row.guild_id,
    userId: row.user_id,
    xp: Number(row.xp) || 0,
    level: Number(row.level) || 1,
  }));
}

module.exports = {
  TABLE,
  ensureSchema,
  getProfile,
  addXp,
  getRank,
  getLeaderboard,
  xpForLevel,
};
