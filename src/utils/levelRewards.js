const SETTINGS_TABLE = "bot_level_settings";
const WALLET_TABLE = "bot_level_wallets";

let schemaReady = false;
let schemaPromise = null;

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function ensureSchema(db) {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const hasSettings = await db.schema.hasTable(SETTINGS_TABLE);
    if (!hasSettings) {
      await db.schema.createTable(SETTINGS_TABLE, (table) => {
        table.string("guild_id", 32).primary();
        table.boolean("shop_enabled").notNullable().defaultTo(true);
        table.integer("reward_points_per_level").notNullable().defaultTo(1);
        table.integer("x2_price_points").notNullable().defaultTo(5);
        table.integer("x2_duration_minutes").notNullable().defaultTo(30);
        table.timestamp("created_at").defaultTo(db.fn.now());
        table.timestamp("updated_at").defaultTo(db.fn.now());
      });
    }

    const hasWallet = await db.schema.hasTable(WALLET_TABLE);
    if (!hasWallet) {
      await db.schema.createTable(WALLET_TABLE, (table) => {
        table.string("guild_id", 32).notNullable();
        table.string("user_id", 32).notNullable();
        table.integer("points").notNullable().defaultTo(0);
        table.decimal("xp_multiplier", 5, 2).notNullable().defaultTo(1);
        table.bigInteger("multiplier_until").notNullable().defaultTo(0);
        table.timestamp("created_at").defaultTo(db.fn.now());
        table.timestamp("updated_at").defaultTo(db.fn.now());
        table.primary(["guild_id", "user_id"]);
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

function normalizeSettings(row, guildId) {
  return {
    guildId,
    shopEnabled: Boolean(row?.shop_enabled ?? true),
    rewardPointsPerLevel: clamp(toInt(row?.reward_points_per_level, 1), 0, 1000),
    x2PricePoints: clamp(toInt(row?.x2_price_points, 5), 1, 1_000_000),
    x2DurationMinutes: clamp(toInt(row?.x2_duration_minutes, 30), 1, 43_200),
  };
}

function normalizeWallet(row, guildId, userId) {
  return {
    guildId,
    userId,
    points: Math.max(0, toInt(row?.points, 0)),
    xpMultiplier: Math.max(1, Number(row?.xp_multiplier) || 1),
    multiplierUntil: Math.max(0, Number(row?.multiplier_until) || 0),
  };
}

async function getGuildSettings(db, guildId) {
  await ensureSchema(db);
  let row = await db(SETTINGS_TABLE).where({ guild_id: guildId }).first();

  if (!row) {
    await db(SETTINGS_TABLE).insert({
      guild_id: guildId,
      shop_enabled: true,
      reward_points_per_level: 1,
      x2_price_points: 5,
      x2_duration_minutes: 30,
    });
    row = await db(SETTINGS_TABLE).where({ guild_id: guildId }).first();
  }

  return normalizeSettings(row, guildId);
}

async function updateGuildSettings(db, guildId, patch = {}) {
  const current = await getGuildSettings(db, guildId);

  const next = {
    shop_enabled:
      typeof patch.shopEnabled === "boolean" ? patch.shopEnabled : current.shopEnabled,
    reward_points_per_level:
      patch.rewardPointsPerLevel != null
        ? clamp(toInt(patch.rewardPointsPerLevel, current.rewardPointsPerLevel), 0, 1000)
        : current.rewardPointsPerLevel,
    x2_price_points:
      patch.x2PricePoints != null
        ? clamp(toInt(patch.x2PricePoints, current.x2PricePoints), 1, 1_000_000)
        : current.x2PricePoints,
    x2_duration_minutes:
      patch.x2DurationMinutes != null
        ? clamp(toInt(patch.x2DurationMinutes, current.x2DurationMinutes), 1, 43_200)
        : current.x2DurationMinutes,
    updated_at: db.fn.now(),
  };

  await db(SETTINGS_TABLE).where({ guild_id: guildId }).update(next);
  return getGuildSettings(db, guildId);
}

async function getWallet(db, guildId, userId) {
  await ensureSchema(db);
  let row = await db(WALLET_TABLE).where({ guild_id: guildId, user_id: userId }).first();

  if (!row) {
    await db(WALLET_TABLE).insert({
      guild_id: guildId,
      user_id: userId,
      points: 0,
      xp_multiplier: 1,
      multiplier_until: 0,
    });
    row = await db(WALLET_TABLE).where({ guild_id: guildId, user_id: userId }).first();
  }

  return normalizeWallet(row, guildId, userId);
}

async function addPoints(db, guildId, userId, amount) {
  const wallet = await getWallet(db, guildId, userId);
  const gain = Math.max(0, toInt(amount, 0));
  if (gain <= 0) return wallet;

  const nextPoints = wallet.points + gain;
  await db(WALLET_TABLE)
    .where({ guild_id: guildId, user_id: userId })
    .update({ points: nextPoints, updated_at: db.fn.now() });

  return { ...wallet, points: nextPoints };
}

async function spendPoints(db, guildId, userId, amount) {
  const wallet = await getWallet(db, guildId, userId);
  const cost = Math.max(0, toInt(amount, 0));
  if (cost <= 0) return { ok: true, wallet };
  if (wallet.points < cost) return { ok: false, wallet };

  const nextPoints = wallet.points - cost;
  await db(WALLET_TABLE)
    .where({ guild_id: guildId, user_id: userId })
    .update({ points: nextPoints, updated_at: db.fn.now() });

  return { ok: true, wallet: { ...wallet, points: nextPoints } };
}

async function getActiveMultiplier(db, guildId, userId) {
  const wallet = await getWallet(db, guildId, userId);
  const now = Date.now();

  if (wallet.xpMultiplier > 1 && wallet.multiplierUntil > now) {
    return wallet.xpMultiplier;
  }

  if (wallet.xpMultiplier !== 1 || wallet.multiplierUntil !== 0) {
    await db(WALLET_TABLE)
      .where({ guild_id: guildId, user_id: userId })
      .update({ xp_multiplier: 1, multiplier_until: 0, updated_at: db.fn.now() });
  }

  return 1;
}

async function grantMultiplier(db, guildId, userId, multiplier, durationMinutes, options = {}) {
  const wallet = await getWallet(db, guildId, userId);
  const safeMultiplier = Math.max(1, Number(multiplier) || 1);
  const safeDurationMinutes = clamp(toInt(durationMinutes, 30), 1, 43_200);
  const now = Date.now();
  const extend = options.extend !== false;
  const baseUntil = extend && wallet.multiplierUntil > now ? wallet.multiplierUntil : now;
  const until = baseUntil + safeDurationMinutes * 60_000;

  await db(WALLET_TABLE)
    .where({ guild_id: guildId, user_id: userId })
    .update({
      xp_multiplier: safeMultiplier,
      multiplier_until: until,
      updated_at: db.fn.now(),
    });

  return {
    ...wallet,
    xpMultiplier: safeMultiplier,
    multiplierUntil: until,
  };
}

async function grantLevelRewards(db, guildId, userId, levelsGained) {
  const gainedLevels = Math.max(0, toInt(levelsGained, 0));
  if (gainedLevels <= 0) return { awarded: 0, wallet: await getWallet(db, guildId, userId) };

  const settings = await getGuildSettings(db, guildId);
  const awarded = gainedLevels * settings.rewardPointsPerLevel;
  const wallet = await addPoints(db, guildId, userId, awarded);
  return { awarded, wallet, settings };
}

module.exports = {
  SETTINGS_TABLE,
  WALLET_TABLE,
  ensureSchema,
  getGuildSettings,
  updateGuildSettings,
  getWallet,
  addPoints,
  spendPoints,
  getActiveMultiplier,
  grantMultiplier,
  grantLevelRewards,
};
