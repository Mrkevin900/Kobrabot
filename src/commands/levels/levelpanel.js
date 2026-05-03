const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  InteractionContextType,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const { getDatabase } = require("../../database/database");
const { getGuildSettings, updateGuildSettings } = require("../../utils/levelRewards");

function buildPanelEmbed(client, settings) {
  const mascot = client.mascot("\u{1F497}");
  return new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle(`${mascot} Panel niveaux`)
    .setDescription("Configuration du systeme de recompenses et de boutique XP.")
    .addFields(
      { name: "Boutique", value: settings.shopEnabled ? "Active" : "Desactivee", inline: true },
      {
        name: "Recompense niveau",
        value: `${settings.rewardPointsPerLevel} point(s)`,
        inline: true,
      },
      { name: "Prix x2 XP", value: `${settings.x2PricePoints} points`, inline: true },
      { name: "Duree x2 XP", value: `${settings.x2DurationMinutes} minute(s)`, inline: true },
    )
    .setTimestamp();
}

function buildCommandsPanelEmbed(client) {
  const mascot = client.emoji("kbrp_emojis", "\u{1F497}");
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${mascot} Panel commandes niveaux`)
    .setDescription(
      "Selectionne une commande dans le menu pour voir son usage detaille.\n" +
        "Commandes incluses: `leveladmin`, `levelpanel`, `resetlevel`.",
    )
    .setTimestamp();
}

function buildCommandsPanelMenu() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("level_cmd_panel_select")
    .setPlaceholder("Choisis une commande de niveaux")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("/leveladmin")
        .setDescription("Administration boosts, niveaux et points")
        .setValue("leveladmin"),
      new StringSelectMenuOptionBuilder()
        .setLabel("/levelpanel")
        .setDescription("Configuration boutique/recompenses XP")
        .setValue("levelpanel"),
      new StringSelectMenuOptionBuilder()
        .setLabel("/resetlevel")
        .setDescription("Reset niveau utilisateur ou serveur")
        .setValue("resetlevel"),
    );

  return new ActionRowBuilder().addComponents(menu);
}

const levelpanel = {
  data: new SlashCommandBuilder()
    .setName("levelpanel")
    .setDescription("Panel admin du systeme de niveaux")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName("voir").setDescription("Voir la configuration"))
    .addSubcommand((sub) =>
      sub.setName("cmd_panel").setDescription("Afficher le panel select des commandes niveaux"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("boutique")
        .setDescription("Activer ou desactiver la boutique")
        .addBooleanOption((opt) =>
          opt.setName("active").setDescription("Etat de la boutique").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("recompense_niveau")
        .setDescription("Definir les points gagnes par niveau")
        .addIntegerOption((opt) =>
          opt
            .setName("points")
            .setDescription("Points attribues a chaque niveau")
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(1000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("prix_x2")
        .setDescription("Definir le prix du boost x2")
        .addIntegerOption((opt) =>
          opt
            .setName("points")
            .setDescription("Prix en points boutique")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("duree_x2")
        .setDescription("Definir la duree du boost x2")
        .addIntegerOption((opt) =>
          opt
            .setName("minutes")
            .setDescription("Duree du boost x2 en minutes")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(43200),
        ),
    ),

  async executeCommand(client, interaction) {
    const db = getDatabase();
    if (!db) {
      return interaction.reply({
        content: "Base de donnees indisponible.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    if (sub === "voir") {
      const settings = await getGuildSettings(db, guildId);
      return interaction.reply({
        embeds: [buildPanelEmbed(client, settings)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "cmd_panel") {
      return interaction.reply({
        embeds: [buildCommandsPanelEmbed(client)],
        components: [buildCommandsPanelMenu()],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "boutique") {
      const active = interaction.options.getBoolean("active", true);
      const settings = await updateGuildSettings(db, guildId, { shopEnabled: active });
      return interaction.reply({
        content: `Boutique ${active ? "activee" : "desactivee"}.`,
        embeds: [buildPanelEmbed(client, settings)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "recompense_niveau") {
      const points = interaction.options.getInteger("points", true);
      const settings = await updateGuildSettings(db, guildId, {
        rewardPointsPerLevel: points,
      });
      return interaction.reply({
        content: `Recompense niveau mise a jour: ${points} point(s).`,
        embeds: [buildPanelEmbed(client, settings)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "prix_x2") {
      const points = interaction.options.getInteger("points", true);
      const settings = await updateGuildSettings(db, guildId, { x2PricePoints: points });
      return interaction.reply({
        content: `Prix du x2 mis a jour: ${points} point(s).`,
        embeds: [buildPanelEmbed(client, settings)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "duree_x2") {
      const minutes = interaction.options.getInteger("minutes", true);
      const settings = await updateGuildSettings(db, guildId, { x2DurationMinutes: minutes });
      return interaction.reply({
        content: `Duree du x2 mise a jour: ${minutes} minute(s).`,
        embeds: [buildPanelEmbed(client, settings)],
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      content: "Sous-commande inconnue.",
      flags: MessageFlags.Ephemeral,
    });
  },

  settings: {
    module: "admin",
    enabled: false,
  },
};

module.exports = { default: levelpanel };




