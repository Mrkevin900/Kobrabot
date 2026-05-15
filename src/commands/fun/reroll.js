const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require("discord.js");

const reroll = {
  data: new SlashCommandBuilder()
    .setName("reroll")
    .setDescription("\u2728 Relancer un giveaway")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName("id")
        .setDescription("\u2728 ID du giveaway à relancer")
        .setRequired(true)
    ),

  async executeCommand(client, interaction) {
    const id = interaction.options.getString("id");

    const embed = new EmbedBuilder()
      .setColor(client.getConfig().embed.readyColor)
      .setTitle("🎁 Giveaway - Tirage au sort")
      .setDescription(`Le giveaway \`${id}\` a été relancé`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  settings: {
    module: "fun",
    enabled: true,
  },
};

module.exports = { default: reroll };


