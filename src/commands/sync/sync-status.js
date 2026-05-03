const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sync-status")
    .setDescription("Affiche l'etat actuel de la synchronisation API")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async executeCommand(client, interaction) {
    await interaction.deferReply();
    const log = client.getLogger?.();
    const mascot = client.mascot("\u{1F497}");

    try {
      const guild = interaction.guild;
      const syncChannelId = process.env.SYNC_CHANNEL_ID;

      if (!syncChannelId) {
        return interaction.editReply({
          content: "Le salon de synchronisation n'est pas configure.",
        });
      }

      const syncChannel = await guild.channels.fetch(syncChannelId).catch(() => null);

      if (!syncChannel || syncChannel.type !== ChannelType.GuildText) {
        return interaction.editReply({
          content: "Le salon de synchronisation specifie n'existe pas ou n'est pas valide.",
        });
      }

      const lastSyncTime = client.syncAPI?.lastSyncTime || new Date();
      const syncedPlayers = client.syncAPI?.syncedPlayers || 0;

      const syncEmbed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle(`${mascot} ${client.emoji("stats", "\u{1F4CA}")} Etat de la synchronisation API`)
        .setDescription("Statut actuel du systeme de synchronisation RP")
        .addFields(
          {
            name: "Statut",
            value: client.syncAPI ? "**Actif et fonctionnel**" : "**Mode manuel**",
            inline: true,
          },
          {
            name: "Derniere synchronisation",
            value: `<t:${Math.floor(lastSyncTime.getTime() / 1000)}:f>`,
            inline: true,
          },
          {
            name: "Joueurs synchronises",
            value: `**${syncedPlayers}** joueur(s)`,
            inline: true,
          },
          {
            name: "Frequence de sync",
            value: process.env.SYNC_INTERVAL_MINUTES
              ? `Toutes les **${process.env.SYNC_INTERVAL_MINUTES}** minutes`
              : "30 minutes (defaut)",
            inline: false,
          },
          {
            name: "Serveur RP",
            value: process.env.SYNC_SERVER_NAME || "Serveur non configure",
            inline: false,
          },
        )
        .setFooter({ text: "KobraBot | Sync Status" })
        .setTimestamp();

      await syncChannel
        .send({
          content: `Rapport de synchronisation - <t:${Math.floor(Date.now() / 1000)}:f>`,
          embeds: [syncEmbed],
        })
        .catch((err) => {
          log?.send(`Impossible d'envoyer le rapport de sync: ${err.message}`, "ERROR");
        });

      const confirmEmbed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle(`${mascot} ${client.emoji("refresh", "\u{1F504}")} Rapport envoye`)
        .setDescription(`Le rapport de synchronisation a ete envoye dans ${syncChannel}`)
        .addFields({
          name: "Informations affichees",
          value: "Statut, derniere sync, joueurs synchronises, frequence",
          inline: false,
        });

      return interaction.editReply({ embeds: [confirmEmbed] });
    } catch (error) {
      log?.send(`Erreur sync-status: ${error.message}`, "ERROR");
      return interaction.editReply({ content: `Erreur: ${error.message}` });
    }
  },

  settings: {
    enabled: true,
    module: "admin",
  },
};
