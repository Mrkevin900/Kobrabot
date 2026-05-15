const { EMOJI_CONFIG, EMOJI_ALIASES } = require("../settings/mappings");

function normalizeEmojiString(emoji) {
  if (!emoji) return null;
  if (typeof emoji.toString === "function") return emoji.toString();
  if (emoji.id && emoji.name) {
    const prefix = emoji.animated ? "a" : "";
    return `<${prefix}:${emoji.name}:${emoji.id}>`;
  }
  return null;
}

function normName(name) {
  return String(name || "").toLowerCase();
}

function compactName(name) {
  return normName(name).replace(/[^a-z0-9]/g, "");
}

function isNameMatch(emojiName, searchName) {
  const e = normName(emojiName);
  const s = normName(searchName);
  if (!e || !s) return false;
  if (e === s || e.startsWith(`${s}_`) || e.includes(s)) return true;

  const ec = compactName(emojiName);
  const sc = compactName(searchName);
  if (!ec || !sc) return false;
  return ec === sc || ec.includes(sc) || sc.includes(ec);
}

function findFromCache(cache, searchName) {
  if (!cache?.size) return null;
  const sNorm = normName(searchName);
  const sCompact = compactName(searchName);

  let hit = cache.find((item) => normName(item?.name) === sNorm);
  if (hit) return hit;

  hit = cache.find((item) => compactName(item?.name) === sCompact);
  if (hit) return hit;

  return cache.find((item) => isNameMatch(item?.name, searchName)) || null;
}

function findAllFromCache(cache, searchName) {
  if (!cache?.size) return [];
  const sNorm = normName(searchName);
  const sCompact = compactName(searchName);

  const exact = [];
  const compact = [];
  const fuzzy = [];

  for (const item of cache.values()) {
    const n = normName(item?.name);
    if (!n) continue;
    if (n === sNorm) {
      exact.push(item);
      continue;
    }
    if (compactName(item?.name) === sCompact) {
      compact.push(item);
      continue;
    }
    if (isNameMatch(item?.name, searchName)) {
      fuzzy.push(item);
    }
  }

  return [...exact, ...compact, ...fuzzy];
}

function dedupeValues(values) {
  const out = [];
  const seen = new Set();
  for (const v of values) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function pickFirst(values) {
  const options = dedupeValues(values);
  return options[0] || null;
}

function resolveEmoji(client, key, fallback) {
  const keyRaw = String(key || "");
  const keyAlias = EMOJI_ALIASES[compactName(keyRaw)] || keyRaw;
  const configured = EMOJI_CONFIG[keyAlias] || EMOJI_CONFIG[keyRaw];
  const names = Array.from(new Set([...(configured?.names ?? []), keyRaw, keyAlias]));
  const resolvedFallback = fallback ?? configured?.fallback ?? "\u2753";
  const candidates = [];

  const appEmojiByName = client?.applicationEmojiByName;
  if (appEmojiByName?.size) {
    for (const name of names) {
      const direct = appEmojiByName.get(normName(name));
      if (direct) candidates.push(direct);

      const compact = appEmojiByName.get(compactName(name));
      if (compact) candidates.push(compact);

      const value = appEmojiByName.get(name);
      if (value) candidates.push(value);

      for (const [emojiName, emojiValue] of appEmojiByName.entries()) {
        if (isNameMatch(emojiName, name)) {
          candidates.push(emojiValue);
        }
      }
    }
  }

  // After app emojis, fallback to guild emojis.
  const guildCache = client?.emojis?.cache;
  if (guildCache?.size) {
    for (const name of names) {
      const all = findAllFromCache(guildCache, name);
      for (const emoji of all) {
        const value = normalizeEmojiString(emoji);
        if (value) candidates.push(value);
      }
    }
  }

  const picked = pickFirst(candidates);
  if (picked) return picked;

  return resolvedFallback;
}

function registerEmojiHelpers(client) {
  client.applicationEmojiByName = new Map();

  client.loadApplicationEmojis = async () => {
    try {
      if (!client.application?.emojis?.fetch && typeof client.application?.fetch === "function") {
        await client.application.fetch().catch(() => null);
      }
      const manager = client.application?.emojis;
      if (!manager?.fetch) return 0;

      const fetched = await manager.fetch();
      const byName = new Map();

      fetched.forEach((emoji) => {
        const asString = normalizeEmojiString(emoji);
        if (!asString || !emoji?.name) return;
        byName.set(emoji.name, asString);
        byName.set(normName(emoji.name), asString);
        byName.set(compactName(emoji.name), asString);
      });

      client.applicationEmojiByName = byName;
      return byName.size;
    } catch {
      return 0;
    }
  };

  client.emoji = (key, fallback) => resolveEmoji(client, key, fallback);
  client.mascot = (fallback) => resolveEmoji(client, "mascot", fallback);
}

module.exports = {
  resolveEmoji,
  registerEmojiHelpers,
};
