const {
  MessageFlags,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");
const { getDatabase, ensureDatabaseConnection, describeDbError } = require("../database/database");
const { getPanel, upsertPanel } = require("../utils/vocalPanels");

function getRuntimeStore(client) {
  if (!client.cache) {
    const CacheManager = require("../utils/CacheManager");
    client.cache = new CacheManager();
  }
  return client.cache;
}

function hasVocalPanelDatabase() {
  return Boolean(getDatabase());
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
    .map((id) => guild.members.cache.get(id)?.toString() || `<@${id}>`)
    .join(", ");
  return ids.length > 8 ? `${list}...` : list;
}

function buildSlotLabel(slot) {
  if (!slot || !Array.isArray(slot.whitelist) || !Array.isArray(slot.blacklist)) {
    return "Emplacement vide";
  }
  return `W:${slot.whitelist.length} B:${slot.blacklist.length}`;
}

function buildVocalPanelEmbed(client, guild, ownerMember, entry) {
  const mascot = client?.emoji?.("kbrp_emojis", "\u{1F497}") || "\u{1F497}";
  return new EmbedBuilder()
    .setTitle(`${mascot} Configuration du salon`)
    .setDescription(
      "\u2699\ufe0f **Astuce** : vous avez la possibilite de gerer le salon avec les boutons.",
    )
    .addFields(
      { name: "\ud83d\udd12 Ferme", value: "Personne ne peut rejoindre le salon." },
      { name: "\ud83d\udd09 Prive", value: "Salon visible mais bloque." },
      { name: "\ud83d\udd0a Public", value: "Tout le monde peut rejoindre." },
      { name: "\ud83d\udc51 Transferer la propriete", value: "Donne la propriete a un membre present." },
      { name: "\ud83d\udcdc Whitelist", value: formatList(guild, entry.whitelist), inline: true },
      { name: "\ud83d\uded1 Blacklist", value: formatList(guild, entry.blacklist), inline: true },
      { name: "\u23cf Purger", value: "Expulse les membres non whitelistes." },
      {
        name: "\ud83c\udfa4 Permission micro",
        value: entry.restrictMic ? "Activee" : "Desactivee",
        inline: true,
      },
      {
        name: "\ud83c\udfa5 Permission video",
        value: entry.restrictVideo ? "Activee" : "Desactivee",
        inline: true,
      },
    )
    .setColor(0x9b59b6)
    .setFooter({
      text: `${ownerMember?.user?.username || "Owner"} | Systeme Vocal`,
    })
    .setTimestamp();
}

function buildVocalRows(client, channelId, ownerId, entry) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`vocalbtn_lock_${channelId}_${ownerId}`).setEmoji(client.emoji("lock", "\u{1F512}")).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`vocalbtn_private_${channelId}_${ownerId}`).setEmoji(client.emoji("private", "\u{1F509}")).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`vocalbtn_public_${channelId}_${ownerId}`).setEmoji(client.emoji("public", "\u{1F50A}")).setStyle(ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`vocalbtn_transfer_${channelId}_${ownerId}`).setEmoji(client.emoji("transfer", "\u{1F451}")).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`vocalbtn_whitelist_${channelId}_${ownerId}`).setEmoji(client.emoji("whitelist", "\u{1F4DC}")).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`vocalbtn_blacklist_${channelId}_${ownerId}`).setEmoji(client.emoji("blacklist", "\u{1F6D1}")).setStyle(ButtonStyle.Danger),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`vocalbtn_purge_${channelId}_${ownerId}`).setEmoji(client.emoji("purge", "\u{23CF}")).setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`vocalbtn_mic_${channelId}_${ownerId}`)
      .setEmoji(client.emoji("mic", "\u{1F3A4}"))
      .setStyle(entry.restrictMic ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`vocalbtn_video_${channelId}_${ownerId}`)
      .setEmoji(client.emoji("video", "\u{1F3A5}"))
      .setStyle(entry.restrictVideo ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`vocal_lists_${channelId}_${ownerId}`)
    .setPlaceholder("Vos listes sauvegardees")
    .addOptions([
      { label: "Sauvegarder l'etat actuel des listes", value: "save_current" },
      { label: buildSlotLabel(entry.savedLists?.[0]), value: "slot_1" },
      { label: buildSlotLabel(entry.savedLists?.[1]), value: "slot_2" },
      { label: buildSlotLabel(entry.savedLists?.[2]), value: "slot_3" },
      { label: buildSlotLabel(entry.savedLists?.[3]), value: "slot_4" },
    ]);

  const row4 = new ActionRowBuilder().addComponents(menu);
  return [row1, row2, row3, row4];
}

function upsertTempVocalInMemory(client, entry) {
  const store = getRuntimeStore(client);
  const current = store.has("tempVocals") ? store.get("tempVocals") : [];
  const list = Array.isArray(current) ? current : [];
  const idx = list.findIndex((v) => v.guildId === entry.guildId && v.channelId === entry.channelId);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  store.set("tempVocals", list);
}

async function getTempVocal(client, guildId, channelId) {
  const db = (await ensureDatabaseConnection(client)) || getDatabase();
  if (!db) return null;
  try {
    const row = await getPanel(db, guildId, channelId);
    if (!row) return null;
    const entry = ensureTempVocalDefaults(row);
    upsertTempVocalInMemory(client, entry);
    return entry;
  } catch (err) {
    client
      .getLogger()
      ?.send(`[VOCAL] Erreur lecture panel DB: ${describeDbError(err)}`, "WARN");
  }
  return null;
}

async function saveTempVocal(client, entry) {
  const clean = ensureTempVocalDefaults(entry);
  upsertTempVocalInMemory(client, clean);
  const db = (await ensureDatabaseConnection(client)) || getDatabase();
  if (!db) throw new Error("MySQL indisponible");
  try {
    await upsertPanel(db, clean);
  } catch (err) {
    client
      .getLogger()
      ?.send(`[VOCAL] Erreur save panel DB: ${describeDbError(err)}`, "WARN");
    throw err;
  }
}

async function applyVocalAccessMode(channel, guild, mode) {
  if (mode === "lock") {
    await channel.permissionOverwrites.edit(guild.id, { Connect: false, ViewChannel: false });
    return;
  }
  if (mode === "private") {
    await channel.permissionOverwrites.edit(guild.id, { Connect: false, ViewChannel: true });
    return;
  }
  await channel.permissionOverwrites.edit(guild.id, { Connect: true, ViewChannel: true });
}

async function applyWhitelistBlacklist(channel, ownerId, entry) {
  const promises = [];

  for (const userId of entry.whitelist) {
    promises.push(
      channel.permissionOverwrites.edit(userId, { ViewChannel: true, Connect: true }).catch(() => {})
    );
  }
  for (const userId of entry.blacklist) {
    promises.push(
      channel.permissionOverwrites.edit(userId, { ViewChannel: false, Connect: false }).catch(() => {})
    );
  }

  for (const [memberId, member] of channel.members) {
    if (memberId === ownerId) continue;
    if (entry.blacklist.includes(memberId)) {
      promises.push(member.voice.disconnect("Blacklist vocal").catch(() => {}));
    }
  }

  await Promise.all(promises);
}

async function applyMicVideoRules(channel, ownerId, entry) {
  const promises = [];
  
  for (const [memberId] of channel.members) {
    if (memberId === ownerId) continue;
    if (entry.whitelist.includes(memberId)) {
      promises.push(channel.permissionOverwrites.edit(memberId, { Speak: null, Stream: null }).catch(() => {}));
      continue;
    }
    promises.push(
      channel.permissionOverwrites
        .edit(memberId, {
          Speak: entry.restrictMic ? false : null,
          Stream: entry.restrictVideo ? false : null,
        })
        .catch(() => {})
    );
  }
  
  await Promise.all(promises);
}

async function updateVocalPanelMessage(client, interaction, guild, channel, ownerId, entry) {
  const ownerMember = guild.members.cache.get(ownerId) || guild.members.cache.get(entry.ownerId);
  const embed = buildVocalPanelEmbed(client, guild, ownerMember, entry);
  const rows = buildVocalRows(client, channel.id, ownerId, entry);
  if (interaction.message?.edit) {
    await interaction.message.edit({ embeds: [embed], components: rows }).catch(() => {});
  }
}

async function updateVocalPanelMessageById(client, guild, channel, messageId, ownerId, entry) {
  if (!channel?.messages?.fetch || !messageId) return;
  const ownerMember = guild.members.cache.get(ownerId) || guild.members.cache.get(entry.ownerId);
  const embed = buildVocalPanelEmbed(client, guild, ownerMember, entry);
  const rows = buildVocalRows(client, channel.id, ownerId, entry);
  const msg = await channel.messages.fetch(messageId).catch(() => null);
  if (!msg?.edit) return;
  await msg.edit({ embeds: [embed], components: rows }).catch(() => {});
}

async function handleVocalSelectMenu(client, interaction) {
  if (customId.startsWith("vocal_lists_")) {
    if (!hasVocalPanelDatabase()) {
      return interaction.reply({
        content: "MySQL indisponible. Les sauvegardes vocales utilisent la base SQL.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const parts = customId.split("_");
    const channelId = parts[2];
    const ownerId = parts[3];
    const action = interaction.values?.[0];
    const guild = interaction.guild;
    const channel = guild?.channels.cache.get(channelId);
    const entry = guild ? await getTempVocal(client, guild.id, channelId) : null;

    if (!guild || !channel || !entry) {
      return interaction.reply({ content: "Salon introuvable.", flags: MessageFlags.Ephemeral });
    }
    if (interaction.user.id !== ownerId || interaction.user.id !== entry.ownerId) {
      return interaction.reply({
        content: "Tu n'es pas le proprietaire de ce salon.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferUpdate().catch(() => {});

    if (action === "save_current") {
      const slotIndex = entry.savedLists.findIndex((slot) => !slot);
      const target = slotIndex >= 0 ? slotIndex : 0;
      entry.savedLists[target] = {
        whitelist: [...entry.whitelist],
        blacklist: [...entry.blacklist],
      };
      await saveTempVocal(client, entry);
      await updateVocalPanelMessage(client, interaction, guild, channel, entry.ownerId, entry);
      return interaction.followUp({
        content: `Listes sauvegardees dans l'emplacement ${target + 1}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const match = String(action || "").match(/^slot_(\d)$/);
    if (!match) return;
    const index = Number(match[1]) - 1;
    const slot = entry.savedLists[index];
    if (!slot) {
      entry.savedLists[index] = {
        whitelist: [...entry.whitelist],
        blacklist: [...entry.blacklist],
      };
      await saveTempVocal(client, entry);
      await updateVocalPanelMessage(client, interaction, guild, channel, entry.ownerId, entry);
      return interaction.followUp({
        content: `Listes sauvegardees dans l'emplacement ${index + 1}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    entry.whitelist = [...slot.whitelist];
    entry.blacklist = [...slot.blacklist];
    await saveTempVocal(client, entry);
    await applyWhitelistBlacklist(channel, entry.ownerId, entry);
    await applyMicVideoRules(channel, entry.ownerId, entry);
    await updateVocalPanelMessage(client, interaction, guild, channel, entry.ownerId, entry);
    return interaction.followUp({
      content: `Listes chargees depuis l'emplacement ${index + 1}.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!customId.startsWith("vocal_manage_")) return;

  const rest = customId.replace("vocal_manage_", "");
  const parts = rest.split("_");
  const channelId = parts[0];
  const ownerId = parts[1];

  const action = interaction.values?.[0];
  const guild = interaction.guild;
  const channel = guild?.channels.cache.get(channelId);
  if (!channel) {
    return interaction.reply({
      content: "Salon introuvable.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      content: "Tu n'es pas le proprietaire de ce salon.",
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    if (action === "lock") {
      await channel.permissionOverwrites.edit(guild.id, { Connect: false, ViewChannel: false });
      await channel.permissionOverwrites.edit(ownerId, { Connect: true, ViewChannel: true });
      return interaction.reply({ content: "Salon verrouille.", flags: MessageFlags.Ephemeral });
    }

    if (action === "unlock") {
      await channel.permissionOverwrites.edit(guild.id, { Connect: null, ViewChannel: null });
      await channel.permissionOverwrites.edit(ownerId, { Connect: true, ViewChannel: true });
      return interaction.reply({ content: "Salon deverrouille.", flags: MessageFlags.Ephemeral });
    }

    if (action === "delete") {
      await interaction.reply({ content: "Suppression du salon...", flags: MessageFlags.Ephemeral });
      await channel.delete("Suppression demandee par le proprietaire via menu");
      return;
    }

    if (action === "reset") {
      const botId = interaction.client.user.id;
      for (const [targetId] of channel.permissionOverwrites.cache) {
        if (targetId === ownerId || targetId === botId) continue;
        await channel.permissionOverwrites.delete(targetId).catch(() => {});
      }
      return interaction.reply({
        content: "Permissions reinitialisees.",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      content: "Action non implementee.",
      flags: MessageFlags.Ephemeral,
    });
  } catch (e) {
    client.getLogger()?.send("Erreur menu vocal: " + e.message, "ERROR");
    return interaction.reply({
      content: "Une erreur est survenue.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleVocalButton(client, interaction) {
  if (!hasVocalPanelDatabase()) {
    return interaction.reply({
      content: "MySQL indisponible. Les actions vocales sont desactivees temporairement.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const parts = String(interaction.customId || "").split("_");
  const action = parts[1];
  const channelId = parts[2];
  const ownerId = parts[3];
  const guild = interaction.guild;
  const channel = guild?.channels.cache.get(channelId);
  const entry = guild ? await getTempVocal(client, guild.id, channelId) : null;

  if (!guild || !channel || !entry) {
    return interaction.reply({ content: "Salon introuvable.", flags: MessageFlags.Ephemeral });
  }

  if (interaction.user.id !== ownerId || interaction.user.id !== entry.ownerId) {
    return interaction.reply({
      content: "Tu n'es pas le proprietaire de ce salon.",
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    if (["transfer", "whitelist", "blacklist"].includes(action)) {
      const isWhitelist = action === "whitelist";
      const picker = new UserSelectMenuBuilder()
        .setCustomId(`vocal_pick_${action}_${channelId}_${ownerId}_${interaction.message.id}`)
        .setPlaceholder(isWhitelist ? "Choisis un ou plusieurs membres" : "Choisis un membre")
        .setMinValues(1)
        .setMaxValues(isWhitelist ? 25 : 1);

      const row = new ActionRowBuilder().addComponents(picker);
      return interaction.reply({
        content: isWhitelist
          ? "Selectionne les membres a ajouter en whitelist."
          : "Selectionne le membre a appliquer.",
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferUpdate().catch(() => {});
    let feedback = "Action appliquee.";

    if (action === "lock") {
      entry.mode = "lock";
      await applyVocalAccessMode(channel, guild, "lock");
      feedback = "Salon ferme.";
    } else if (action === "private") {
      entry.mode = "private";
      await applyVocalAccessMode(channel, guild, "private");
      feedback = "Salon passe en prive.";
    } else if (action === "public") {
      entry.mode = "public";
      await applyVocalAccessMode(channel, guild, "public");
      feedback = "Salon passe en public.";
    } else if (action === "purge") {
      const promises = [];
      let kicked = 0;
      for (const [memberId, voiceMember] of channel.members) {
        if (memberId === entry.ownerId) continue;
        if (entry.whitelist.includes(memberId)) continue;
        promises.push(voiceMember.voice.disconnect("Purge vocal").catch(() => {}));
        kicked++;
      }
      await Promise.all(promises);
      feedback = `Purge effectuee (${kicked} membre(s) expulse(s)).`;
    } else if (action === "mic") {
      entry.restrictMic = !entry.restrictMic;
      feedback = entry.restrictMic ? "Permission micro restreinte." : "Permission micro reouverte.";
    } else if (action === "video") {
      entry.restrictVideo = !entry.restrictVideo;
      feedback = entry.restrictVideo
        ? "Permission video restreinte."
        : "Permission video reouverte.";
    }

    await saveTempVocal(client, entry);
    await applyWhitelistBlacklist(channel, entry.ownerId, entry);
    await applyMicVideoRules(channel, entry.ownerId, entry);
    await updateVocalPanelMessage(client, interaction, guild, channel, entry.ownerId, entry);
    return interaction.followUp({ content: feedback, flags: MessageFlags.Ephemeral });
  } catch (e) {
    client.getLogger()?.send("Erreur boutons vocal: " + e.message, "ERROR");
    return interaction.followUp({
      content: "Une erreur est survenue.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleUserSelectMenu(client, interaction) {
  const customId = interaction.customId || "";
  if (!customId.startsWith("vocal_pick_")) return;
  if (!hasVocalPanelDatabase()) {
    return interaction.reply({
      content: "MySQL indisponible. Les actions vocales sont desactivees temporairement.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const parts = customId.split("_");
  const action = parts[2];
  const channelId = parts[3];
  const ownerId = parts[4];
  const panelMessageId = parts[5];
  const pickedUserIds = Array.isArray(interaction.values) ? interaction.values : [];
  const pickedUserId = pickedUserIds[0];
  const guild = interaction.guild;
  const channel = guild?.channels.cache.get(channelId);
  const entry = guild ? await getTempVocal(client, guild.id, channelId) : null;

  if (!guild || !channel || !entry || pickedUserIds.length === 0) {
    return interaction.reply({ content: "Salon introuvable.", flags: MessageFlags.Ephemeral });
  }

  if (interaction.user.id !== ownerId || interaction.user.id !== entry.ownerId) {
    return interaction.reply({
      content: "Tu n'es pas le proprietaire de ce salon.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferUpdate().catch(() => {});
  let feedback = "Action appliquee.";

  if (action === "transfer") {
    const pickedMember = guild.members.cache.get(pickedUserId);
    if (!pickedMember || pickedMember.user.bot) {
      return interaction.followUp({
        content: "Membre invalide.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!channel.members.has(pickedUserId)) {
      return interaction.followUp({
        content: "Le membre doit etre present dans le vocal pour transferer.",
        flags: MessageFlags.Ephemeral,
      });
    }
    entry.ownerId = pickedUserId;
    await channel.permissionOverwrites
      .edit(pickedUserId, {
        ViewChannel: true,
        Connect: true,
        ManageChannels: true,
        MoveMembers: true,
      })
      .catch(() => {});
    await channel
      .send({
        content: `\ud83d\udc51 ${pickedMember} est maintenant proprietaire de ce salon vocal.`,
      })
      .catch(() => {});
    feedback = `Propriete transferee a ${pickedMember}.`;
  }

  if (action === "whitelist") {
    let added = 0;
    for (const userId of pickedUserIds) {
      const member = guild.members.cache.get(userId);
      if (!member || member.user.bot) continue;
      entry.blacklist = entry.blacklist.filter((id) => id !== userId);
      if (!entry.whitelist.includes(userId)) {
        entry.whitelist.push(userId);
        added++;
      }
    }
    feedback = added > 0 ? `${added} membre(s) ajoute(s) a la whitelist.` : "Aucun membre ajoute.";
  }

  if (action === "blacklist") {
    const pickedMember = guild.members.cache.get(pickedUserId);
    if (!pickedMember || pickedMember.user.bot) {
      return interaction.followUp({
        content: "Membre invalide.",
        flags: MessageFlags.Ephemeral,
      });
    }

    entry.whitelist = entry.whitelist.filter((id) => id !== pickedUserId);
    if (entry.blacklist.includes(pickedUserId)) {
      entry.blacklist = entry.blacklist.filter((id) => id !== pickedUserId);
      feedback = `${pickedMember} retire de la blacklist.`;
    } else {
      entry.blacklist.push(pickedUserId);
      feedback = `${pickedMember} ajoute a la blacklist.`;
    }
  }

  await saveTempVocal(client, entry);
  await applyWhitelistBlacklist(channel, entry.ownerId, entry);
  await applyMicVideoRules(channel, entry.ownerId, entry);
  await updateVocalPanelMessageById(client, guild, channel, panelMessageId, entry.ownerId, entry);
  return interaction.followUp({ content: feedback, flags: MessageFlags.Ephemeral });
}

module.exports = {
  handleVocalButton,
  handleVocalUserSelectMenu: handleUserSelectMenu,
  handleVocalSelectMenu
};


