const {
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

const {
  getDatabase,
  ensureDatabaseConnection,
  describeDbError,
} = require("../database/database");
const { buildLevelUpCard } = require("../utils/cards");
const { getGuildTriggers: getGuildTriggersFromDb } = require("../utils/vocalTriggers");
const { getPanel, upsertPanel, deletePanel } = require("../utils/vocalPanels");

const voiceSessions = new Map();
const LEVELUP_GIF_URL =
  "https://raw.githubusercontent.com/KB-RolePlay/assets/main/discord-stickers/clyde-bot/congratulations/sticker.gif";

function sessionKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function resolveLevelChannel(guild) {
  const levelChannelId =
    process.env.LEVEL_CHANNEL_ID ||
    process.env.RANKUPS_CHANNEL_ID ||
    "";

  if (!levelChannelId) return null;
  const channel = guild.channels.cache.get(levelChannelId);
  if (channel && channel.isTextBased()) return channel;
  return null;
}

function readTriggers(store, guildId) {
  if (!store || typeof store.get !== "function") return [];
  const raw = store.get("vocalTriggers");
  if (!Array.isArray(raw)) return [];
  return raw.filter((t) => t && t.guildId === guildId && t.channelId);
}

function ensureRuntimeStore(client) {
  if (!client.cache) {
    const CacheManager = require("../utils/CacheManager");
    client.cache = new CacheManager();
  }
  return client.cache;
}

function isUnknownChannelError(err) {
  if (!err) return false;
  if (err.code === 10003) return true;
  if (err && err.rawError && err.rawError.code === 10003) return true;
  return String(err.message || "").toLowerCase().includes("unknown channel");
}

function ensureTempVocalDefaults(entry) {
  if (!entry || typeof entry !== "object") return entry;
  if (!Array.isArray(entry.whitelist)) entry.whitelist = [];
  if (!Array.isArray(entry.blacklist)) entry.blacklist = [];
  if (!Array.isArray(entry.savedLists)) entry.savedLists = [null, null, null, null];
  if (typeof entry.restrictMic !== "boolean") entry.restrictMic = false;
  if (typeof entry.restrictVideo !== "boolean") entry.restrictVideo = false;
  if (!entry.mode) entry.mode = "public";
  return entry;
}

function formatList(guild, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return "Aucun";
  const list = ids
    .slice(0, 8)
    .map((id) => {
      const m = guild.members.cache.get(id);
      return m ? m.toString() : `<@${id}>`;
    })
    .join(", ");
  return ids.length > 8 ? `${list}...` : list;
}

function buildSlotLabel(slot) {
  if (!slot || !Array.isArray(slot.whitelist) || !Array.isArray(slot.blacklist)) {
    return "Emplacement vide";
  }
  return `W:${slot.whitelist.length} B:${slot.blacklist.length}`;
}

function buildVocalPanelEmbed(client, guild, member, entry) {
  function safeEmoji(c, name, def) {
    if (c && typeof c.emoji === 'function') return c.emoji(name, def);
    return def;
  }

  const eTitle = safeEmoji(client, "pointred", "\u{1F534}");
  const eHint = safeEmoji(client, "diams", "\u{1F48E}");
  const eLock = safeEmoji(client, "lock", "\u{1F512}");
  const ePrivate = safeEmoji(client, "sound", "\u{1F509}");
  const ePublic = safeEmoji(client, "loud_sound", "\u{1F50A}");
  const eTransfer = safeEmoji(client, "kb_legend", "\u{1F451}");
  const eWhitelist = safeEmoji(client, "kiss~1", "\u{1F48B}");
  const eBlacklist = safeEmoji(client, "delivery", "\u{1F69A}");
  const ePurge = safeEmoji(client, "purge", "\u{23CF}");
  const eMic = safeEmoji(client, "camera~1", "\u{1F3A4}");
  const eVideo = safeEmoji(client, "hacker", "\u{1F4BB}");
  return new EmbedBuilder()
    .setTitle(`${eTitle} Configuration du salon`)
    .setDescription(
      `${eHint} **Astuce** : vous pouvez personnaliser ton salon avec les boutons ci-dessous.`,
    )
    .addFields(
      {
        name: `${eLock} Ferme`,
        value: "Personne ne peut rejoindre le salon.",
      },
      {
        name: `${ePrivate} Prive`,
        value: "Salon visible, mais bloque aux membres non autorises.",
      },
      {
        name: `${ePublic} Public`,
        value: "Tout le monde peut rejoindre le salon.",
      },
      {
        name: `${eTransfer} Transferer la propriete`,
        value: "Donne la propriete du salon a un membre du vocal.",
      },
      {
        name: `${eWhitelist} Whitelist`,
        value: formatList(guild, entry.whitelist),
        inline: true,
      },
      {
        name: `${eBlacklist} Blacklist`,
        value: formatList(guild, entry.blacklist),
        inline: true,
      },
      {
        name: `${ePurge} Purger`,
        value: "Expulse les membres non whitelistes.",
      },
      {
        name: `${eMic} Permission micro`,
        value: entry.restrictMic
          ? "Actif: les non-whitelistes sont muets."
          : "Inactif: tout le monde peut parler.",
        inline: true,
      },
      {
        name: `${eVideo} Permission video`,
        value: entry.restrictVideo
          ? "Actif: les non-whitelistes ne peuvent pas lancer leur camera."
          : "Inactif: video autorisee.",
        inline: true,
      },
    )
    .setColor(0x9b59b6)
    .setImage("attachment://vocal_banner.png")
    .setFooter({ text: `${member.user.username} | Systeme Vocal` })
    .setTimestamp();
}

function buildVocalRows(client, channelId, ownerId, entry) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vocalbtn_lock_${channelId}_${ownerId}`)
      .setEmoji((client && typeof client.emoji === 'function') ? client.emoji("lock", "\u{1F512}") : "\u{1F512}")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`vocalbtn_private_${channelId}_${ownerId}`)
      .setEmoji((client && typeof client.emoji === 'function') ? client.emoji("sound", "\u{1F509}") : "\u{1F509}")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`vocalbtn_public_${channelId}_${ownerId}`)
      .setEmoji((client && typeof client.emoji === 'function') ? client.emoji("loud_sound", "\u{1F50A}") : "\u{1F50A}")
      .setStyle(ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vocalbtn_transfer_${channelId}_${ownerId}`)
      .setEmoji((client && typeof client.emoji === 'function') ? client.emoji("kb_legend", "\u{1F451}") : "\u{1F451}")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`vocalbtn_whitelist_${channelId}_${ownerId}`)
      .setEmoji((client && typeof client.emoji === 'function') ? client.emoji("kiss~1", "\u{1F48B}") : "\u{1F48B}")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`vocalbtn_blacklist_${channelId}_${ownerId}`)
      .setEmoji((client && typeof client.emoji === 'function') ? client.emoji("delivery", "\u{1F69A}") : "\u{1F69A}")
      .setStyle(ButtonStyle.Danger),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vocalbtn_purge_${channelId}_${ownerId}`)
      .setEmoji((client && typeof client.emoji === 'function') ? client.emoji("purge", "\u{23CF}") : "\u{23CF}")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`vocalbtn_mic_${channelId}_${ownerId}`)
      .setEmoji((client && typeof client.emoji === 'function') ? client.emoji("camera~1", "\u{1F3A4}") : "\u{1F3A4}")
      .setStyle(entry.restrictMic ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`vocalbtn_video_${channelId}_${ownerId}`)
      .setEmoji((client && typeof client.emoji === 'function') ? client.emoji("hacker", "\u{1F3A5}") : "\u{1F3A5}")
      .setStyle(entry.restrictVideo ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  const listMenu = new StringSelectMenuBuilder()
    .setCustomId(`vocal_lists_${channelId}_${ownerId}`)
    .setPlaceholder("Vos listes sauvegardees")
    .addOptions([
      {
        label: "Sauvegarder l'etat actuel des listes",
        value: "save_current",
      },
      {
        label: buildSlotLabel(entry.savedLists?.[0]),
        value: "slot_1",
      },
      {
        label: buildSlotLabel(entry.savedLists?.[1]),
        value: "slot_2",
      },
      {
        label: buildSlotLabel(entry.savedLists?.[2]),
        value: "slot_3",
      },
      {
        label: buildSlotLabel(entry.savedLists?.[3]),
        value: "slot_4",
      },
    ]);

  const row4 = new ActionRowBuilder().addComponents(listMenu);
  return [row1, row2, row3, row4];
}

async function persistTempVocal(client, entry) {
  const db = (await ensureDatabaseConnection(client)) || getDatabase();
  if (!db) return false;
  try {
    await upsertPanel(db, entry);
    return true;
  } catch (err) {
    client
      .getLogger()
      ?.send(`[VOCAL] Erreur save panel DB: ${describeDbError(err)}`, "WARN");
    return false;
  }
}

async function removePersistedTempVocal(client, guildId, channelId) {
  const db = (await ensureDatabaseConnection(client)) || getDatabase();
  if (!db) return false;
  try {
    await deletePanel(db, guildId, channelId);
    return true;
  } catch (err) {
    client
      .getLogger()
      ?.send(`[VOCAL] Erreur delete panel DB: ${describeDbError(err)}`, "WARN");
    return false;
  }
}

async function readTriggersForGuild(client, guildId) {
  const sqlDb = (await ensureDatabaseConnection(client)) || getDatabase();
  if (sqlDb) {
    try {
      return await getGuildTriggersFromDb(sqlDb, guildId);
    } catch (err) {
      client
        .getLogger()
        ?.send(`[VOCAL] Erreur lecture triggers DB: ${describeDbError(err)}`, "WARN");
    }
  }

  const runtimeStore = ensureRuntimeStore(client);
  return readTriggers(runtimeStore, guildId);
}



let cleanupInterval = null;

const VoiceStateUpdate = {
  async executeHandler(client, oldState, newState) {
    // [OPTIMISATION] Nettoyage periodique des sessions vocales fantomes
    if (!cleanupInterval) {
      cleanupInterval = setInterval(() => {
        for (const [key, startedAt] of voiceSessions.entries()) {
          const [guildId, userId] = key.split(':');
          const guild = client.guilds.cache.get(guildId);
          const member = guild?.members.cache.get(userId);
          
          if (!guild || !member || !member.voice?.channelId) {
            voiceSessions.delete(key);
          }
        }
      }, 60 * 60 * 1000).unref?.(); // Toutes les heures
    }

    const member = newState.member || oldState.member;
    const guild = newState.guild || oldState.guild;



    if (!member || !guild) {
      return;
    }

    const runtimeStore = ensureRuntimeStore(client);
    const triggers = await readTriggersForGuild(client, guild.id);
    if (triggers.length === 0) return;

    const triggerIds = triggers.map((t) => t.channelId);
    const joinedChannel =
      newState.channel ||
      (newState.channelId
        ? await guild.channels.fetch(newState.channelId).catch(() => null)
        : null);

    if (
      joinedChannel &&
      triggerIds.includes(newState.channelId) &&
      oldState.channelId !== newState.channelId
    ) {
      try {
        const everyoneRole = guild.roles?.everyone;
        const triggerPerms = everyoneRole ? joinedChannel.permissionsFor(everyoneRole) : null;
        const isPublicTrigger = Boolean(
          triggerPerms &&
            triggerPerms.has(PermissionFlagsBits.ViewChannel) &&
            triggerPerms.has(PermissionFlagsBits.Connect),
        );

        client
          .getLogger()
          ?.send(
            `[VOCAL] Trigger detecte pour ${member.user.username} (${newState.channelId})`,
            "DEBUG",
          );

        const privateChannel = await guild.channels.create({
          name: `\uD83D\uDD0A ${member.user.username}`,
          type: ChannelType.GuildVoice,
          parent: joinedChannel.parentId || null,
          userLimit: joinedChannel.userLimit || 0,
          permissionOverwrites: [
            {
              id: guild.id,
              ...(isPublicTrigger
                ? {
                    allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
                  }
                : {
                    deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
                  }),
            },
            {
              id: guild.members.me?.id || client.user?.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.ManageChannels,
              ],
            },
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
              ],
            },
          ],
        });

        if (!runtimeStore.has("tempVocals")) runtimeStore.set("tempVocals", []);
        const tempVocals = runtimeStore.get("tempVocals");
        tempVocals.push({
          channelId: privateChannel.id,
          ownerId: member.id,
          guildId: guild.id,
          mode: isPublicTrigger ? "public" : "private",
          whitelist: [],
          blacklist: [],
          restrictMic: false,
          restrictVideo: false,
          savedLists: [null, null, null, null],
          createdAt: Date.now(),
        });
        runtimeStore.set("tempVocals", tempVocals);
        const createdEntry = tempVocals.find((v) => v.channelId === privateChannel.id);
        if (createdEntry) {
          await persistTempVocal(client, createdEntry);
        }

        let moved = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await member.voice.setChannel(privateChannel, "Creation vocal temporaire");
            moved = true;
            break;
          } catch (moveErr) {
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 300));
            } else {
              throw moveErr;
            }
          }
        }

        const entry = ensureTempVocalDefaults(
          tempVocals.find((v) => v.channelId === privateChannel.id),
        );
        const embed = buildVocalPanelEmbed(client, guild, member, entry);
        const rows = buildVocalRows(client, privateChannel.id, member.id, entry);

        if (isPublicTrigger && privateChannel && typeof privateChannel.send === "function") {
          const path = require("path");
          const { AttachmentBuilder } = require("discord.js");
          const bannerPath = path.join(__dirname, "../assets/vocal_banner.png");
          const file = new AttachmentBuilder(bannerPath, { name: "vocal_banner.png" });
          await privateChannel
            .send({
              content: `<@${member.id}>`,
              embeds: [embed],
              components: rows,
              files: [file],
            })
            .catch((panelErr) => {
              client
                .getLogger()
                ?.send(`[VOCAL] Panel non envoye: ${panelErr.message}`, "WARN");
            });
        } else if (!isPublicTrigger) {
          client.getLogger()?.send("[VOCAL] Panel ignore: salon temporaire prive", "DEBUG");
        }

        client
          .getLogger()
          ?.send(
            `[VOCAL] Salon temporaire cree pour ${member.user.username} (move=${moved})`,
            "INFO",
          );
      } catch (err) {
        client.getLogger()?.send(`[VOCAL] Erreur creation: ${err.message}`, "ERROR");
        if (err?.stack) {
          client.getLogger()?.send(err.stack, "DEBUG");
        }
      }
    }

    if (oldState.channelId && oldState.channel?.members.size === 0) {
      const tempVocals = runtimeStore.has("tempVocals") ? runtimeStore.get("tempVocals") : [];
      const tempVocal = Array.isArray(tempVocals)
        ? tempVocals.find((v) => v.channelId === oldState.channelId)
        : null;
      let persistedTemp = null;
      if (!tempVocal) {
        const db = getDatabase();
        if (db) {
          persistedTemp = await getPanel(db, guild.id, oldState.channelId).catch(() => null);
        }
      }

      if (tempVocal || persistedTemp) {
        const channelToDelete = oldState.channel;
        if (!channelToDelete) {
          await removePersistedTempVocal(client, guild.id, oldState.channelId);
          if (Array.isArray(tempVocals)) {
            const updatedVocals = tempVocals.filter((v) => v.channelId !== oldState.channelId);
            runtimeStore.set("tempVocals", updatedVocals);
          }
          return;
        }

        try {
          const deletedChannelId = channelToDelete.id;
          const deletedChannelName = channelToDelete.name;

          await channelToDelete.delete("Salon temporaire vide");

          if (Array.isArray(tempVocals)) {
            const updatedVocals = tempVocals.filter((v) => v.channelId !== deletedChannelId);
            runtimeStore.set("tempVocals", updatedVocals);
          }
          await removePersistedTempVocal(client, guild.id, deletedChannelId);

          client
            .getLogger()
            ?.send(`[VOCAL] Salon temporaire supprime: ${deletedChannelName}`, "INFO");
        } catch (err) {
          const deletedChannelId = channelToDelete.id;

          if (Array.isArray(tempVocals)) {
            const updatedVocals = tempVocals.filter((v) => v.channelId !== deletedChannelId);
            runtimeStore.set("tempVocals", updatedVocals);
          }
          await removePersistedTempVocal(client, guild.id, deletedChannelId);

          if (isUnknownChannelError(err)) {
            client
              .getLogger()
              ?.send(`[VOCAL] Salon deja supprime (ignore): ${deletedChannelId}`, "DEBUG");
          } else {
            client.getLogger()?.send(`[VOCAL] Erreur suppression: ${err.message}`, "ERROR");
            if (err?.stack) {
              client.getLogger()?.send(err.stack, "DEBUG");
            }
          }
        }
      }
    }
  },

  settings: {
    enabled: true,
  },
};

module.exports = { default: VoiceStateUpdate };


