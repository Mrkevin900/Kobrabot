const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
} = require("discord.js");

const bienvenue = {
  data: new SlashCommandBuilder()
    .setName("bienvenue")
    .setDescription("\u2728 Envoie un message de bienvenue personnalisé")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("\u2728 Utilisateur à accueillir")
        .setRequired(false),
    ),

  async executeCommand(client, interaction) {
    const guild = interaction.guild;
    const user = interaction.options.getUser("utilisateur") || interaction.user;

    if (!guild) {
      return interaction.reply({
        content: "❌ Serveur introuvable.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(client.getConfig().embed.readyColor)
      .setTitle(`🎉 Bienvenue sur ${guild.name} !`)
      .setDescription(
        `Salut ${user.username} ! 👋\n\n` +
          `Merci de nous avoir rejoints ! Nous sommes heureux de t'accueillir dans notre communauté.\n\n` +
          `**Pour commencer :**\n` +
          `• Lis les règles du serveur\n` +
          `• Présentez-vous dans le salon approprié\n` +
          `• N'hésite pas à poser des questions\n\n` +
          `Bonne visite ! 😊`,
      )
      .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
      .setFooter({ text: `KobraBot | ${guild.name}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  settings: {
    module: "fun",
    enabled: true,
  },
};

module.exports = { default: bienvenue };


