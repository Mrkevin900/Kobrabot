const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require("discord.js");

const userinfo = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Affiche les informations d'un utilisateur")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("L'utilisateur a afficher")
        .setRequired(false)
    ),

  async executeCommand(client, interaction) {
    const user = interaction.options.getUser("utilisateur") || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);

    const rolesText = member
      ? member.roles.cache
          .filter((role) => role.id !== interaction.guild.id)
          .map((role) => role.toString())
          .join(", ") || "Aucun"
      : "Utilisateur absent du serveur";

    const safeRolesText = rolesText.length > 1000 ? `${rolesText.slice(0, 997)}...` : rolesText;

    const embed = new EmbedBuilder()
      .setColor(client.getConfig().embed.readyColor)
      .setTitle(`Informations de ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "ID", value: `\`${user.id}\``, inline: true },
        { name: "Pseudo", value: user.username, inline: true },
        { name: "Compte cree", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false },
        {
          name: "A rejoint",
          value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "Inconnu",
          inline: false,
        },
        {
          name: "Boost",
          value: member?.premiumSinceTimestamp
            ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`
            : "Aucun",
          inline: true,
        },
        { name: "Roles", value: safeRolesText, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  settings: {
    module: "info",
    enabled: true,
  },
};

module.exports = { default: userinfo };

