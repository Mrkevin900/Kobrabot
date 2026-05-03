const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require("discord.js");
const {
  getSuggestionChannelId,
  publishSuggestion,
} = require("../../utils/suggestions");

const suggest = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Envoie une suggestion dans le salon configure")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName("idee")
        .setDescription("Ta suggestion")
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(4000),
    )
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Image optionnelle pour illustrer la suggestion")
        .setRequired(false),
    ),

  async executeCommand(client, interaction) {
    const channelId = getSuggestionChannelId();
    if (!channelId) {
      return interaction.reply({
        content: "SUGGEST_CHANNEL_ID n'est pas configure dans le .env.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const guild = interaction.guild;
    const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
    if (!channel || !channel.isTextBased?.()) {
      return interaction.reply({
        content: "Le salon de suggestions configure est introuvable.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const result = await publishSuggestion(client, {
      guild,
      channel,
      author: interaction.member,
      content: interaction.options.getString("idee", true),
      attachment: interaction.options.getAttachment("image"),
    });

    if (!result.ok) {
      return interaction.reply({
        content: result.error || "Impossible d'envoyer la suggestion.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("Suggestion envoyee")
      .setDescription(`Ta suggestion a ete publiee dans ${result.channel}.`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  settings: {
    module: "general",
    enabled: true,
  },
};

module.exports = { default: suggest };

