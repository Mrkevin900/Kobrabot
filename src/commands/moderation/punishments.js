const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");

const punishments = {
  data: new SlashCommandBuilder()
    .setName("punishments")
    .setDescription("\u2728 📋 Affiche les sanctions d'un joueur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName("membre")
        .setDescription("\u2728 Membre à vérifier")
        .setRequired(true),
    ),

  async executeCommand(client, interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const KobralostAPI = require("../../utils/KobralostAPI");
    const api = new KobralostAPI(client);

    const member = interaction.options.getUser("membre");
    if (!member) {
      return interaction.editReply("❌ Membre introuvable.");
    }

    const result = await api.getPunishments(member.id);

    if (!result.success) {
      return interaction.editReply({
        content: `❌ Impossible de récupérer les sanctions.\n\n**Erreur:** ${result.error}`,
      });
    }

    const punishments = result.data;

    const embed = new EmbedBuilder()
      .setTitle(`📋 Sanctions de ${member.username}`)
      .setThumbnail(member.displayAvatarURL({ size: 128 }))
      .setColor(0xff5555)
      .setTimestamp();

    if (
      !punishments ||
      !Array.isArray(punishments) ||
      punishments.length === 0
    ) {
      embed.setDescription("\u2728 ✅ Aucune sanction enregistrée.");
      embed.setColor(0x00ff00);
      return interaction.editReply({ embeds: [embed] });
    }

    const warnings = punishments.filter(
      (p) => p.type === "warning" || p.type === "warn",
    );
    const bans = punishments.filter((p) => p.type === "ban");
    const kicks = punishments.filter((p) => p.type === "kick");
    const mutes = punishments.filter((p) => p.type === "mute");

    embed.setDescription(`**Total:** ${punishments.length} sanction(s)`);

    if (warnings.length > 0) {
      embed.addFields({
        name: `⚠️ Avertissements (${warnings.length})`,
        value:
          warnings
            .slice(0, 3)
            .map(
              (w, i) =>
                `${i + 1}. ${w.reason || "Aucune raison"} - <t:${Math.floor(new Date(w.date).getTime() / 1000)}:R>`,
            )
            .join("\n") +
          (warnings.length > 3
            ? `\n... et ${warnings.length - 3} autre(s)`
            : ""),
        inline: false,
      });
    }

    if (bans.length > 0) {
      embed.addFields({
        name: `🚫 Bannissements (${bans.length})`,
        value:
          bans
            .slice(0, 3)
            .map(
              (b, i) =>
                `${i + 1}. ${b.reason || "Aucune raison"} - <t:${Math.floor(new Date(b.date).getTime() / 1000)}:R>`,
            )
            .join("\n") +
          (bans.length > 3 ? `\n... et ${bans.length - 3} autre(s)` : ""),
        inline: false,
      });
    }

    if (kicks.length > 0) {
      embed.addFields({
        name: `👢 Expulsions (${kicks.length})`,
        value: `${kicks.length} expulsion(s)`,
        inline: true,
      });
    }

    if (mutes.length > 0) {
      embed.addFields({
        name: `🔇 Mutes (${mutes.length})`,
        value: `${mutes.length} mute(s)`,
        inline: true,
      });
    }

    const activeBans = bans.filter((b) => b.active || !b.expired);
    if (activeBans.length > 0) {
      embed.addFields({
        name: "🔴 Statut",
        value: `**${activeBans.length} ban(s) actif(s)**`,
        inline: false,
      });
      embed.setColor(0xff0000);
    }

    embed.setFooter({ text: `ID: ${member.id}` });

    return interaction.editReply({ embeds: [embed] });
  },

  settings: {
    module: "moderation",
    enabled: true,
  },
};

module.exports = { default: punishments };



