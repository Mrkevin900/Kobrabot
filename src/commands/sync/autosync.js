const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");

function syncEveryMinutes() {
  return Math.max(1, parseInt(process.env.SYNC_INTERVAL_MINUTES || "30", 10));
}

const autosync = {
  data: new SlashCommandBuilder()
    .setName("autosync")
    .setDescription("Gestion de la synchronisation automatique")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async executeCommand(client, interaction) {
    const syncAPI = client.syncAPI;
    const mascot = client.mascot("\u{1F497}");
    if (!syncAPI) {
      return interaction.reply({
        content: "Systeme de sync non charge.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const every = syncEveryMinutes();
    const embed = new EmbedBuilder()
      .setTitle(`${mascot} ${client.emoji("refresh", "\u{1F504}")} Synchronisation automatique`)
      .setDescription(
        "Le systeme de synchronisation maintient automatiquement les pseudos RP et les roles des membres.\n\n" +
          "Fonctionnalites actives:\n" +
          `- Sync automatique toutes les ${every} minutes\n` +
          "- Queue de pseudos intelligente\n" +
          "- Sync lente membre par membre\n" +
          "- Conservation des logs"
      )
      .setColor(0x0099ff)
      .setFooter({ text: "Synchronisation KobraBot x Kobralost" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("autosync.force_now")
        .setLabel("Forcer maintenant")
        .setStyle(ButtonStyle.Success)
        .setEmoji(client.emoji("force", "\u{1F680}")),
      new ButtonBuilder()
        .setCustomId("autosync.status")
        .setLabel("Voir le statut")
        .setStyle(ButtonStyle.Primary)
        .setEmoji(client.emoji("status", "\u{1F50D}")),
      new ButtonBuilder()
        .setCustomId("autosync.stats")
        .setLabel("Statistiques")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(client.emoji("stats", "\u{1F4CA}"))
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },

  async execButtons(client, interaction, buttonId) {
    const syncAPI = client.syncAPI;
    const mascot = client.mascot("\u{1F497}");
    if (!syncAPI) {
      return interaction.reply({
        content: "Systeme de sync non charge.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (buttonId === "force_now") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      client
        .getLogger()
        ?.send("[AUTOSYNC] Force sync lancee par " + interaction.user.username, "INFO");

      const result = await syncAPI.forceSyncAllMembers("commande_autosync");

      if (!result.success) {
        return interaction.editReply(`Erreur: ${result.error}`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`${mascot} ${client.emoji("force", "\u{1F680}")} Synchronisation forcee terminee`)
        .setDescription(
          `Resultats:\n` +
            `- Reussis: ${result.synced}/${result.total} (${result.rate}%)\n` +
            `- Echoues: ${result.failed}\n` +
            `- Duree: ${result.duration}s`
        )
        .setColor(
          result.rate >= 80
            ? 0x00ff00
            : result.rate >= 50
              ? 0xffaa00
              : 0xff0000
        )
        .setFooter({ text: "Synchronisation KobraBot x Kobralost" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (buttonId === "status") {
      const embed = new EmbedBuilder()
        .setTitle(`${mascot} ${client.emoji("status", "\u{1F50D}")} Statut de la synchronisation`)
        .setColor(0x0099ff)
        .setTimestamp()
        .addFields([
          {
            name: "File d'attente pseudos",
            value: `En attente: ${syncAPI._nick_queue?.length || 0} pseudos`,
            inline: true,
          },
          {
            name: "Syncs en cours",
            value: `Actives: ${syncAPI._sync_in_progress?.size || 0}`,
            inline: true,
          },
          {
            name: "Systeme",
            value: syncAPI._started ? "Actif" : "Inactif",
            inline: true,
          },
        ])
        .setFooter({ text: "Synchronisation KobraBot x Kobralost" });

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (buttonId === "stats") {
      const every = syncEveryMinutes();
      const embed = new EmbedBuilder()
        .setTitle(`${mascot} ${client.emoji("stats", "\u{1F4CA}")} Statistiques de synchronisation`)
        .setDescription("Statistiques en temps reel du systeme de synchronisation.")
        .setColor(0x0099ff)
        .addFields([
          {
            name: "Sync auto",
            value: `Synchronisation automatique toutes les ${every} minutes`,
            inline: false,
          },
          {
            name: "Queue de pseudos",
            value: `Batch: ${process.env.NICK_BATCH_SIZE || 5} pseudos toutes les ${process.env.NICK_WINDOW_SECONDS || 30}s`,
            inline: false,
          },
          {
            name: "Sync lente",
            value: `Intervalle: ${process.env.SLOW_SYNC_MEMBER_INTERVAL || 60}s entre membres\nCycle complet: ${(parseInt(process.env.SLOW_SYNC_FULL_CYCLE_INTERVAL || 86400) / 3600).toFixed(1)}h`,
            inline: false,
          },
        ])
        .setFooter({ text: "Synchronisation KobraBot x Kobralost" })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: autosync };
