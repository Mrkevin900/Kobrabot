const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const { getDatabase } = require("../database/database");
const {
  getSuggestionChannelId,
  publishSuggestion,
} = require("../utils/suggestions");
const {
  bumpCounter,
  isFeatureEnabled,
  logSecurity,
} = require("../utils/SecurityUtils");

function safeSend(l, ...args) {
  if (l && typeof l.send === "function") l.send(...args);
}

const LEVELUP_GIF_URL =
  "https://raw.githubusercontent.com/KB-RolePlay/assets/main/discord-stickers/clyde-bot/congratulations/sticker.gif";



function hasBlockedLink(content) {
  return /(discord\.gg|discord\.com\/invite|https?:\/\/|www\.)/i.test(String(content || ""));
}

async function purgeRecentUserMessages(message, reason) {
  const channel = message.channel;
  if (!channel?.messages?.fetch) {
    await message.delete().catch(() => null);
    return 1;
  }

  const limit = Math.max(1, Math.min(100, Number(process.env.AUTOMOD_PURGE_LIMIT) || 50));
  const fetched = await channel.messages.fetch({ limit }).catch(() => null);
  if (!fetched) {
    await message.delete().catch(() => null);
    return 1;
  }

  const maxAge = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const targets = fetched.filter(
    (msg) =>
      msg.author?.id === message.author.id &&
      msg.deletable !== false &&
      msg.createdTimestamp > maxAge,
  );

  if (targets.size === 0) {
    await message.delete().catch(() => null);
    return 1;
  }

  if (targets.size === 1) {
    await targets.first().delete(reason).catch(() => null);
    return 1;
  }

  await channel.bulkDelete(targets, true).catch(async () => {
    const promises = [];
    for (const msg of targets.values()) {
      promises.push(msg.delete(reason).catch(() => null));
    }
    await Promise.all(promises);
  });

  return targets.size;
}

// moderateSecurityMessage removed in favor of Native Discord AutoMod

function resolveLevelChannel(guild, fallbackChannel) {
  const levelChannelId = process.env.LEVEL_CHANNEL_ID || process.env.RANKUPS_CHANNEL_ID || "";

  if (levelChannelId) {
    const channel = guild.channels.cache.get(levelChannelId);
    if (channel && channel.isTextBased()) {
      return channel;
    }
  }

  return fallbackChannel;
}

function isTicketChannel(message) {
  return (
    message && message.channel && message.channel.type === ChannelType.GuildText &&
    typeof message.channel.topic === "string" &&
    message.channel.topic.includes("User:")
  );
}

function parseTicketOwnerId(topic) {
  const match = (topic || "").match(/User:\s*(\d{16,20})/i);
  return match ? match[1] : null;
}

function parseTicketDmMirror(topic) {
  const match = (topic || "").match(/DmMirror:\s*(on|off)/i);
  if (!match) return true;
  return match[1].toLowerCase() === "on";
}

function parseTopicField(topic, field) {
  const match = String(topic || "").match(new RegExp(`${field}:\\s*([^|]+)`, "i"));
  return match ? match[1].trim() : null;
}

function parseTicketLogThreadId(topic) {
  const value = parseTopicField(topic, "LogThread");
  if (!value || value.toLowerCase() === "none") return null;
  return /^\d{16,20}$/.test(value) ? value : null;
}

function parseTicketType(topic) {
  const value = parseTopicField(topic, "Type");
  return (value || "autres").toLowerCase();
}

function parseTicketNumberFromName(channelName) {
  const m = String(channelName || "").match(/(\d{6,})$/);
  return m ? m[1].slice(-6) : "000000";
}

function formatTicketCode(ticketNumber) {
  const raw = String(ticketNumber || "").replace(/\D/g, "");
  return `TK-${raw.slice(-6).padStart(6, "0")}`;
}

async function ensureTicketLogThread(client, message) {
  if (!isTicketChannel(message)) return null;
  const logChannelId = process.env.TICKET_LOG_CHANNEL_ID;
  if (!logChannelId || !(message.guild && message.guild.channels && typeof message.guild.channels.fetch === "function")) return null;

  const logChannel = await message.guild.channels.fetch(logChannelId).catch(() => null);
  if (!logChannel?.isTextBased?.()) return null;
  if (!(logChannel && logChannel.isTextBased && logChannel.isTextBased())) return null;

  const topic = message.channel.topic || "";
  const existingId = parseTicketLogThreadId(topic);
  if (existingId && logChannel.threads?.fetch) {
    const existingThread = await logChannel.threads.fetch(existingId).catch(() => null);
    if (existingThread) return { logChannel, thread: existingThread };
  }

  const ticketType = parseTicketType(topic);
  const ticketNumber = parseTicketNumberFromName(message.channel.name);
  const code = formatTicketCode(ticketNumber);
  const starterEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Journal ${code}`)
    .setDescription(
      `Ticket: ${message.channel}\nType: ${ticketType}\nAuteur: <@${parseTicketOwnerId(topic) || "unknown"}>`,
    )
    .setTimestamp();

  const starter = await logChannel.send({ embeds: [starterEmbed] }).catch(() => null);
  if (!(starter && typeof starter.startThread === 'function')) return null;
  const thread = await starter
    .startThread({
      name: `log-${message.channel.name}`.slice(0, 100),
      autoArchiveDuration: 1440,
      reason: `Journal ticket ${code}`,
    })
    .catch(() => null);
  if (!thread) return null;

  const updatedTopic = topic.match(/LogThread:\s*[^|]+/i)
    ? topic.replace(/LogThread:\s*[^|]+/i, `LogThread: ${thread.id}`)
    : `${topic} | LogThread: ${thread.id}`;
  await message.channel.setTopic(updatedTopic.slice(0, 1024)).catch(() => {});

  return { logChannel, thread };
}

async function ensureTicketLogWebhook(logChannel) {
  if (!logChannel) return null;
  const hooks = await logChannel.fetchWebhooks().catch(() => null);
  if (!hooks) return null;
  const existing = hooks.find((h) => h.name === "KobraBot Ticket Relay");
  if (existing) return existing;
  return logChannel.createWebhook({ name: "KobraBot Ticket Relay" }).catch(() => null);
}

async function mirrorTicketMessageToLogThread(client, message) {
  if (!isTicketChannel(message)) return;
  if (message.author && message.author.bot) return;
  if (message.webhookId) return;

  const text = (message.content || "").trim();
  const attachmentUrls = (message.attachments && message.attachments.values)
    ? [...message.attachments.values()].map((a) => a.url).filter(Boolean)
    : [];
  if (!text && attachmentUrls.length === 0) return;

  const linkEmbed = new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle(`Mise a jour ticket #${message.channel.name}`)
    .addFields(
      { name: "Auteur", value: `${message.author.tag} (${message.author.id})`, inline: false },
      { name: "Lien", value: message.url, inline: false },
    )
    .setTimestamp();

  if (attachmentUrls.length > 0) {
    linkEmbed.addFields({
      name: "Pieces jointes",
      value: attachmentUrls.join("\n").slice(0, 1024),
      inline: false,
    });
  }

  const target = await ensureTicketLogThread(client, message);
  if (!(target && target.thread) || !target.logChannel) return;
  const webhook = await ensureTicketLogWebhook(target.logChannel);
  if (!webhook) return;

  await webhook
    .send({
      threadId: target.thread.id,
      username: (message.member && message.member.displayName) || message.author.username,
      avatarURL: message.author.displayAvatarURL({ extension: "png", size: 256 }),
      content: text || "(Message sans texte)",
      embeds: [linkEmbed],
      allowedMentions: { parse: [] },
    })
    .catch(() => {});
}

async function mirrorTicketMessageToOwner(client, message) {
  if (!isTicketChannel(message)) return;

  const ownerId = parseTicketOwnerId(message.channel.topic);
  if (!ownerId) return;
  if (!parseTicketDmMirror(message.channel.topic)) return;
  if (message.author.id === ownerId) return;

  const owner = await client.users.fetch(ownerId).catch(() => null);
  if (!owner) return;

  const text = (message.content || "").trim();
  const attachmentUrls = (message.attachments && message.attachments.values)
    ? [...message.attachments.values()].map((a) => a.url).filter(Boolean)
    : [];

  if (!text && attachmentUrls.length === 0) return;

  const embed = new EmbedBuilder()
    .setColor(0x2563eb)
    .setTitle(`Mise a jour ticket #${message.channel.name}`)
    .setDescription(text || "(Message sans texte)")
    .addFields(
      { name: "Auteur", value: `${message.author.tag} (${message.author.id})`, inline: false },
      { name: "Lien", value: message.url, inline: false },
    )
    .setTimestamp();

  if (attachmentUrls.length > 0) {
    embed.addFields({
      name: "Pieces jointes",
      value: attachmentUrls.join("\n").slice(0, 1024),
      inline: false,
    });
  }

  await owner.send({ embeds: [embed] }).catch(() => {});
}

async function handleSuggestionMessage(client, message) {
  const suggestionChannelId = getSuggestionChannelId();
  if (!suggestionChannelId) return false;
  if (message.channelId !== suggestionChannelId) return false;
  if (!(message.channel && message.channel.isTextBased && message.channel.isTextBased())) return false;

  const firstAttachment = (message.attachments && message.attachments.values)
    ? [...message.attachments.values()][0] || null
    : null;
  const result = await publishSuggestion(client, {
    guild: message.guild,
    channel: message.channel,
    author: message.member || message.author,
    content: message.content || "",
    attachment: firstAttachment,
    sourceMessageId: message.id,
  });

  if (!result.ok) {
    safeSend(client.getLogger && client.getLogger(), `[SUGGEST] Echec publication auto: ${result.error}`, "WARN");
    return false;
  }

  await message.delete().catch((error) => {
    safeSend(client.getLogger && client.getLogger(), `[SUGGEST] Message source non supprime: ${error.message}`, "WARN");
  });
  return true;
}

const messageCreate = {
  async executeHandler(client, message) {
    if (!message || !message.guild || !message.author) return;
    if (message.author.bot) return;

    // L'AutoMod est maintenant géré nativement par Discord (voir AutoModManager)

    if (await handleSuggestionMessage(client, message)) {
      return;
    }

    // [OPTIMISATION] Desactive a la demande de l'utilisateur pour eviter les spams de requetes/logs
    // await mirrorTicketMessageToOwner(client, message);
    // await mirrorTicketMessageToLogThread(client, message);

    if (!message.content || message.content.trim().length < 2) return;

    try {
      await client.progressionManager.handleMessage(message);
    } catch (error) {
      safeSend(client.getLogger && client.getLogger(), `[LEVEL] Erreur progression: ${error.message}`, "ERROR");
    }
  },

  settings: {
    enabled: true,
  },
};

module.exports = { default: messageCreate };



