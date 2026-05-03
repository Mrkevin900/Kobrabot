const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType } = require("discord.js");

const avatar = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("\u2728 Affiche l'avatar d'un utilisateur")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("\u2728 L'utilisateur dont afficher l'avatar")
        .setRequired(false)
    ),

  async executeCommand(client, interaction) {
    const user = interaction.options.getUser("utilisateur") || interaction.user;
    const avatar = user.displayAvatarURL({ dynamic: true, size: 4096 });

    const embed = new EmbedBuilder()
      .setColor(client.getConfig().embed.readyColor)
      .setTitle(`Avatar de ${user.username}`)
      .setImage(avatar)
      .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Télécharger")
        .setURL(avatar)
        .setStyle(ButtonStyle.Link)
    );

    await interaction.reply({ embeds: [embed], components: [button] });
  },

  settings: {
    module: "info",
    enabled: true,
  },
};

module.exports = { default: avatar };


