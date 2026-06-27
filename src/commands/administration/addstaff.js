const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const { getDatabase } = require("../../database/database");
const {
  DEFAULT_STAFF_BOARD,
  normalizeHexColor,
  cleanText,
  ensureStaffupdateColumns,
} = require("../../utils/staffBoardConfig");

function parseRoleIds(input) {
  const matches = String(input || "").match(/\d{16,20}/g) || [];
  return [...new Set(matches)];
}

const addstaff = {
  data: new SlashCommandBuilder()
    .setName("addstaff")
    .setDescription("Ajoute une configuration staffupdate")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName("role_ids")
        .setDescription("IDs des roles a surveiller (separes par des virgules)")
        .setRequired(true),
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel_id")
        .setDescription("Salon ou publier la liste staff")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("staff_type")
        .setDescription("Nom/type affiche pour cette liste")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("filter_role")
        .setDescription("IDs des roles a exclure (separes par des virgules)")
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("embleme")
        .setDescription("Texte en haut de l'embed (ex: Famille KobraBot Test)")
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("couleur")
        .setDescription("Couleur hex (ex: #24002e)")
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("emoji")
        .setDescription("Emoji de section (ex: :police: ou <:kb_player:...>)")
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("emoji_role")
        .setDescription("Emoji devant le role membre")
        .setRequired(false),
    ),

  async executeCommand(client, interaction) {
    const db = getDatabase();
    if (!db) {
      return interaction.reply({
        content: "Base de donnees indisponible.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const guild = interaction.guild;
    const channel = interaction.options.getChannel("channel_id", true);
    const staffType = interaction.options.getString("staff_type", true).trim();
    const roleIds = parseRoleIds(interaction.options.getString("role_ids", true));
    const filterIds = parseRoleIds(interaction.options.getString("filter_role") || "");
    const emblem = cleanText(
      interaction.options.getString("embleme") || DEFAULT_STAFF_BOARD.emblem,
      120,
    );
    const color = normalizeHexColor(
      interaction.options.getString("couleur"),
      DEFAULT_STAFF_BOARD.color,
    );
    const sectionEmoji = cleanText(interaction.options.getString("emoji") || "", 80);
    const roleEmoji = cleanText(interaction.options.getString("emoji_role") || "", 80);

    if (roleIds.length === 0) {
      return interaction.reply({
        content: "Aucun role valide detecte dans `role_ids`.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const unknownMain = roleIds.filter((id) => !guild.roles.cache.has(id));
    if (unknownMain.length > 0) {
      return interaction.reply({
        content: `Roles introuvables: ${unknownMain.map((id) => `\`${id}\``).join(", ")}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const unknownFilter = filterIds.filter((id) => !guild.roles.cache.has(id));
    if (unknownFilter.length > 0) {
      return interaction.reply({
        content: `Roles filtres introuvables: ${unknownFilter.map((id) => `\`${id}\``).join(", ")}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await ensureStaffupdateColumns(db);
      await db("staffupdate").insert({
        guild: guild.id,
        role_id: JSON.stringify(roleIds),
        staff_type: staffType,
        filter_role: JSON.stringify(filterIds),
        channel_id: channel.id,
        emblem: emblem || null,
        color: color || null,
        section_emoji: sectionEmoji || null,
        role_emoji: roleEmoji || null,
      });

      // Automatically refresh staff board
      const { refreshStaffEmbeds } = require("../../events/guildMemberUpdate");
      await refreshStaffEmbeds(client, guild).catch(() => {});
    } catch (error) {
      client.getLogger()?.send(`[ADDSTAFF] ${error.message}`, "ERROR");
      return interaction.reply({
        content: "Erreur SQL lors de l'ajout de la configuration.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const rolesLabel = roleIds.map((id) => `<@&${id}>`).join(", ");
    const filterLabel =
      filterIds.length > 0 ? filterIds.map((id) => `<@&${id}>`).join(", ") : "Aucun";

    return interaction.reply({
      content:
        "Configuration staff ajoutee.\n" +
        `Type: **${staffType}**\n` +
        `Salon: <#${channel.id}>\n` +
        `Roles surveilles: ${rolesLabel}\n` +
        `Roles exclus: ${filterLabel}\n` +
        `Embleme: **${emblem}**\n` +
        `Couleur: \`${color}\`\n` +
        `Emoji section: ${sectionEmoji || "(auto)"}\n` +
        `Emoji role: ${roleEmoji || "(auto)"}`,
      flags: MessageFlags.Ephemeral,
    });
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: addstaff };


