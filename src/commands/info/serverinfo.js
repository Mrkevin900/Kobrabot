const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require("discord.js");

const serverinfo = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("✨ Affiche les informations du serveur")
    .setContexts(InteractionContextType.Guild),

  async executeCommand(client, interaction) {
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setColor(client.getConfig().embed.readyColor)
      .setTitle(`Informations - ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
      .addFields(
        { name: `${client.emoji("status", "\u{1F194}")} ID`, value: `\`${guild.id}\``, inline: true },
        { name: `${client.emoji("transfer", "\u{1F451}")} Proprietaire`, value: `<@${guild.ownerId}>`, inline: true },
        { name: `${client.emoji("status", "\u{1F4C5}")} Cree`, value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false },
        { name: `${client.emoji("party", "\u{1F465}")} Membres`, value: `${guild.memberCount}`, inline: true },
        { name: `${client.emoji("stats", "\u{1F3AD}")} Roles`, value: `${guild.roles.cache.size}`, inline: true },
        { name: `${client.emoji("status", "\u{1F4AC}")} Salons`, value: `${guild.channels.cache.size}`, inline: true },
        { name: `${client.emoji("force", "\u{1F680}")} Niveau`, value: `${guild.premiumTier}`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  settings: {
    module: "info",
    enabled: true,
  },
};

module.exports = { default: serverinfo };
