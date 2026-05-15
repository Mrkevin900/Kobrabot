const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sync-report")
    .setDescription("Affiche les statistiques et rapports de synchronisation API")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async executeCommand(client, interaction) {
    await interaction.deferReply();
    const mascot = client.mascot("\u{1F497}");

    try {
      const syncAPI = client.syncAPI;
      const syncLogger = client.syncLogger;

      if (!syncAPI || !syncLogger) {
        return interaction.editReply({
          content: `${client.emoji("blacklist", "\u{274C}")} Systeme de synchronisation non initialise.`,
        });
      }

      const stats = syncLogger.syncStats;
      const duration = Date.now() - syncLogger.syncStartTime;
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      const successRate = stats.total > 0 ? Math.round((stats.synced / stats.total) * 100) : 0;

      let color = 0x00ff00;
      if (successRate < 80) color = 0xffff00;
      if (successRate < 50) color = 0xff5500;
      if (successRate < 20) color = 0xff0000;

      const reportEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${mascot} ${client.emoji("stats", "\u{1F4CA}")} Rapport de Synchronisation API`)
        .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: `${client.emoji("stats", "\u{1F4CA}")} Statistiques globales`,
            value: [
              `Total traite: ${stats.total} joueurs`,
              `Reussis: ${stats.synced} (${successRate}%)`,
              `Echoues: ${stats.failed}`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "Modifications",
            value: [
              `Pseudos changes: ${stats.nickChanged}`,
              `Roles assignes: ${stats.roleAdded}`,
              `Erreurs enregistrees: ${stats.errors.length}`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "Timing",
            value: [
              `Duree: ${minutes}m ${seconds}s`,
              `Vitesse: ${(stats.synced / (duration / 1000)).toFixed(2)} joueurs/sec`,
              `Depuis le demarrage: <t:${Math.floor(syncLogger.syncStartTime / 1000)}:R>`,
            ].join("\n"),
            inline: false,
          },
        )
        .setFooter({ text: "KobraBot - Sync API Kobralost-RP" })
        .setTimestamp();

      if (stats.errors.length > 0) {
        const recentErrors = stats.errors
          .slice(-5)
          .reverse()
          .map((e, i) => `${i + 1}. <@${e.userId}> - ${e.reason}`)
          .join("\n");

        reportEmbed.addFields({
          name: "Erreurs recentes (Top 5)",
          value: recentErrors || "Aucune",
          inline: false,
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("sync_execute_manual")
          .setLabel("Relancer sync")
          .setStyle(ButtonStyle.Primary)
          .setEmoji(client.emoji("refresh", "\u{1F504}")),
        new ButtonBuilder()
          .setCustomId("sync_clear_errors")
          .setLabel("Effacer erreurs")
          .setStyle(ButtonStyle.Danger)
          .setEmoji(client.emoji("trash", "\u{1F5D1}\uFE0F")),
        new ButtonBuilder()
          .setCustomId("sync_reset_stats")
          .setLabel("Reset stats")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(client.emoji("repeat", "\u{1F501}")),
      );

      await interaction.editReply({
        embeds: [reportEmbed],
        components: [row],
      });
    } catch (error) {
      const logger = client.getLogger?.();
      logger?.error(`Erreur sync-report: ${error.message}`);

      return interaction.editReply({
        content: `${client.emoji("blacklist", "\u{274C}")} Erreur: ${error.message}`,
      });
    }
  },

  settings: {
    enabled: true,
    module: "admin",
  },
};
