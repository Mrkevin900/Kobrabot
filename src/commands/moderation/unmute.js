const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  InteractionContextType,
} = require("discord.js");

const unmute = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("\u2728 Redonne la parole à un utilisateur")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("\u2728 L'utilisateur à rendre la parole")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("raison")
        .setDescription("\u2728 Raison du unmute")
        .setRequired(false),
    ),

  async executeCommand(client, interaction) {
    const user = interaction.options.getUser("utilisateur");
    const raison =
      interaction.options.getString("raison") || "Aucune raison fournie";
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({
        content: "❌ Membre introuvable.",
        ephemeral: true,
      });
    }

    try {
      await member.timeout(null, raison);

      const embed = new EmbedBuilder()
        .setColor(client.getConfig().embed.readyColor)
        .setTitle("🔊 Utilisateur rétabli")
        .addFields(
          { name: "👤 Utilisateur", value: user.toString(), inline: true },
          { name: "📝 Raison", value: raison, inline: false },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      return interaction.reply({
        content: "❌ Erreur lors du unmute.",
        ephemeral: true,
      });
    }
  },

  settings: {
    module: "module_mo",
    enabled: true,
  },
};

module.exports = { default: unmute };


