const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("fs");
const { dirname, join } = require("path");
const { AuditLogEvent, PermissionFlagsBits } = require("discord.js");

const STORE_PATH = join(__dirname, "..", "..", "Data", "security.json");
const TRUSTED_IDS = new Set(
  String(process.env.SECURITY_TRUSTED_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

const SECURITY_FEATURES = {
  antiraid: { key: "antiraid_", label: "Auto RaidMode" },
  antibot: { key: "bots_", label: "Anti-bot" },
  antispam: { key: "spam_", label: "Anti-spam" },
  antilien: { key: "link_", label: "Anti-lien" },
  antimassban: { key: "massbans_", label: "Anti-mass-ban" },
  antimasskick: { key: "masskick_", label: "Anti-mass-kick" },
  antimassmention: { key: "massping_", label: "Anti-masse-mention" },
  antiguildupdate: { key: "antiguildupdate_", label: "Anti-guild-update" },
  antichannel: { key: "channels_", label: "Anti-channel" },
  antiban: { key: "bans_", label: "Anti-ban" },
  antikick: { key: "kick_", label: "Anti-kick" },
  anticreainvite: { key: "anticreainvite_", label: "Anti-invite" },
  captcha: { key: "captcha_", label: "Captcha automatique" },
};

const auditTypes = {
  ban: AuditLogEvent.MemberBanAdd,
  kick: AuditLogEvent.MemberKick,
  channelCreate: AuditLogEvent.ChannelCreate,
  inviteCreate: AuditLogEvent.InviteCreate,
};

const CacheManager = require("./CacheManager");
let cache = null;
const counters = new CacheManager(60000);

function loadStore() {
  if (cache) return cache;
  try {
    cache = existsSync(STORE_PATH) ? JSON.parse(readFileSync(STORE_PATH, "utf8")) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function saveStore() {
  const fsPromises = require("fs").promises;
  fsPromises.mkdir(dirname(STORE_PATH), { recursive: true })
    .then(() => fsPromises.writeFile(STORE_PATH, JSON.stringify(loadStore(), null, 2)))
    .catch((err) => console.error("[SECURITY_UTILS] Erreur saveStore:", err));
}

function rawKey(key, guildId) {
  return `${key}${guildId}`;
}

function getFeatureKey(feature, guildId) {
  const def = SECURITY_FEATURES[feature];
  return def ? rawKey(def.key, guildId) : null;
}

function getValue(key) {
  return loadStore()[key] ?? null;
}

function setValue(key, value) {
  const store = loadStore();
  if (value === null || value === undefined || value === false) {
    delete store[key];
  } else {
    store[key] = value;
  }
  saveStore();
  return value;
}

function isFeatureEnabled(feature, guildId) {
  const key = getFeatureKey(feature, guildId);
  return key ? getValue(key) === true : false;
}

function setFeatureStatus(feature, guildId, enabled) {
  const key = getFeatureKey(feature, guildId);
  if (!key) return false;
  setValue(key, enabled ? true : null);
  return Boolean(enabled);
}

function applySecurityMode(guildId, mode) {
  if (mode === "off") {
    Object.keys(SECURITY_FEATURES).forEach((feature) => setFeatureStatus(feature, guildId, false));
    return "Securite globale desactivee";
  }

  if (mode === "on") {
    [
      "antibot",
      "antispam",
      "antilien",
      "antimassban",
      "antimasskick",
      "antimassmention",
      "antiguildupdate",
    ].forEach((feature) => setFeatureStatus(feature, guildId, true));
    ["antichannel", "antiban", "antikick", "anticreainvite", "captcha"].forEach((feature) =>
      setFeatureStatus(feature, guildId, false),
    );
    return "Mode securite active";
  }

  if (mode === "max") {
    Object.keys(SECURITY_FEATURES).forEach((feature) => setFeatureStatus(feature, guildId, true));
    return "Mode securite maximale active";
  }

  return "Mode inconnu";
}

function logSecurity(client, message, status = "AUTOMOD") {
  client?.getLogger?.()?.send?.(`[AUTOMOD] ${message}`, status);
}

function isTrustedExecutor(guild, executor, client) {
  if (!executor) return true;
  if (executor.id === client?.user?.id) return true;
  if (executor.id === guild.ownerId) return true;
  return TRUSTED_IDS.has(executor.id);
}

async function fetchAuditExecutor(guild, typeName, targetId) {
  const type = auditTypes[typeName];
  if (!guild || !type || !guild.members.me?.permissions?.has(PermissionFlagsBits.ViewAuditLog)) return null;

  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  const entry = logs?.entries?.find((item) => {
    const isFresh = Date.now() - item.createdTimestamp < 15000;
    const sameTarget = !targetId || item.target?.id === targetId;
    return isFresh && sameTarget;
  });
  return entry?.executor || null;
}

async function punishExecutor(client, guild, executor, reason) {
  if (!executor || isTrustedExecutor(guild, executor, client)) return false;
  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (!member) return false;

  if (member.bannable) {
    await member.ban({ reason }).catch(() => null);
    logSecurity(client, `${executor.tag || executor.id} banni: ${reason}`);
    return true;
  }

  if (member.kickable) {
    await member.kick(reason).catch(() => null);
    logSecurity(client, `${executor.tag || executor.id} kick: ${reason}`);
    return true;
  }

  logSecurity(client, `Sanction impossible pour ${executor.tag || executor.id}: permissions insuffisantes`, "WARN");
  return false;
}

function bumpCounter(scope, guildId, userId, windowMs = 10000) {
  const key = `${scope}:${guildId}:${userId}`;
  const now = Date.now();
  const current = counters.get(key) || [];
  const fresh = current.filter((ts) => now - ts < windowMs);
  fresh.push(now);
  counters.set(key, fresh, windowMs);
  return fresh.length;
}

module.exports = {
  SECURITY_FEATURES,
  applySecurityMode,
  bumpCounter,
  fetchAuditExecutor,
  getValue,
  isFeatureEnabled,
  logSecurity,
  punishExecutor,
  rawKey,
  setFeatureStatus,
  setValue,
};
