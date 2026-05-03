const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  InteractionContextType,
} = require("discord.js");

const unban = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("\u2728 Débannit un utilisateur")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((option) =>
      option
        .setName("userid")
        .setDescription("\u2728 L'ID de l'utilisateur à débannir")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("raison")
        .setDescription("\u2728 Raison du débannissement")
        .setRequired(false),
    ),

  async executeCommand(client, interaction) {
    const userId = interaction.options.getString("userid");
    const raison =
      interaction.options.getString("raison") || "Aucune raison fournie";

    try {
      await interaction.guild.bans.remove(userId, raison);

      const embed = new EmbedBuilder()
        .setColor(client.getConfig().embed.readyColor)
        .setTitle("✅ Utilisateur débanni")
        .addFields(
          { name: "👤 Utilisateur ID", value: `\`${userId}\``, inline: true },
          { name: "📝 Raison", value: raison, inline: false },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      return interaction.reply({
        content:
          "❌ Erreur : utilisateur non trouvé dans les bans ou erreur lors du débannissement.",
        ephemeral: true,
      });
    }
  },

  settings: {
    module: "module_mo",
    enabled: true,
  },
};

module.exports = { default: unban };


