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

const levels = {
  data: new SlashCommandBuilder()
    .setName("levels")
    .setDescription("Panel central du systeme de niveaux")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("panel").setDescription("Afficher le panel des commandes niveaux"),
    ),

  async executeCommand(client, interaction) {
    return interaction.reply({
      embeds: [buildCommandsPanelEmbed(client)],
      components: [buildCommandsPanelMenu()],
      flags: MessageFlags.Ephemeral,
    });
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: levels };

