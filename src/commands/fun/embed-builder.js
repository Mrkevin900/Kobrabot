const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  PermissionFlagsBits,
} = require("discord.js");

const embedBuilder = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("\u2728 Crée un embed personnalisé")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName("titre")
        .setDescription("\u2728 Titre de l'embed")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("\u2728 Description de l'embed")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("couleur")
        .setDescription("\u2728 Couleur (hex: #FF5733)")
        .setRequired(false),
    ),

  async executeCommand(client, interaction) {
    const titre = interaction.options.getString("titre");
    const description = interaction.options.getString("description");
    const couleur =
      interaction.options.getString("couleur") ||
      client.getConfig().embed.readyColor;

    const embed = new EmbedBuilder()
      .setTitle(titre)
      .setDescription(description || "Aucune description")
      .setColor(couleur)
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
    await interaction.reply({
      content: "✅ Embed créé et envoyé !",
      ephemeral: true,
    });
  },

  settings: {
    module: "fun",
    enabled: true,
  },
};

module.exports = { default: embedBuilder };


