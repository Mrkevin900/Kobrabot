const axios = require("axios");
const https = require("https");
const http = require("http");

class KobralostAPI {
  constructor(client) {
    this.client = client;
    this.logger = client?.getLogger();
    this.baseURL =
      process.env.API_BASE_URL ||
      "https://dashboard.kobralost-rp.com/api/v2/1/836244875720523807";
    this.token = process.env.API_TOKEN || "";
    this.guildId = process.env.SYNC_GUILD_ID || "";

    this.scopes = [
      "applications.manage",
      "applications.fetch",
      "applications.delete-reply",
      "applications.reply",
      "languages.set",
      "notifications.read",
      "notifications.manage",
      "player.read",
      "player-badges.read",
      "punishments-moderation.read-me",
      "punishments-team.read-me",
      "rules.read",
      "questionnaires.read",
      "player-sessions.read-me",
      "player-sessions.read-all",
      "servers-list.read",
      "calendar_events.read",
      "calendar_events.create",
      "calendar_events.update",
      "calendar_events.delete",
      "sub_accounts.create_fake",
    ];

    this.endpoints = {
      members: "/members",
      player: "/player",
      applications: "/applications",
      notifications: "/notifications",
      punishments: "/punishments",
      badges: "/badges",
      sessions: "/sessions",
      calendar: "/calendar",
      servers: "/servers",
      questionnaires: "/questionnaires",
      rules: "/rules",
      languages: "/languages",
    };

    // Configure agents to force IPv4 as VPS environments sometimes have broken IPv6
    this.httpsAgent = new https.Agent({ family: 4 });
    this.httpAgent = new http.Agent({ family: 4 });
  }

  _buildURL(endpoint) {
    return `${this.baseURL}${endpoint}`;
  }

  _getHeaders(customHeaders = {}) {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "KobraBot/1.0 (Discord Bot; Node.js; VPS-Fix)",
      ...customHeaders,
    };
  }

  async _request(method, endpoint, data = null, retries = 3) {
    const url = this._buildURL(endpoint);
    const config = {
      method,
      url,
      headers: this._getHeaders(),
      timeout: 25000,
      httpsAgent: this.httpsAgent,
      httpAgent: this.httpAgent,
    };

    if (data) {
      if (method === "GET") {
        config.params = data;
      } else {
        config.data = data;
      }
    }

    let attempts = 0;
    while (attempts < retries) {
      try {
        this.logger?.send(`[KOBRALOST_API] 📡 ${method} ${endpoint}`, "DEBUG");

        const response = await axios(config);

        this.logger?.send(
          `[KOBRALOST_API] ✅ ${method} ${endpoint} → ${response.status}`,
          "DEBUG",
        );

        return {
          success: true,
          data: response.data?.data || response.data,
          status: response.status,
          error: null,
        };
      } catch (error) {
        attempts++;

        if (error.response?.status === 429) {
          const retryAfter =
            parseInt(error.response.headers["retry-after"]) || 2;
          const wait = retryAfter * Math.pow(2, attempts - 1);
          this.logger?.send(
            `[KOBRALOST_API] ⏳ Rate limit. Attente ${wait}s (${attempts}/${retries})`,
            "WARN",
          );
          await this._sleep(wait * 1000);
          continue;
        }

        if (error.response?.status === 404) {
          this.logger?.send(
            `[KOBRALOST_API] ❌ ${endpoint} → 404 Not Found`,
            "DEBUG",
          );
          return {
            success: false,
            data: null,
            status: 404,
            error: "Ressource non trouvée",
          };
        }

        if (error.response?.status === 403) {
          this.logger?.send(
            `[KOBRALOST_API] ❌ ${endpoint} → 403 Forbidden (permissions?)`,
            "ERROR",
          );
          return {
            success: false,
            data: null,
            status: 403,
            error: "Accès refusé - Vérifier les permissions API",
          };
        }

        if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
          this.logger?.send(
            `[KOBRALOST_API] ❌ API inaccessible: ${error.message}`,
            "ERROR",
          );
          return {
            success: false,
            data: null,
            status: null,
            error: "API inaccessible",
          };
        }

        if (attempts < retries) {
          this.logger?.send(
            `[KOBRALOST_API] ⚠️ Erreur, nouvelle tentative (${attempts}/${retries})...`,
            "WARN",
          );
          await this._sleep(2000 * attempts);
          continue;
        }

        this.logger?.send(
          `[KOBRALOST_API] ❌ Erreur finale: ${error.message}`,
          "ERROR",
        );
        this.logger?.send(`[KOBRALOST_API] Stack: ${error.stack}`, "ERROR");

        return {
          success: false,
          data: null,
          status: error.response?.status,
          error: error.message,
        };
      }
    }

    return {
      success: false,
      data: null,
      status: null,
      error: "Échecs multiples",
    };
  }

  async getMember(userId) {
    return await this._request("GET", `${this.endpoints.members}/${userId}`);
  }

  async getPlayer(userId) {
    return await this._request("GET", `${this.endpoints.player}/${userId}`);
  }

  async getApplications(filters = {}) {
    return await this._request("GET", this.endpoints.applications, filters);
  }

  async getApplication(applicationId) {
    return await this._request(
      "GET",
      `${this.endpoints.applications}/${applicationId}`,
    );
  }

  async replyToApplication(applicationId, reply, status = "accepted") {
    return await this._request(
      "POST",
      `${this.endpoints.applications}/${applicationId}/reply`,
      {
        reply,
        status,
      },
    );
  }

  async deleteApplicationReply(applicationId) {
    return await this._request(
      "DELETE",
      `${this.endpoints.applications}/${applicationId}/reply`,
    );
  }

  async getNotifications(userId) {
    return await this._request(
      "GET",
      `${this.endpoints.notifications}/${userId}`,
    );
  }

  async markNotificationAsRead(notificationId) {
    return await this._request(
      "POST",
      `${this.endpoints.notifications}/${notificationId}/read`,
    );
  }

  async deleteNotification(notificationId) {
    return await this._request(
      "DELETE",
      `${this.endpoints.notifications}/${notificationId}`,
    );
  }

  async getPunishments(userId) {
    return await this._request(
      "GET",
      `${this.endpoints.punishments}/${userId}`,
    );
  }

  async getMyPunishments(userId) {
    return await this._request("GET", `${this.endpoints.punishments}/me`, {
      user_id: userId,
    });
  }

  async getPlayerBadges(userId) {
    return await this._request("GET", `${this.endpoints.badges}/${userId}`);
  }

  async getPlayerSessions(userId) {
    return await this._request("GET", `${this.endpoints.sessions}/${userId}`);
  }

  async getAllPlayerSessions() {
    return await this._request("GET", `${this.endpoints.sessions}/all`);
  }

  async getCalendarEvents(filters = {}) {
    return await this._request("GET", this.endpoints.calendar, filters);
  }

  async createCalendarEvent(eventData) {
    return await this._request("POST", this.endpoints.calendar, eventData);
  }

  async updateCalendarEvent(eventId, eventData) {
    return await this._request(
      "PUT",
      `${this.endpoints.calendar}/${eventId}`,
      eventData,
    );
  }

  async deleteCalendarEvent(eventId) {
    return await this._request(
      "DELETE",
      `${this.endpoints.calendar}/${eventId}`,
    );
  }

  async getServersList() {
    return await this._request("GET", this.endpoints.servers);
  }

  async getQuestionnaires(userId) {
    return await this._request(
      "GET",
      `${this.endpoints.questionnaires}/${userId}`,
    );
  }

  async getRules() {
    return await this._request("GET", this.endpoints.rules);
  }

  async setPlayerLanguage(userId, language) {
    return await this._request(
      "POST",
      `${this.endpoints.languages}/${userId}`,
      {
        language,
      },
    );
  }

  async createFakeSubAccount(userId, accountData) {
    return await this._request(
      "POST",
      `/sub_accounts/${userId}/fake`,
      accountData,
    );
  }

  async testConnection() {
    try {
      this.logger?.send(
        "[KOBRALOST_API] 🔍 Test de connexion à l'API...",
        "INFO",
      );

      const result = await this._request("GET", "/");

      if (result.success) {
        this.logger?.send("[KOBRALOST_API] ✅ Connexion API réussie", "READY");
        return true;
      } else {
        this.logger?.send(
          `[KOBRALOST_API] ❌ Échec connexion: ${result.error}`,
          "ERROR",
        );
        return false;
      }
    } catch (error) {
      this.logger?.send(
        `[KOBRALOST_API] ❌ Erreur test connexion: ${error.message}`,
        "ERROR",
      );
      return false;
    }
  }

  async checkPermissions() {
    const results = {
      available: [],
      unavailable: [],
      tested: 0,
    };

    this.logger?.send(
      "[KOBRALOST_API] 🔍 Vérification des permissions API...",
      "INFO",
    );

    const tests = [
      { name: "applications.fetch", test: () => this.getApplications() },
      { name: "notifications.read", test: () => this.getNotifications("test") },
      { name: "player.read", test: () => this.getPlayer("test") },
      { name: "rules.read", test: () => this.getRules() },
      { name: "servers-list.read", test: () => this.getServersList() },
      { name: "calendar_events.read", test: () => this.getCalendarEvents() },
    ];

    for (const { name, test } of tests) {
      try {
        const result = await test();
        results.tested++;

        if (result.success || result.status !== 403) {
          results.available.push(name);
        } else {
          results.unavailable.push(name);
        }
      } catch (error) {
        results.unavailable.push(name);
      }

      await this._sleep(500);
    }

    this.logger?.send(
      `[KOBRALOST_API] ✅ Permissions testées: ${results.available.length}/${results.tested} disponibles`,
      "INFO",
    );

    return results;
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getAvailableScopes() {
    return this.scopes;
  }

  isConfigured() {
    return !!(this.baseURL && this.token && this.guildId);
  }
}

module.exports = KobralostAPI;
