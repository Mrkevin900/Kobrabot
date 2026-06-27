const { EmbedBuilder } = require("discord.js");
const { getDatabase } = require("../database/database");

class GiveawayWatcher {
  constructor(client) {
    this.client = client;
    this.interval = null;
    this.enabled = true;
    this.tableChecked = false;
  }

  isMissingTableError(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      error?.code === "ER_NO_SUCH_TABLE" ||
      message.includes("doesn't exist") ||
      message.includes("does not exist") ||
      message.includes("unknown table")
    );
  }

  async ensureGiveawayTable() {
    if (this.tableChecked) return this.enabled;
    const db = getDatabase();
    if (!db) {
      this.enabled = false;
      this.tableChecked = true;
      return false;
    }

    try {
      const exists = await db.schema.hasTable("giveaways");
      if (!exists) {
        this.client.getLogger()?.send(
          "[GIVEAWAY_WATCHER] Table 'giveaways' manquante. Désactivation du watcher.",
          "WARN",
        );
        this.enabled = false;
      }
      this.tableChecked = true;
      return exists;
    } catch (error) {
      const message = error?.message || "unknown";
      if (this.isMissingTableError(error)) {
        this.client.getLogger()?.send(
          `[GIVEAWAY_WATCHER] Table 'giveaways' introuvable. Désactivation du watcher.`,
          "WARN",
        );
      } else {
        this.client.getLogger()?.send(
          `[GIVEAWAY_WATCHER] Erreur vérification table giveaways: ${message}`,
          "ERROR",
        );
      }
      this.enabled = false;
      this.tableChecked = true;
      return false;
    }
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => this.checkGiveaways(), 10000); // Check every 10s
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async checkGiveaways() {
    if (!this.enabled && this.tableChecked) return;
    const db = getDatabase();
    if (!db) return;

    if (!(await this.ensureGiveawayTable())) return;

    try {
      // Find all giveaways that ended but aren't marked as ended in DB
      const endedGiveaways = await db("giveaways")
        .where("ends_at", "<=", new Date())
        .where({ ended: false });

      for (const giveaway of endedGiveaways) {
        await this.endGiveaway(giveaway);
      }
    } catch (error) {
      const message = error?.message || "unknown";
      if (this.isMissingTableError(error)) {
        this.client.getLogger()?.send(
          `[GIVEAWAY_WATCHER] Table giveaways indisponible. Désactivation du watcher. (${message})`,
          "WARN",
        );
        this.enabled = false;
        return;
      }
      this.client.getLogger()?.send(`[GIVEAWAY_WATCHER] Error: ${message}`, "ERROR");
    }
  }

  async endGiveaway(giveaway) {
    const db = getDatabase();
    if (!db) return;

    try {
      // Mark as ended first to prevent race condition
      await db("giveaways").where({ id: giveaway.id }).update({ ended: true });

      const channel = await this.client.channels.fetch(giveaway.channel_id).catch(() => null);
      if (!channel) return;

      const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
      if (!message) return;

      let participants = [];
      try {
        participants = typeof giveaway.participants === "string" ? JSON.parse(giveaway.participants) : (giveaway.participants || []);
      } catch (e) {
        participants = [];
      }

      const winnersCount = giveaway.winners_count;
      const winners = [];

      if (participants.length > 0) {
        const shuffled = [...participants].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, winnersCount);
        winners.push(...selected);
      }

      await db("giveaways").where({ id: giveaway.id }).update({
        winners: JSON.stringify(winners)
      });

      // Update embed
      const oldEmbed = message.embeds[0];
      const newEmbed = EmbedBuilder.from(oldEmbed);

      let winnersList = winners.length > 0 ? winners.map(id => `<@${id}>`).join(", ") : "Aucun participant";
      newEmbed.setDescription(
        `🎉 **Tirage au sort terminé !**\n\n` +
        `🏆 **Prix :** \`${giveaway.prize}\`\n\n` +
        `👑 **Gagnant(s) :** ${winnersList}\n\n` +
        `Merci à tous les participants !`
      );
      // Remove button components
      await message.edit({ embeds: [newEmbed], components: [] });

      // Send congrats message
      if (winners.length > 0) {
        await channel.send(`🎉 Félicitations à ${winnersList} qui remporte(nt) **${giveaway.prize}** ! 🎁`);
      } else {
        await channel.send(`ℹ️ Le concours pour **${giveaway.prize}** s'est terminé, mais il n'y a eu aucun participant.`);
      }

    } catch (error) {
      this.client.getLogger()?.send(`[GIVEAWAY_WATCHER] Error ending giveaway ${giveaway.id}: ${error.message}`, "ERROR");
    }
  }
}

module.exports = GiveawayWatcher;
