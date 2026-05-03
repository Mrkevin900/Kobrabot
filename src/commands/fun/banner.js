const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
} = require("discord.js");
const banner = require('discord-banners-js');

const bannerCommand = {
  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription("🖼️ Affiche la bannière d'un utilisateur")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Utilisateur dont afficher la bannière")
        .setRequired(false),
    ),

  async executeCommand(client, interaction) {
    const user = interaction.options.getUser("utilisateur") || interaction.user;

    try {
      const bannerurl = await banner(user.id, process.env.TOKEN, { size: 4096 });

      const embed = new EmbedBuilder()
        .setTitle(`**Bannière de : ${user.tag}**`)
        .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setColor('Random')
        .setTimestamp();

      if (bannerurl) {
        embed.setImage(bannerurl);
      } else {
        embed.setDescription("Cet utilisateur n'a pas de bannière.");
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "❌ Erreur lors de la récupération de la bannière.",
        ephemeral: true,
      });
    }
  },

  settings: {
    module: "fun",
  },
};

module.exports = bannerCommand;
