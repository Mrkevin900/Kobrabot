const { getDatabase } = require("../database/database");
const { addXp, getRank, xpForLevel } = require("./levelSystem");
const { getActiveMultiplier, grantLevelRewards } = require("./levelRewards");
const { buildLevelUpCard } = require("./cards");
const { EmbedBuilder } = require("discord.js");

const LEVELUP_GIF_URL = "https://raw.githubusercontent.com/KB-RolePlay/assets/main/discord-stickers/clyde-bot/congratulations/sticker.gif";

const CacheManager = require("./CacheManager");
const xpBuffer = new Map();
const multiplierCache = new CacheManager(60000);

function getBufferKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

async function getCachedMultiplier(db, guildId, userId) {
  const key = getBufferKey(guildId, userId);
  
  if (multiplierCache.has(key)) {
    return multiplierCache.get(key);
  }

  const multiplier = await getActiveMultiplier(db, guildId, userId);
  multiplierCache.set(key, multiplier, 60000); // Cache 1 minute
  return multiplier;
}

function queueXp(guildId, userId, amount) {
  const key = getBufferKey(guildId, userId);
  const current = xpBuffer.get(key) || 0;
  xpBuffer.set(key, current + amount);
}

function startXpFlusher(client) {
  setInterval(async () => {
    if (xpBuffer.size === 0) return;
    
    const db = getDatabase();
    if (!db) return;

    // Create a copy and clear the buffer to allow new XP while processing
    const entries = Array.from(xpBuffer.entries());
    xpBuffer.clear();

    const promises = entries.map(async ([key, amount]) => {
      const [guildId, userId] = key.split(':');
      try {
        const result = await addXp(db, guildId, userId, amount, 0, { ignoreCooldown: true });
        
        if (result.changed && result.leveledUp) {
          await handleLevelUp(client, db, guildId, userId, result);
        }
      } catch (error) {
        client.getLogger()?.send(`[XP_BUFFER] Erreur update ${userId}: ${error.message}`, "ERROR");
      }
    });

    await Promise.all(promises);
  }, 10000).unref?.(); // Flush every 10 seconds
}

function resolveLevelChannel(guild) {
  const levelChannelId = process.env.LEVEL_CHANNEL_ID || process.env.RANKUPS_CHANNEL_ID || "";
  if (!levelChannelId) return null;
  const channel = guild.channels.cache.get(levelChannelId);
  if (channel && channel.isTextBased()) return channel;
  return null;
}

async function handleLevelUp(client, db, guildId, userId, result) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const profile = result.profile;
  const levelsGained = Math.max(0, profile.level - (result.previousLevel || profile.level));
  const reward = await grantLevelRewards(db, guildId, userId, levelsGained);
  
  const currentBase = xpForLevel(profile.level);
  const nextBase = xpForLevel(profile.level + 1);
  const progress = profile.xp - currentBase;
  const needed = Math.max(1, nextBase - currentBase);
  const rank = await getRank(db, guildId, profile.xp);

  // Generer la carte sans bloquer l'Event Loop principal (execution differee)
  setTimeout(async () => {
    try {
      const card = await buildLevelUpCard({
        member,
        level: profile.level,
        xp: profile.xp,
        rank,
        progress,
        needed,
      });

      const embed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("Nouveau niveau")
        .setDescription(
          `${member.user} passe niveau **${profile.level}**\n` +
            `Recompense: **+${reward.awarded} point(s)** boutique`
        )
        .setThumbnail(LEVELUP_GIF_URL)
        .setImage("attachment://levelup-card.png")
        .setTimestamp();

      const targetChannel = resolveLevelChannel(guild);
      if (targetChannel) {
        await targetChannel.send({ content: `<@${userId}>`, embeds: [embed], files: [card] }).catch(() => {});
      }
      
      client.getLogger()?.send(`[LEVEL] ${member.user.tag} est passe niveau ${profile.level}`, "READY");
    } catch (err) {
      client.getLogger()?.send(`[LEVEL] Erreur generation carte pour ${userId}: ${err.message}`, "ERROR");
    }
  }, 100);
}

module.exports = { queueXp, startXpFlusher, getCachedMultiplier };

