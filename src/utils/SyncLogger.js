const { EmbedBuilder, ChannelType } = require("discord.js");
const dayjs = require("dayjs");
require("dayjs/locale/fr");
dayjs.locale("fr");

/**
 * Module de logs avancés pour la synchronisation API
 * Affiche des embeds visuels et des statistiques de sync
 */
class SyncLogger {
  constructor(client, syncAPI) {
    this.client = client;
    this.syncAPI = syncAPI;
    this.logger = client.getLogger?.();
    this.syncStartTime = Date.now();
    this.syncStats = {
      total: 0,
      synced: 0,
      failed: 0,
      nickChanged: 0,
      roleAdded: 0,
      errors: [],
    };
  }

  /**
   * Log de synchronisation réussie
   */
  async logSyncSuccess(userId, userData, changes = {}) {
    this.syncStats.synced++;

    if (changes.nickname) this.syncStats.nickChanged++;
    if (changes.role) this.syncStats.roleAdded++;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`✅ Synchronisation Réussie`)
      .setDescription(`${userData?.firstName || userId}`)
      .addFields(
        { name: "🆔 Discord ID", value: `\`${userId}\``, inline: true },
        { name: "🎮 Job", value: userData?.jobName || "N/A", inline: true },
        {
          name: "💰 Cash",
          value: `$${(userData?.cash || 0).toLocaleString("fr")}`,
          inline: true,
        },
        {
          name: "🏦 Bank",
          value: `$${(userData?.bank || 0).toLocaleString("fr")}`,
          inline: true,
        },
      );

    if (changes.nickname) {
      embed.addFields({
        name: "📝 Pseudo changé",
        value: `\`${changes.nickname}\``,
        inline: false,
      });
    }

    if (changes.role) {
      embed.addFields({
        name: "🎭 Rôle assigné",
        value: changes.role,
        inline: false,
      });
    }

    embed.setFooter({ text: "Sync API • Kobralost-RP" }).setTimestamp();

    await this._sendLogEmbed(embed, false); // ✅ GARDER les logs de sync réussie

    // Enregistrer dans la DB
    await this._saveSyncLog("success", userId, userData, changes);
  }

  /**
   * Log de synchronisation échouée
   */
  async logSyncFailed(userId, reason = "Erreur inconnue") {
    this.syncStats.failed++;
    this.syncStats.errors.push({ userId, reason, time: new Date() });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`❌ Synchronisation Échouée`)
      .setDescription(`User: <@${userId}>`)
      .addFields(
        { name: "🔴 Raison", value: reason, inline: false },
        { name: "⏰ Heure", value: dayjs().format("HH:mm:ss"), inline: true },
      )
      .setFooter({ text: "Sync API • Kobralost-RP" })
      .setTimestamp();

    await this._sendLogEmbed(embed, true);

    // Enregistrer dans la DB
    await this._saveSyncLog("failed", userId, {}, { reason });
  }

  /**
   * Log de statut de la synchronisation
   */
  async logSyncStatus(startTime = null) {
    const duration = startTime
      ? Date.now() - startTime
      : Date.now() - this.syncStartTime;
    const durationSeconds = Math.floor(duration / 1000);

    const successRate =
      this.syncStats.total > 0
        ? Math.round((this.syncStats.synced / this.syncStats.total) * 100)
        : 0;

    const embed = new EmbedBuilder()
      .setColor(
        successRate > 80 ? 0x00ff00 : successRate > 50 ? 0xffff00 : 0xff0000,
      )
      .setTitle(`📊 Rapport de Synchronisation`)
      .setThumbnail(this.client.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: "📈 Total traité",
          value: `\`${this.syncStats.total}\` joueurs`,
          inline: true,
        },
        {
          name: "✅ Réussi",
          value: `\`${this.syncStats.synced}\` (${successRate}%)`,
          inline: true,
        },
        {
          name: "❌ Échoué",
          value: `\`${this.syncStats.failed}\``,
          inline: true,
        },
        {
          name: "📝 Pseudos changés",
          value: `\`${this.syncStats.nickChanged}\``,
          inline: true,
        },
        {
          name: "🎭 Rôles assignés",
          value: `\`${this.syncStats.roleAdded}\``,
          inline: true,
        },
        { name: "⏱️ Durée", value: `\`${durationSeconds}s\``, inline: true },
      )
      .setFooter({ text: "🤖 KobraBot • Sync API" })
      .setTimestamp();

    // Ajouter les erreurs si présents
    if (this.syncStats.errors.length > 0 && this.syncStats.errors.length <= 5) {
      const errorList = this.syncStats.errors
        .slice(0, 5)
        .map((e) => `• <@${e.userId}>: ${e.reason}`)
        .join("\n");

      embed.addFields({
        name: "⚠️ Erreurs Récentes",
        value: errorList || "Aucune",
        inline: false,
      });
    }

    await this._sendLogEmbed(embed, false); // Garde le message
  }

  /**
   * Log du démarrage de synchronisation
   */
  async logSyncStart(totalPlayers) {
    this.syncStartTime = Date.now();
    this.syncStats = {
      total: totalPlayers,
      synced: 0,
      failed: 0,
      nickChanged: 0,
      roleAdded: 0,
      errors: [],
    };

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`🚀 Synchronisation Démarrée`)
      .setDescription(`Sync API Kobralost-RP en cours...`)
      .addFields(
        {
          name: "👥 Joueurs à traiter",
          value: `\`${totalPlayers}\``,
          inline: true,
        },
        { name: "⏳ Statut", value: "**En cours...**", inline: true },
        { name: "🕐 Heure", value: dayjs().format("HH:mm:ss"), inline: true },
      )
      .setFooter({ text: "🤖 KobraBot • Sync API" })
      .setTimestamp();

    await this._sendLogEmbed(embed, false);
  }

  /**
   * Log d'information
   */
  async logInfo(title, description, color = 0x0099ff) {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: "🤖 KobraBot • Sync API" })
      .setTimestamp();

    await this._sendLogEmbed(embed, true);
  }

  /**
   * Log d'erreur
   */
  async logError(title, error) {
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(title)
      .setDescription(```\n${error.toString().substring(0, 1024)}\n```)
      .setFooter({ text: "🤖 KobraBot • Sync API" })
      .setTimestamp();

    await this._sendLogEmbed(embed, true);
    this.logger?.error(`[SYNC] ${title}: ${error.message}`);
  }

  /**
   * Statistiques détaillées de la session
   */
  async logSessionStats() {
    const duration = Date.now() - this.syncStartTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    const successRate =
      this.syncStats.total > 0
        ? Math.round((this.syncStats.synced / this.syncStats.total) * 100)
        : 0;

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`📋 Statistiques de Session`)
      .setThumbnail(this.client.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: "⏰ Durée totale",
          value: `\`${minutes}m ${seconds}s\``,
          inline: true,
        },
        {
          name: "📊 Taux de réussite",
          value: `\`${successRate}%\``,
          inline: true,
        },
        {
          name: "✅ Réussis",
          value: `\`${this.syncStats.synced}/${this.syncStats.total}\``,
          inline: true,
        },
        {
          name: "❌ Échoués",
          value: `\`${this.syncStats.failed}\``,
          inline: true,
        },
        {
          name: "📝 Pseudos changés",
          value: `\`${this.syncStats.nickChanged}\``,
          inline: true,
        },
        {
          name: "🎭 Rôles attribués",
          value: `\`${this.syncStats.roleAdded}\``,
          inline: true,
        },
        {
          name: "🚀 Vitesse moyenne",
          value: `\`${(this.syncStats.synced / (duration / 1000)).toFixed(2)}\` joueurs/sec`,
          inline: true,
        },
        {
          name: "💾 Erreurs",
          value: `\`${this.syncStats.errors.length}\``,
          inline: true,
        },
      )
      .setFooter({ text: "Session terminée • 🤖 KobraBot • Sync API" })
      .setTimestamp();

    await this._sendLogEmbed(embed, false);
  }

  /**
   * Envoie un embed dans le salon de logs
   */
  async _sendLogEmbed(embed, autoDelete = false) {
    try {
      const syncChannelId =
        process.env.SYNC_CHANNEL_ID || process.env.SYNC_LOG_CHANNEL_ID;
      if (!syncChannelId) return;

      const guild = this.client.guilds.cache.first();
      if (!guild) return;

      const channel = await guild.channels
        .fetch(syncChannelId)
        .catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) return;

      const msg = await channel.send({ embeds: [embed] }).catch(() => null);
      return msg;
    } catch (error) {
      this.logger?.error(`[SyncLogger] Erreur envoi embed: ${error.message}`);
    }
  }

  /**
   * Enregistre une synchronisation dans la DB
   */
  async _saveSyncLog(status, userId, userData = {}, changes = {}) {
    try {
      const database = require("../database/database").database;
      if (!database) return;

      // Créer la table si nécessaire
      await database.schema
        .createTableIfNotExists("SyncLogs", (table) => {
          table.increments("id").primary();
          table.string("userId", 255).unique().nullable().index();
          table.string("rpName", 255).nullable();
          table.string("status", 20).notNullable(); // success, failed
          table.string("reason", 500).nullable();
          table.json("changes").nullable();
          table.timestamp("createdAt").defaultTo(database.fn.now());
        })
        .catch(() => {});

      // Insérer le log
      await database("SyncLogs")
        .insert({
          userId,
          rpName: userData?.firstName || null,
          status,
          reason: changes?.reason || null,
          changes: JSON.stringify({
            nickname: changes?.nickname,
            role: changes?.role,
            cash: userData?.cash,
            bank: userData?.bank,
          }),
          createdAt: new Date(),
        })
        .catch((err) => {
          this.logger?.send(`[SyncLogger] Erreur DB: ${err.message}`, "SYNCHRONISATION");
        });

      this.logger?.send(
        `[SyncLogger] Sync enregistrée - ${userId} (${status})`,
        "SYNCHRONISATION",
      );
    } catch (error) {
      this.logger?.send(
        `[SyncLogger] Erreur save log: ${error.message}`,
        "SYNCHRONISATION",
      );
    }
  }
}

module.exports = SyncLogger;

