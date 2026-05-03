const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  InteractionContextType,
} = require("discord.js");

const mute = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("\u2728 Rend muet un utilisateur")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("\u2728 L'utilisateur à rendre muet")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("duree")
        .setDescription("\u2728 Durée du mute (ex: 1h, 30m)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("raison")
        .setDescription("\u2728 Raison du mute")
        .setRequired(false),
    ),

  async executeCommand(client, interaction) {
    const user = interaction.options.getUser("utilisateur");
    const duree = interaction.options.getString("duree");
    const raison =
      interaction.options.getString("raison") || "Aucune raison fournie";
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({
        content: "❌ Membre introuvable.",
        ephemeral: true,
      });
    }

    // Parse duration (simple example: 1h -> 3600000ms)
    const durationMs = parseDuration(duree);

    try {
      await member.timeout(durationMs, raison);

      const embed = new EmbedBuilder()
        .setColor(client.getConfig().embed.readyColor)
        .setTitle("🔇 Utilisateur rendu muet")
        .addFields(
          { name: "👤 Utilisateur", value: user.toString(), inline: true },
          { name: "⏱️ Durée", value: duree, inline: true },
          { name: "📝 Raison", value: raison, inline: false },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      if (client.loggerManager) {
        await client.loggerManager.logPunishment(interaction.guild, "Mute", user, interaction.user, raison);
      }
    } catch (error) {
      return interaction.reply({
        content: "❌ Erreur lors du mute.",
        ephemeral: true,
      });
    }
  },

  settings: {
    module: "module_mo",
    enabled: true,
  },
};

function parseDuration(str) {
  const match = str.match(/(\d+)([smh])/);
  if (!match) return 60000; // Default 1 minute
  const [, num, unit] = match;
  const multipliers = { s: 1000, m: 60000, h: 3600000 };
  return parseInt(num) * (multipliers[unit] || 60000);
}

module.exports = { default: mute };


