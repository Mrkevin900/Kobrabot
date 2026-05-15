const {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");
const {
  buildPackDmEmbed,
  buildSetupSummaryEmbed,
  createOptimizationAttachments,
  ensureOptimizationSpace,
  getChannelMessages,
  getPackDefinition,
  getPackKeyFromButtonId,
} = require("../../utils/gmodOptimization");

const optimisation = {
  data: new SlashCommandBuilder()
    .setName("optimisation")
    .setDescription("Installe l'espace Discord d'optimisation GMod RP")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription(
          "Cree la categorie, les salons et les panneaux d'optimisation",
        ),
    ),

  async executeCommand(client, interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      return this.handleSetup(client, interaction);
    }

    return interaction.reply({
      content: "Sous-commande inconnue.",
      flags: MessageFlags.Ephemeral,
    });
  },

  async handleSetup(client, interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const { category, channels } = await ensureOptimizationSpace(
        interaction.guild,
      );
      const messagesByChannel = getChannelMessages(client);

      for (const [channelKey, payloads] of Object.entries(messagesByChannel)) {
        const targetChannel = channels[channelKey];
        if (!targetChannel) continue;

        for (const payload of payloads) {
          await targetChannel.send(payload);
        }
      }

      return interaction.editReply({
        embeds: [buildSetupSummaryEmbed(category, channels)],
      });
    } catch (error) {
      client
        .getLogger()
        ?.send(
          `Erreur installation optimisation GMod: ${error.message}`,
          "ERROR",
        );

      return interaction.editReply(
        "Erreur lors de l'installation de l'espace optimisation GMod RP.",
      );
    }
  },

  async execButtons(client, interaction, buttonId) {
    if (!interaction.isButton()) return;

    const packKey = getPackKeyFromButtonId(buttonId);
    if (!packKey) return;
    const pack = getPackDefinition(packKey);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await interaction.user.send({
        embeds: [buildPackDmEmbed(packKey)],
        files: createOptimizationAttachments(packKey),
      });

      return interaction.editReply(
        `Le ${pack.dmLabel} vient d'etre envoye en message prive.`,
      );
    } catch (error) {
      client
        .getLogger()
        ?.send(`Erreur envoi ${pack.dmLabel}: ${error.message}`, "ERROR");

      if (error.code === 50007) {
        return interaction.editReply(
          "Impossible de vous envoyer un message prive. Ouvrez vos MP puis recliquez sur le bouton.",
        );
      }

      return interaction.editReply(
        "Erreur lors de l'envoi du pack d'optimisation.",
      );
    }
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: optimisation };

