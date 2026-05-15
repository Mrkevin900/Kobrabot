const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require("discord.js");

const image = {
  data: new SlashCommandBuilder()
    .setName("image")
    .setDescription("\u2728 Affiche une image aléatoire")
    .setContexts(InteractionContextType.Guild),

  async executeCommand(client, interaction) {
    const images = [
      "https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif",
      "https://media.giphy.com/media/l0HlDtKPoYJhFtgQ4/giphy.gif",
      "https://media.giphy.com/media/xTiTnIWSRfEzuKBJbG/giphy.gif",
    ];

    const randomImage = images[Math.floor(Math.random() * images.length)];

    const embed = new EmbedBuilder()
      .setColor(client.getConfig().embed.readyColor)
      .setImage(randomImage)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  settings: {
    module: "fun",
    enabled: true,
  },
};

module.exports = { default: image };


