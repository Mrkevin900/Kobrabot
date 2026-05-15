const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { EmbedBuilder } = require("discord.js");

const DEFAULT_INTERVAL_MINUTES = 30;
const EPIC_URL =
  "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=fr&country=FR&allowCountries=FR";
const STEAM_URL =
  "https://store.steampowered.com/api/featuredcategories?cc=fr&l=french";

class FreeGamesWatcher {
  constructor(client) {
    this.client = client;
    this.logger = client.getLogger?.();
    this.guildId =
      process.env.FREE_GAMES_GUILD_ID || process.env.SYNC_GUILD_ID || "";
    this.channelId = process.env.FREE_GAMES_CHANNEL_ID || "";
    this.mentionRoleId = process.env.FREE_GAMES_PING_ROLE_ID || "";
    this.intervalMinutes = Math.max(
      5,
      parseInt(process.env.FREE_GAMES_CHECK_INTERVAL_MINUTES, 10) ||
        DEFAULT_INTERVAL_MINUTES,
    );
    this.intervalMs = this.intervalMinutes * 60 * 1000;
    this.statePath = path.join(process.cwd(), "data", "free-games-state.json");

    this._started = false;
    this._running = false;
    this._interval = null;
    this.state = { announced: { epic: {}, steam: {} } };
  }

  async init() {
    if (this._started) return;

    if (!this.channelId) {
      this.logger?.send(
        "[FREE_GAMES] FREE_GAMES_CHANNEL_ID manquant: systeme non demarre.",
        "WARN",
      );
      return;
    }

    this._started = true;
    await this._loadState();

    this.logger?.send(
      `[FREE_GAMES] Watcher demarre (intervalle ${this.intervalMinutes} min).`,
      "NOTIF",
    );

    await this._tick();

    this._interval = setInterval(() => {
      this._tick().catch((error) => {
        this.logger?.send(`[FREE_GAMES] Erreur boucle: ${error.message}`, "ERROR");
      });
    }, this.intervalMs);
  }

  cleanup() {
    this._started = false;
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this.logger?.send("[FREE_GAMES] Watcher arrete.", "INFO");
  }

  async _loadState() {
    try {
      if (!fs.existsSync(this.statePath)) {
        await this._saveState();
        return;
      }

      const raw = await fs.promises.readFile(this.statePath, "utf8");
      if (!raw.trim()) {
        this._saveState();
        return;
      }

      const parsed = JSON.parse(raw);
      this.state = {
        announced: {
          epic: parsed?.announced?.epic || {},
          steam: parsed?.announced?.steam || {},
        },
      };
    } catch (error) {
      this.logger?.send(
        `[FREE_GAMES] Impossible de charger l'etat: ${error.message}`,
        "WARN",
      );
      this.state = { announced: { epic: {}, steam: {} } };
    }
  }

  _cleanupOldEntries() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    for (const platform of Object.keys(this.state.announced || {})) {
      if (!this.state.announced[platform]) continue;
      for (const [key, dateStr] of Object.entries(this.state.announced[platform])) {
        const date = new Date(dateStr);
        if (date < thirtyDaysAgo || Number.isNaN(date.getTime())) {
          delete this.state.announced[platform][key];
        }
      }
    }
  }

  async _saveState() {
    this._cleanupOldEntries();
    try {
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.statePath, JSON.stringify(this.state, null, 2), "utf8");
    } catch (error) {
      this.logger?.send(
        `[FREE_GAMES] Impossible de sauvegarder l'etat: ${error.message}`,
        "WARN",
      );
    }
  }

  _alreadyAnnounced(platform, key) {
    return Boolean(this.state?.announced?.[platform]?.[key]);
  }

  _markAnnounced(platform, key) {
    if (!this.state.announced[platform]) this.state.announced[platform] = {};
    this.state.announced[platform][key] = new Date().toISOString();
  }

  _resolveGameUrlEpic(game) {
    const slug =
      game?.productSlug ||
      game?.catalogNs?.mappings?.[0]?.pageSlug ||
      game?.offerMappings?.[0]?.pageSlug;
    if (!slug) return "https://store.epicgames.com/fr/";
    return `https://store.epicgames.com/fr/p/${slug}`;
  }

  _resolveGameImageEpic(game) {
    const images = game?.keyImages || [];
    const preferred = images.find(
      (img) => img?.type === "DieselStoreFrontWide" || img?.type === "OfferImageWide",
    );
    return preferred?.url || images[0]?.url || null;
  }

  async _fetchEpicFreeGames() {
    const now = new Date();
    const response = await axios.get(EPIC_URL, { timeout: 20000 });
    const elements = response?.data?.data?.Catalog?.searchStore?.elements || [];
    const deals = [];

    for (const game of elements) {
      const promoGroups = game?.promotions?.promotionalOffers || [];
      const activePromos = [];

      for (const group of promoGroups) {
        const promos = group?.promotionalOffers || [];
        for (const promo of promos) {
          const start = promo?.startDate ? new Date(promo.startDate) : null;
          const end = promo?.endDate ? new Date(promo.endDate) : null;
          if (!start || !end) continue;
          if (now < start || now > end) continue;
          activePromos.push(promo);
        }
      }

      if (activePromos.length === 0) continue;

      const price = game?.price?.totalPrice || {};
      const originalPrice = Number(price.originalPrice || 0);
      const discountPrice = Number(price.discountPrice ?? originalPrice);
      if (!(originalPrice > 0 && discountPrice === 0)) continue;

      for (const promo of activePromos) {
        deals.push({
          key: `${game.id || game.offerId}:${promo.startDate}`,
          platform: "epic",
          title: game?.title || "Jeu Epic Games",
          url: this._resolveGameUrlEpic(game),
          image: this._resolveGameImageEpic(game),
          startDate: promo.startDate || null,
          endDate: promo.endDate || null,
        });
      }
    }

    return deals;
  }

  async _fetchSteamFreeGames() {
    const response = await axios.get(STEAM_URL, { timeout: 20000 });
    const items = response?.data?.specials?.items || [];
    const deals = [];

    for (const item of items) {
      const finalPrice = Number(item?.final_price);
      const discountPercent = Number(item?.discount_percent);
      const appId = item?.id;
      if (!appId) continue;
      if (!(finalPrice === 0 && discountPercent === 100)) continue;

      const discountExpiration = item?.discount_expiration
        ? new Date(Number(item.discount_expiration) * 1000).toISOString()
        : null;

      deals.push({
        key: `${appId}:${discountExpiration || "no-expiry"}`,
        platform: "steam",
        title: item?.name || "Jeu Steam",
        url: `https://store.steampowered.com/app/${appId}`,
        image: item?.large_capsule_image || null,
        startDate: null,
        endDate: discountExpiration,
      });
    }

    return deals;
  }

  _formatDate(value) {
    if (!value) return "Inconnue";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Inconnue";
    return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
  }

  _buildEmbed(deal) {
    const isEpic = deal.platform === "epic";
    const color = isEpic ? 0x2d8cff : 0x1b2838;
    const sourceName = isEpic ? "Epic Games" : "Steam";
    const footer = this.client?.getConfig?.()?.embed?.footer || "KobraBot";

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Jeu gratuit detecte sur ${sourceName}`)
      .setDescription(`[${deal.title}](${deal.url})`)
      .addFields(
        { name: "Plateforme", value: sourceName, inline: true },
        { name: "Debut", value: this._formatDate(deal.startDate), inline: true },
        { name: "Fin", value: this._formatDate(deal.endDate), inline: true },
      )
      .setFooter({ text: footer })
      .setTimestamp();

    if (deal.image) embed.setImage(deal.image);
    return embed;
  }

  async _resolveChannel() {
    const guild =
      (this.guildId && this.client.guilds.cache.get(this.guildId)) ||
      this.client.guilds.cache.first();
    if (!guild) return null;

    const cached = guild.channels.cache.get(this.channelId);
    if (cached?.isTextBased?.()) return cached;

    const fetched = await guild.channels.fetch(this.channelId).catch(() => null);
    if (fetched?.isTextBased?.()) return fetched;
    return null;
  }

  _buildMentions() {
    if (this.mentionRoleId) {
      return {
        content: `<@&${this.mentionRoleId}>`,
        allowedMentions: { roles: [this.mentionRoleId] },
      };
    }

    return {
      content: "@everyone",
      allowedMentions: { parse: ["everyone"] },
    };
  }

  async _announceDeal(channel, deal) {
    const mention = this._buildMentions();
    await channel.send({
      content: mention.content,
      allowedMentions: mention.allowedMentions,
      embeds: [this._buildEmbed(deal)],
    });
  }

  async _tick() {
    if (this._running) return;
    this._running = true;

    try {
      const [epicDeals, steamDeals] = await Promise.all([
        this._fetchEpicFreeGames().catch((error) => {
          this.logger?.send(`[FREE_GAMES][EPIC] ${error.message}`, "WARN");
          return [];
        }),
        this._fetchSteamFreeGames().catch((error) => {
          this.logger?.send(`[FREE_GAMES][STEAM] ${error.message}`, "WARN");
          return [];
        }),
      ]);

      const allDeals = [...epicDeals, ...steamDeals];
      const newDeals = allDeals.filter(
        (deal) => !this._alreadyAnnounced(deal.platform, deal.key),
      );

      if (newDeals.length === 0) {
        this.logger?.send("[FREE_GAMES] Aucun nouveau jeu gratuit.", "DEBUG");
        return;
      }

      const channel = await this._resolveChannel();
      if (!channel) {
        this.logger?.send(
          `[FREE_GAMES] Salon introuvable (${this.channelId}).`,
          "WARN",
        );
        return;
      }

      for (const deal of newDeals) {
        await this._announceDeal(channel, deal);
        this._markAnnounced(deal.platform, deal.key);
        this.logger?.send(
          `[FREE_GAMES] Annonce envoyee (${deal.platform}): ${deal.title}`,
          "READY",
        );
      }

      await this._saveState();
    } catch (error) {
      this.logger?.send(`[FREE_GAMES] Erreur interne: ${error.message}`, "ERROR");
    } finally {
      this._running = false;
    }
  }
}

module.exports = FreeGamesWatcher;
