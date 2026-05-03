const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const { getDatabase } = require("../../database/database");
const { refreshStaffEmbeds } = require("../../events/guildMemberUpdate");
const {
  normalizeHexColor,
  cleanText,
  ensureStaffupdateColumns,
} = require("../../utils/staffBoardConfig");

function parseJsonArray(raw) {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

const liststaff = {
  data: new SlashCommandBuilder()
    .setName("liststaff")
    .setDescription("Affiche ou modifie les configurations staffupdate")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName("voir").setDescription("Voir les configurations"))
    .addSubcommand((sub) =>
      sub
        .setName("supprimer")
        .setDescription("Supprimer une configuration par ID")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("ID de la configuration").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("modifier")
        .setDescription("Modifier salon/embleme/couleur/emoji d'une configuration")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("ID de la configuration").setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("salon")
            .setDescription("Nouveau salon")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt.setName("embleme").setDescription("Nouveau texte embleme").setRequired(false),
        )
        .addStringOption((opt) =>
          opt.setName("couleur").setDescription("Nouvelle couleur hex").setRequired(false),
        )
        .addStringOption((opt) =>
          opt.setName("emoji").setDescription("Nouvel emoji section").setRequired(false),
        )
        .addStringOption((opt) =>
          opt.setName("emoji_role").setDescription("Nouvel emoji role").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("refresh")
        .setDescription("Forcer la mise a jour immediate des embeds staff"),
    ),

  async executeCommand(client, interaction) {
    const db = getDatabase();
    if (!db) {
      return interaction.reply({
        content: "Base de donnees indisponible.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await ensureStaffupdateColumns(db).catch(() => {});

    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    if (sub === "supprimer") {
      const id = interaction.options.getInteger("id", true);
      try {
        const deleted = await db("staffupdate").where({ guild: guildId, id }).del();
        if (!deleted) {
          return interaction.reply({
            content: `Aucune configuration trouvee pour l'ID ${id}.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        return interaction.reply({
          content: `Configuration #${id} supprimee.`,
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        client.getLogger()?.send(`[LISTSTAFF] ${error.message}`, "ERROR");
        return interaction.reply({
          content: "Erreur SQL lors de la suppression.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    if (sub === "modifier") {
      const id = interaction.options.getInteger("id", true);
      const row = await db("staffupdate").where({ guild: guildId, id }).first();
      if (!row) {
        return interaction.reply({
          content: `Aucune configuration trouvee pour l'ID ${id}.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const salon = interaction.options.getChannel("salon");
      const embleme = interaction.options.getString("embleme");
      const couleur = interaction.options.getString("couleur");
      const emoji = interaction.options.getString("emoji");
      const emojiRole = interaction.options.getString("emoji_role");

      const patch = {};
      if (salon) patch.channel_id = salon.id;
      if (embleme !== null) patch.emblem = cleanText(embleme, 120) || null;
      if (couleur !== null) patch.color = normalizeHexColor(couleur, "#24002e");
      if (emoji !== null) patch.section_emoji = cleanText(emoji, 80) || null;
      if (emojiRole !== null) patch.role_emoji = cleanText(emojiRole, 80) || null;

      if (Object.keys(patch).length === 0) {
        return interaction.reply({
          content: "Aucune modification demandee.",
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        await db("staffupdate").where({ guild: guildId, id }).update(patch);
      } catch (error) {
        client.getLogger()?.send(`[LISTSTAFF] ${error.message}`, "ERROR");
        return interaction.reply({
          content: "Erreur SQL lors de la modification.",
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: `Configuration #${id} modifiee avec succes.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "refresh") {
      try {
        await refreshStaffEmbeds(client, interaction.guild);
        return interaction.reply({
          content: "Refresh staff effectue. Les embeds ont ete mis a jour.",
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        client.getLogger()?.send(`[LISTSTAFF] refresh: ${error.message}`, "ERROR");
        return interaction.reply({
          content: "Erreur pendant le refresh staff.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    let rows;
    try {
      rows = await db("staffupdate").where({ guild: guildId }).orderBy("id", "asc");
    } catch (error) {
      client.getLogger()?.send(`[LISTSTAFF] ${error.message}`, "ERROR");
      return interaction.reply({
        content: "Erreur SQL lors de la lecture des configurations.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!rows || rows.length === 0) {
      return interaction.reply({
        content: "Aucune configuration de staff trouvee.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const pages = chunk(rows, 6);
    const embeds = pages.map((page, index) => {
      const embed = new EmbedBuilder()
        .setColor(0x2b8cff)
        .setTitle(`Configurations staff (${index + 1}/${pages.length})`)
        .setTimestamp();

      for (const row of page) {
        const roleIds = parseJsonArray(row.role_id);
        const filterIds = parseJsonArray(row.filter_role);
        const rolesLabel = roleIds.length ? roleIds.map((id) => `<@&${id}>`).join(", ") : "Aucun";
        const filterLabel = filterIds.length
          ? filterIds.map((id) => `<@&${id}>`).join(", ")
          : "Aucun";

        embed.addFields({
          name: `#${row.id} - ${row.staff_type || "Sans type"}`,
          value:
            `Salon: <#${row.channel_id}>\n` +
            `Roles surveilles: ${rolesLabel}\n` +
            `Roles exclus: ${filterLabel}\n` +
            `Embleme: ${row.emblem || "(defaut)"}\n` +
            `Couleur: ${row.color || "(defaut)"}\n` +
            `Emoji section: ${row.section_emoji || "(auto)"}\n` +
            `Emoji role: ${row.role_emoji || "(auto)"}`,
        });
      }

      return embed;
    });

    return interaction.reply({
      embeds,
      flags: MessageFlags.Ephemeral,
    });
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: liststaff };


