const { EmbedBuilder, ChannelType, AttachmentBuilder } = require("discord.js");
const { getDatabase } = require("../database/database");
const {
  DEFAULT_STAFF_BOARD,
  normalizeHexColor,
  toColorInt,
  ensureStaffupdateColumns,
} = require("../utils/staffBoardConfig");

function parseJsonArray(raw) {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseMemberIdMap() {
  const raw = process.env.STAFF_MEMBER_ID_MAP_JSON || "";
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!k || !v) continue;
      out[String(k)] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

function didRolesChange(oldMember, newMember) {
  const oldRoles = oldMember && oldMember.roles && oldMember.roles.cache;
  const newRoles = newMember && newMember.roles && newMember.roles.cache;
  if (!oldRoles || !newRoles) return true;
  if (oldRoles.size !== newRoles.size) return true;
  for (const roleId of oldRoles.keys()) {
    if (!newRoles.has(roleId)) return true;
  }
  return false;
}

function policeEmoji(client) {
  if (client && typeof client.emoji === 'function') return client.emoji("police", ":police:");
  return ":police:";
}

function briefcaseEmoji(client) {
  if (client && typeof client.emoji === 'function') return client.emoji("briefcase", ":briefcase~1:");
  return ":briefcase~1:";
}

function autoSectionEmoji(client, staffType) {
  const norm = String(staffType || "").toLowerCase();
  if (norm.includes("staff") || norm.includes("commis") || norm.includes("moderateur")) {
    return policeEmoji(client);
  }
  if (norm.includes("famille") || norm.includes("membre")) {
    return briefcaseEmoji(client);
  }
  return policeEmoji(client);
}

function autoRoleEmoji(client, roleName) {
  const norm = String(roleName || "").toLowerCase();
  if (
    norm.includes("moderateur") ||
    norm.includes("commissaire") ||
    norm.includes("commisaire") ||
    norm.includes("commisere")
  ) {
    return policeEmoji(client);
  }
  return briefcaseEmoji(client);
}

function resolveMaskedId(member, idMap) {
  const mapped = idMap[String(member.id)];
  if (mapped) return mapped;

  const candidates = [
    member.nickname,
    member.displayName,
    member.user && member.user.globalName,
    member.user && member.user.username,
  ]
    .filter(Boolean)
    .map((v) => String(v));

  for (const value of candidates) {
    const m = value.match(/\b\d{17}\b/);
    if (m) return m[0];
  }

  return member.id;
}

function buildMembersForConfig(client, guild, config, idMap) {
  const roleIds = parseJsonArray(config.role_id);
  const excludedRoleIds = parseJsonArray(config.filter_role);
  const includeRoles = roleIds.map((id) => guild.roles.cache.get(id)).filter(Boolean);
  const excluded = new Set(excludedRoleIds);

  const membersMap = new Map();
  for (const role of includeRoles) {
    for (const [memberId, member] of role.members) {
      membersMap.set(memberId, member);
    }
  }

  const sortedMembers = [...membersMap.values()].sort(
    (a, b) => b.roles.highest.position - a.roles.highest.position,
  );

  if (includeRoles.length === 0) return ["• Aucun role surveille valide."];
  if (sortedMembers.length === 0) return ["• Aucun membre visible."];

  return sortedMembers.map((member) => {
    const topVisible = [...member.roles.cache.values()]
      .filter((role) => role.id !== guild.id && !excluded.has(role.id))
      .sort((a, b) => b.position - a.position)[0];

    const baseName = member.displayName || (member.user && member.user.username) || member.id;
    const roleEmoji = String(config.role_emoji || "").trim() || autoRoleEmoji(client, (topVisible && topVisible.name) || "");
    const topLabel = (topVisible && topVisible.name) ? ` (${roleEmoji} - ${topVisible.name})` : "";
    const maskedId = resolveMaskedId(member, idMap);
    return `**${baseName}** [||${maskedId}||]${topLabel}.`;
  });
}

function clampDescription(text, max = 3900) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 4)}\n...`;
}

async function upsertStaffBoardMessage(client, channel, embed, marker) {
  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);

  if (!messages) {
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    return;
  }

  const legacyMarker = `STAFFBOARD:${channel.guild && channel.guild.id}:${channel.id}`;
  const existing = messages.find((msg) => {
    if (msg.author?.id !== client.user?.id) return false;
    const footerText = String(msg.embeds?.[0]?.footer?.text || "");
    return footerText.includes(marker) || footerText.includes(legacyMarker);
  });

  if (existing) {
    await existing.edit({ embeds: [embed], allowedMentions: { parse: [] } });
    return;
  }

  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function refreshStaffEmbeds(client, guild) {
  const log = client.getLogger && client.getLogger();
  function safeSend(l, ...args) {
    if (l && typeof l.send === "function") l.send(...args);
  }
  const db = getDatabase();
  if (!db) return;

  try {
    await ensureStaffupdateColumns(db);
    } catch (error) {
    safeSend(log, `[STAFFUPDATE] Migration colonnes staffupdate impossible: ${error.message}`, "WARN");
  }

  let configs = [];
  try {
    configs = await db("staffupdate").where({ guild: guild.id }).orderBy("id", "asc");
  } catch (error) {
    safeSend(log, `[STAFFUPDATE] Erreur SQL lecture staffupdate: ${error.message}`, "ERROR");
    return;
  }

  if (!configs || configs.length === 0) return;

  const idMap = parseMemberIdMap();
  const byChannel = new Map();
  for (const config of configs) {
    const channelId = String(config.channel_id || "");
    if (!channelId) continue;
    if (!byChannel.has(channelId)) byChannel.set(channelId, []);
    byChannel.get(channelId).push(config);
  }

  for (const [channelId, channelConfigs] of byChannel.entries()) {
    const channel =
      guild.channels.cache.get(channelId) ||
      (await guild.channels.fetch(channelId).catch(() => null));

    if (!channel || !channel.isTextBased() || channel.type === ChannelType.GuildVoice) {
      safeSend(log, `[STAFFUPDATE] Salon introuvable pour affichage staff (${channelId || "vide"})`, "WARN");
      continue;
    }

    const emblem =
      String(channelConfigs.find((c) => c.emblem)?.emblem || "").trim() || DEFAULT_STAFF_BOARD.emblem;
    const colorHex = normalizeHexColor(
      channelConfigs.find((c) => c.color)?.color,
      DEFAULT_STAFF_BOARD.color,
    );

    const parts = [];
    for (const config of channelConfigs) {
      const staffType = String(config.staff_type || `Staff #${config.id}`);
      const sectionEmoji =
        String(config.section_emoji || "").trim() || autoSectionEmoji(client, staffType);
      const memberLines = buildMembersForConfig(client, guild, config, idMap);

      parts.push(`# ${sectionEmoji}  ・${staffType}`);
      parts.push(...memberLines);
      parts.push("");
    }

    const marker = `SB:${channelId}`;
    const description = clampDescription(parts.join("\n").trim());

    const embed = new EmbedBuilder()
      .setColor(toColorInt(colorHex))
      .setAuthor({
        name: emblem,
        iconURL: (client.user && typeof client.user.displayAvatarURL === 'function') ? client.user.displayAvatarURL({ dynamic: true }) : null,
      })
      .setDescription(description)
      .setFooter({ text: `${marker} | MAJ auto` })
      .setTimestamp();

    try {
      await upsertStaffBoardMessage(client, channel, embed, marker);
    } catch (error) {
      safeSend(log, `[STAFFUPDATE] Erreur envoi embed staff: ${error.message}`, "ERROR");
    }
  }
}

const guildMemberUpdate = {
  async executeHandler(client, oldMember, newMember) {
    const log = client.getLogger?.();

    try {
      const guild = newMember.guild;
      const boostChannelId = process.env.BOOST_CHANNEL_ID;

      const boostedBefore = oldMember.premiumSince ? new Date(oldMember.premiumSince) : null;
      const boostedNow = newMember.premiumSince ? new Date(newMember.premiumSince) : null;

      if (!boostedBefore && boostedNow) {
        log?.send(`${newMember.user.tag} a booste le serveur ${guild.name}`, "READY");

        if (boostChannelId) {
          const boostChannel = await guild.channels.fetch(boostChannelId).catch(() => null);
          if (boostChannel && boostChannel.type === ChannelType.GuildText) {
            const boostCount = guild.premiumSubscriptionCount || 0;
            const boostLevel = guild.premiumTier || "None";

            const path = require("path");
            const boostAttachment = new AttachmentBuilder(
              path.join(__dirname, "../assets/boost_banner.png"),
              { name: "boost_banner.png" }
            );

            const boostEmbed = new EmbedBuilder()
              .setColor("#9B59B6")
              .setTitle("Merci pour le boost")
              .setDescription(`${newMember.user} vient de booster **${guild.name}**.\n\nMerci pour ton soutien.`)
              .setThumbnail(newMember.user.displayAvatarURL({ size: 256 }))
              .setImage("attachment://boost_banner.png")
              .addFields(
                { name: "Boosts du serveur", value: `${boostCount} boost(s)`, inline: true },
                { name: "Niveau du serveur", value: `Niveau ${boostLevel}`, inline: true },
                {
                  name: "Boosters",
                  value: `${guild.members.cache.filter((m) => m.premiumSince).size} membre(s)`,
                  inline: true,
                },
              )
              .setFooter({ text: "KobraBot | Boost Notification" })
              .setTimestamp();

            await boostChannel.send({
              embeds: [boostEmbed],
              files: [boostAttachment],
            }).catch((err) => {
              log?.send(`Impossible d'envoyer la notif boost: ${err.message}`, "ERROR");
            });
          }
        }

        const logsChannelId = process.env.LOGS_CHANNEL_ID;
        if (logsChannelId) {
          const logsChannel = await guild.channels.fetch(logsChannelId).catch(() => null);
          if (logsChannel && logsChannel.type === ChannelType.GuildText) {
            const logEmbed = new EmbedBuilder()
              .setColor("#9B59B6")
              .setTitle("Boost enregistre")
              .setDescription(`${newMember.user} (${newMember.user.id}) a booste le serveur.`)
              .setTimestamp();

            await logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }
      }

      if (didRolesChange(oldMember, newMember)) {
        await refreshStaffEmbeds(client, guild);
      }
    } catch (error) {
      log?.send(`Erreur dans guildMemberUpdate: ${error.message}`, "ERROR");
    }
  },

  settings: {
    enabled: true,
  },
};

module.exports = { default: guildMemberUpdate, refreshStaffEmbeds };


