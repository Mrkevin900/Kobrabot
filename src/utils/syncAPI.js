const {
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");
const axios = require("axios");
const dayjs = require("dayjs");

// Configuration depuis .env
const API_BASE = process.env.API_BASE_URL || "";
const API_TOKEN = process.env.API_TOKEN || "";
const SYNC_GUILD_ID = process.env.SYNC_GUILD_ID || "";
const SYNC_CHANNEL_ID = process.env.SYNC_CHANNEL_ID || "";
const SYNC_LOG_CHANNEL_ID = process.env.SYNC_LOG_CHANNEL_ID || "";
const SYNC_NOTIF_CHANNEL_ID = process.env.SYNC_NOTIF_CHANNEL_ID || "";
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID || "";

const API_DELAY_S = parseFloat(process.env.API_DELAY_SECONDS) || 0.5;
const ROLE_DELAY_S = parseFloat(process.env.ROLE_DELAY_SECONDS) || 1;
const NICK_BATCH = parseInt(process.env.NICK_BATCH_SIZE) || 5;
const NICK_WINDOW = parseInt(process.env.NICK_WINDOW_SECONDS) || 30;
const SLOW_SYNC_INTERVAL =
  parseInt(process.env.SLOW_SYNC_MEMBER_INTERVAL) || 60;
const SLOW_SYNC_CYCLE =
  parseInt(process.env.SLOW_SYNC_FULL_CYCLE_INTERVAL) || 86400;
const AUTO_SYNC_INTERVAL_MINUTES =
  Math.max(1, parseInt(process.env.SYNC_INTERVAL_MINUTES, 10) || 30);
const AUTO_SYNC_INTERVAL_MS = AUTO_SYNC_INTERVAL_MINUTES * 60 * 1000;

// Mapping des roles API -> Discord
// Priorite:
// 1) ROLE_MAP_JSON dans .env (JSON object)
// 2) mapping par defaut (repris du systeme qui fonctionne cote Python)
const { ROLE_MAPPINGS: DEFAULT_ROLE_MAP } = require("../settings/mappings");

function parseRoleMapFromEnv() {
  const raw = process.env.ROLE_MAP_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!k || !v) continue;
      out[String(k)] = String(v);
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

const ROLE_MAP = parseRoleMapFromEnv() || DEFAULT_ROLE_MAP;

// Role d'exclusion (Admin ne sera pas synchronise automatiquement)
const EXCLUDE_FROM_AUTO_ROLE_ID =
  process.env.ADMIN_ROLE_ID || "1438996721593225346";

// Roles speciaux pour les vocaux
const KOBRABOT_ROLE_ID = "1304778382889713715";
const AMIS_ROLE_ID = "1418276360706719844";

class SyncAPI {
  constructor(client) {
    this.client = client;
    this.logger = client.getLogger?.();
    this._nick_queue = [];
    this._nick_pending = new Map();
    this._nick_source = new Map();
    this._sync_in_progress = new Set();
    this._nick_task = null;
    this._slow_sync_task = null;
    this._cleanup_task = null;
    this._auto_sync_task = null; // Auto-sync interval
    this._api_fetch_in_progress = new Map();
    this._started = false;
  }

  async init() {
    if (this._started) return;
    this._started = true;
    this.logger?.send(
      "[SYNC] Initialisation du systeme de synchronisation API...",
      "INFO",
    );

    // Demarrage des boucles
    if (!this._nick_task || this._nick_task.isFulfilled?.()) {
      this._nick_task = this._nick_worker();
    }
    if (!this._slow_sync_task || this._slow_sync_task.isFulfilled?.()) {
      this._slow_sync_task = this._slow_member_sync();
    }
    if (!this._auto_sync_task || this._auto_sync_task.isFulfilled?.()) {
      this._auto_sync_task = this._auto_hourly_sync();
    }

    this.logger?.send(
      `[SYNC] Tasks demarrees (queue nicknames, sync lente, auto-sync ${AUTO_SYNC_INTERVAL_MINUTES} min).`,
      "NOTIF",
    );
  }

  async cleanup() {
    this._started = false;
    this.logger?.send("[SYNC] Arret des tasks de synchronisation.", "INFO");
  }

  // ===========================
  // [OK] NORMALIZATION
  // ===========================
  _normalize(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’'`]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .toLowerCase()
      .trim();
  }

  _normalize_role_name(str) {
    const stopwords = new Set(["de", "du", "des", "la", "le", "les", "d", "l", "et"]);
    return this._normalize(str)
      .split(/\s+/)
      .filter((token) => token && !stopwords.has(token))
      .join(" ");
  }

  _is_commissaire_variant(str) {
    const norm = this._normalize_role_name(str);
    return (
      norm.includes("commissaire") ||
      norm.includes("comissaire") ||
      norm.includes("comisere")
    );
  }

  _buildMemberUrl(userId) {
    let base = String(API_BASE || "").replace(/\/+$/, "");
    if (!base) return "";

    // If the base URL is the token-based one, use it as is
    if (base.includes("/tokens/")) {
      return `${base}/members/${userId}`;
    }

    // If it's already a V2 guild-level URL, ensure it ends with /members/:userId
    if (base.includes("/api/v2/") && base.split("/").length >= 7) {
        if (!base.endsWith("/members")) {
            return `${base}/members/${userId}`;
        }
        return `${base}/${userId}`;
    }

    // Standard fallback (Legacy or auto-completion)
    if (base.endsWith("/members")) {
      return `${base}/${userId}`;
    }

    return `${base}/members/${userId}`;
  }

  _formatMemberLabel(userId) {
    for (const guild of this.client?.guilds?.cache?.values?.() || []) {
      const member = guild?.members?.cache?.get(userId);
      if (member?.user) {
        return member.displayName || member.user.username;
      }
    }
    return String(userId);
  }

  // ===========================
  // [OK] FETCH API
  // ===========================

  async fetchUserData(userId) {
    const key = String(userId);
    const pending = this._api_fetch_in_progress.get(key);
    if (pending) {
      return pending;
    }

    const request = this._fetchUserDataUncached(key).finally(() => {
      this._api_fetch_in_progress.delete(key);
    });
    this._api_fetch_in_progress.set(key, request);
    return request;
  }

  async _fetchUserDataUncached(userId) {
    if (!API_BASE || !API_TOKEN) {
      this.logger?.send(
        "[API] [ERR] API_BASE ou API_TOKEN manquant dans .env",
        "ERROR",
      );
      return { data: null, status: null, error: "API non configuree" };
    }

    const url = this._buildMemberUrl(userId);
    const headers = { Authorization: `Bearer ${API_TOKEN}` };
    const memberLabel = this._formatMemberLabel(userId);

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        await this._sleep(API_DELAY_S * 1000);

        this.logger?.send(
          `[API] 📡 Requete API (membre: ${memberLabel}, tentative ${attempts + 1}/${maxAttempts})`,
          "DEBUG",
        );

        const response = await axios.get(url, { headers, timeout: 25000 });
        const data = response.data?.data || response.data;

        this.logger?.send(
          `[API] [OK] Donnees recuperees pour ${memberLabel} | Status: ${response.status}`,
          "DEBUG",
        );
        return { data, status: response.status, error: null };
      } catch (error) {
        attempts++;

        if (error.response?.status === 429) {
          const retryAfter =
            parseInt(error.response.headers["retry-after"]) || 1;
          const wait = retryAfter * Math.pow(2, attempts - 1);
          this.logger?.send(
            `[API] [WAIT] Rate limit pour ${userId}. Attente ${wait}s (tentative ${attempts}/${maxAttempts})`,
            "WARN",
          );
          await this._sleep(wait * 1000);
          continue;
        }

        if (error.response?.status === 404) {
          this.logger?.send(
            `[API] [ERR] Membre ${memberLabel} non trouve (404) sur l'API`,
            "DEBUG",
          );
          return {
            data: null,
            status: 404,
            error: "Membre non trouve sur l'API",
          };
        }

        if (error.code === "ECONNREFUSED") {
          this.logger?.send(
            `[API] [ERR] Connexion refusee a l'API: ${API_BASE}`,
            "ERROR",
          );
          return {
            data: null,
            status: null,
            error: "Connexion refusee par l'API",
          };
        }

        if (error.code === "ETIMEDOUT" || error.code === "ENOTFOUND") {
          this.logger?.send(
            `[API] [ERR] Timeout ou serveur introuvable: ${error.message}`,
            "ERROR",
          );
          return {
            data: null,
            status: null,
            error: "API inaccessible (timeout/introuvable)",
          };
        }

        if (attempts < maxAttempts) {
          this.logger?.send(
            `[API] [WARN] Erreur pour ${userId}, nouvelle tentative dans ${2 * attempts}s...`,
            "WARN",
          );
          await this._sleep(2000 * attempts);
          continue;
        }

        this.logger?.send(
          `[API] [ERR] Erreur finale pour ${userId}: ${error.message}`,
          "ERROR",
        );
        this.logger?.send(`[API] Stack: ${error.stack}`, "ERROR");
        return {
          data: null,
          status: error.response?.status,
          error: error.message,
        };
      }
    }

    return {
      data: null,
      status: null,
      error: "Echecs multiples apres 3 tentatives",
    };
  }

  // ===========================
  // [OK] LOGS AVANCES
  // ===========================

  async logEmbed(
    guild,
    title,
    description,
    color = 0x00bfff,
    autoDelete = false,
  ) {
    const channel = guild.channels.cache.get(SYNC_LOG_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;

    // Prevenir les ghost pings
    description = (description || "")
      .replace(/@everyone/g, "`@everyone`")
      .replace(/@here/g, "`@here`");

    const t = String(title || "");
    const emoji = this.client?.emoji?.("kbrp_emojis", "\u{1F497}") || "\u{1F497}";

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ${t}`)
      .setDescription(description)
      .setColor(color)
      .setFooter({ text: "Synchronisation KobraBot x Kobralost" })
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
    } catch (e) {
      this.logger?.send(`[LOG] Erreur envoi embed: ${e.message}`, "WARN");
    }
  }

  async _cleanup_log_loop() {
    this.logger?.send(
      "[CLEANUP] Desactive: les logs Discord ne sont plus supprimes automatiquement.",
      "INFO",
    );
  }

  // ===========================
  // [OK] QUEUE NICKNAMES
  // ===========================

  enqueueNick(userId, desired, source = "auto") {
    if (!desired) return;
    this._nick_pending.set(userId, desired);
    this._nick_source.set(userId, source);

    if (!this._nick_queue.includes(userId)) {
      this._nick_queue.push(userId);
    }
  }

  async _nick_worker() {
    await this._sleep(1000);

    while (this._started) {
      const startTime = Date.now();
      let processed = 0;

      const guild = this.client.guilds.cache.get(SYNC_GUILD_ID);
      if (!guild) {
        await this._sleep(NICK_WINDOW * 1000);
        continue;
      }

      while (processed < NICK_BATCH && this._nick_queue.length > 0) {
        const elapsed = Date.now() - startTime;
        if (elapsed > NICK_WINDOW * 1000) break;

        const userId = this._nick_queue.shift();
        const desired = this._nick_pending.get(userId);
        const source = this._nick_source.get(userId) || "auto";

        if (!desired) continue;

        try {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (!member) {
            this._nick_pending.delete(userId);
            this._nick_source.delete(userId);
            continue;
          }

          if (this._cannot_modify(member)) {
            this._nick_pending.delete(userId);
            continue;
          }

          const current = member.nickname || member.user.username;
          if (current === desired) {
            this._nick_pending.delete(userId);
            continue;
          }

          await member.setNickname(desired, `Sync API: ${source}`);

          await this.logEmbed(
            guild,
            `[EDIT] Pseudo mis a jour [${source}]`,
            `${member.toString()}\n**Avant:** ${current}\n**Apres:** ${desired}`,
            0x0099ff,
          );

          this._nick_pending.delete(userId);
          this._nick_source.delete(userId);
          processed++;

          await this._sleep(100);
        } catch (e) {
          this.logger?.send(
            `[NICK] Erreur pour ${userId}: ${e.message}`,
            "WARN",
          );
          this._nick_pending.delete(userId);
        }
      }

      const elapsed = Date.now() - startTime;
      const remainingWindow = Math.max(1000, NICK_WINDOW * 1000 - elapsed);
      await this._sleep(remainingWindow);
    }
  }

  // ===========================
  // [OK] SYNC LENTE 1 PAR 1
  // ===========================

  async _slow_member_sync() {
    await this._sleep(2000);

    while (this._started) {
      try {
        const guild = this.client.guilds.cache.get(SYNC_GUILD_ID);
        if (!guild) {
          await this._sleep(SLOW_SYNC_CYCLE * 1000);
          continue;
        }

        const memberRole = guild.roles.cache.get(MEMBER_ROLE_ID);
        if (!memberRole) {
          this.logger?.send(
            `[SLOW_SYNC] Role Membre introuvable (MEMBER_ROLE_ID=${MEMBER_ROLE_ID || "vide"})`,
            "WARN",
          );
          await this._sleep(SLOW_SYNC_CYCLE * 1000);
          continue;
        }

        // Recuperer les membres eligibles
        const eligible = guild.members.cache.filter((m) => {
          if (m.user.bot) return false;
          if (!m.roles.cache.has(memberRole.id)) return false;
          if (this._has_exclude_role(m)) return false;
          if (this._cannot_modify(m)) return false;
          return true;
        });

        if (eligible.size === 0) {
          this.logger?.send(
            "[SLOW_SYNC] Aucun membre eligible. Attente...",
            "DEBUG",
          );
          await this._sleep(SLOW_SYNC_CYCLE * 1000);
          continue;
        }

        this.logger?.send(
          `[SLOW_SYNC] Cycle demarre: ${eligible.size} membres a synchroniser`,
          "NOTIF",
        );

        const members = Array.from(eligible.values());
        members.sort(() => Math.random() - 0.5);

        for (let i = 0; i < members.length && this._started; i++) {
          const member = members[i];

          try {
            const { data, status, error } = await this.fetchUserData(member.id);

            if (data) {
              await this._applySyncFromData(
                member,
                data,
                false,
                "slow_loop",
                false,
              );
              this.logger?.send(
                `[SLOW_SYNC] [OK] ${member.user.username} (${i + 1}/${members.length})`,
                "DEBUG",
              );
            } else {
              this.logger?.send(
                `[SLOW_SYNC] [ERR] ${member.user.username} - Erreur: ${error}`,
                "DEBUG",
              );
            }
          } catch (e) {
            this.logger?.send(
              `[SLOW_SYNC] Erreur pour ${member.id}: ${e.message}`,
              "ERROR",
            );
          }

          await this._sleep(SLOW_SYNC_INTERVAL * 1000);
        }

        this.logger?.send(
          `[SLOW_SYNC] Cycle termine. Attente ${(SLOW_SYNC_CYCLE / 3600).toFixed(1)}h...`,
          "NOTIF",
        );
        await this._sleep(SLOW_SYNC_CYCLE * 1000);
      } catch (e) {
        this.logger?.send(`[SLOW_SYNC] Erreur boucle: ${e.message}`, "ERROR");
        await this._sleep(60000);
      }
    }
  }

  // ===========================
  // AUTO-SYNC PERIODIQUE
  // ===========================

  async _auto_hourly_sync() {
    await this._sleep(5000); // Wait before first cycle

    while (this._started) {
      try {
        const guild = this.client.guilds.cache.get(SYNC_GUILD_ID);
        if (!guild) {
          await this._sleep(AUTO_SYNC_INTERVAL_MS);
          continue;
        }

        const memberRole = guild.roles.cache.get(MEMBER_ROLE_ID);
        if (!memberRole) {
          this.logger?.send(
            `[AUTO_SYNC] Role Membre introuvable (MEMBER_ROLE_ID=${MEMBER_ROLE_ID || "vide"})`,
            "WARN",
          );
          await this._sleep(AUTO_SYNC_INTERVAL_MS);
          continue;
        }

        await guild.members.fetch().catch(() => null);

        // Recuperer tous les membres eligibles
        const members = guild.members.cache.filter((m) => {
          if (m.user.bot) return false;
          if (!m.roles.cache.has(MEMBER_ROLE_ID)) return false;
          if (this._has_exclude_role(m)) return false;
          return true;
        });

        if (members.size === 0) {
          this.logger?.send("[AUTO_SYNC] Aucun membre a synchroniser", "INFO");
          await this._sleep(AUTO_SYNC_INTERVAL_MS);
          continue;
        }

        const startTime = dayjs().format("HH:mm:ss");
        this.logger?.send(
          "[AUTO_SYNC] Synchronisation periodique lancee",
          "NOTIF",
        );
        this.logger?.send(
          `[AUTO_SYNC] ${members.size} membres a synchroniser | Debut: ${startTime}`,
          "INFO",
        );

        const syncStartTime = Date.now();
        let syncSuccess = 0;
        let syncFailed = 0;
        let i = 0;

        // Synchroniser tous les members
        for (const member of members.values()) {
          if (!this._started) break;
          i++;

          try {
            const { data, error } = await this.fetchUserData(member.id);

            if (data) {
              await this._applySyncFromData(
                member,
                data,
                true,
                "auto_hourly",
                false,
              );
              syncSuccess++;
              this.logger?.send(
                `[AUTO_SYNC] [OK] ${member.user?.username || member.id}`,
                "DEBUG",
              );
              // Log progressif tous les 5 membres
              if (i % 5 === 0) {
                this.logger?.send(
                  `[AUTO_SYNC] Progression: ${i}/${members.size} (${syncSuccess} reussis)`,
                  "DEBUG",
                );
              }
            } else {
              syncFailed++;
              this.logger?.send(
                `[AUTO_SYNC] [ERR] ${member.user?.username || member.id} - ${error || "Inconnu"}`,
                "WARN",
              );
            }
          } catch (e) {
            syncFailed++;
            this.logger?.send(
              `[AUTO_SYNC] [ERR] ${member.user?.username || member.id} (${member.id}) - ${e.message}`,
              "WARN",
            );
          }

          await this._sleep(100);
        }

        const duration = Math.floor((Date.now() - syncStartTime) / 1000);
        const rate =
          members.size > 0 ? Math.round((syncSuccess / members.size) * 100) : 0;
        const endTime = dayjs().format("HH:mm:ss");

        this.logger?.send("[AUTO_SYNC] Cycle termine", "NOTIF");
        this.logger?.send(
          `[AUTO_SYNC] Resume: ${syncSuccess}/${members.size} reussis (${rate}%) | Echoues: ${syncFailed}`,
          "NOTIF",
        );
        this.logger?.send(
          `[AUTO_SYNC] Duree: ${duration}s | Fin: ${endTime}`,
          "INFO",
        );

        const nextTime = dayjs()
          .add(AUTO_SYNC_INTERVAL_MINUTES, "minute")
          .format("HH:mm:ss");
        this.logger?.send(
          `[AUTO_SYNC] Prochain cycle a ${nextTime}`,
          "INFO",
        );
        await this._sleep(AUTO_SYNC_INTERVAL_MS);
      } catch (e) {
        this.logger?.send(
          `[AUTO_SYNC] Erreur boucle: ${e.message}`,
          "ERROR",
        );
        await this._sleep(60000);
      }
    }
  }

  // ===========================
  // [OK] FORCER SYNC TOUT SERVEUR
  // ===========================

  async forceSyncAllMembers(reason = "commande_admin") {
    try {
      const guild = this.client.guilds.cache.get(SYNC_GUILD_ID);
      if (!guild) return { success: false, error: "Serveur introuvable" };

      const memberRole = guild.roles.cache.get(MEMBER_ROLE_ID);
      if (!memberRole)
        return {
          success: false,
          error: `Role Membre introuvable (MEMBER_ROLE_ID=${MEMBER_ROLE_ID || "vide"})`,
        };

      await guild.members.fetch().catch(() => null);

      // Recuperer tous les membres eligibles
      const members = guild.members.cache.filter((m) => {
        if (m.user.bot) return false;
        if (!m.roles.cache.has(MEMBER_ROLE_ID)) return false;
        if (this._has_exclude_role(m)) return false;
        return true;
      });

      if (members.size === 0)
        return { success: true, error: "Aucun membre a synchroniser" };

      const startTime = dayjs().format("HH:mm:ss");
      this.logger?.send(
        `[FORCE_SYNC] [HOT] SYNCHRONISATION FORCEE LANCEE (${reason})`,
        "NOTIF",
      );
      this.logger?.send(
        `[FORCE_SYNC] [LIST] ${members.size} membres | Debut: ${startTime}`,
        "INFO",
      );

      const syncStartTime = Date.now();
      let syncSuccess = 0;
      let syncFailed = 0;
      let i = 0;

      // Synchroniser tous les members
      for (const member of members.values()) {
        i++;
        try {
          const { data, error } = await this.fetchUserData(member.id);
          if (data) {
            await this._applySyncFromData(
              member,
              data,
              true,
              "force_manual",
              false,
            );
            syncSuccess++;
            this.logger?.send(
              `[FORCE_SYNC] [OK] ${member.user?.username || member.id} (${member.id})`,
              "DEBUG",
            );
            if (i % 10 === 0) {
              this.logger?.send(
                `[FORCE_SYNC] [WAIT] ${i}/${members.size} (${syncSuccess} [OK])`,
                "DEBUG",
              );
            }
          } else {
            syncFailed++;
            this.logger?.send(
              `[FORCE_SYNC] [ERR] ${member.user?.username || member.id} (${member.id}) - ${error || "Erreur inconnue"}`,
              "WARN",
            );
          }
        } catch (e) {
          syncFailed++;
          this.logger?.send(
            `[FORCE_SYNC] [ERR] ${member.user?.username || member.id} (${member.id}) - ${e.message}`,
            "WARN",
          );
        }
        await this._sleep(100);
      }

      const duration = Math.floor((Date.now() - syncStartTime) / 1000);
      const rate =
        members.size > 0 ? Math.round((syncSuccess / members.size) * 100) : 0;
      const endTime = dayjs().format("HH:mm:ss");

      this.logger?.send(
        `[FORCE_SYNC] [OK] SYNCHRONISATION FORCEE TERMINEE`,
        "NOTIF",
      );
      this.logger?.send(
        `[FORCE_SYNC] [STATS] ${syncSuccess}/${members.size} reussis (${rate}%) | Echoues: ${syncFailed}`,
        "NOTIF",
      );
      this.logger?.send(`[FORCE_SYNC] [TIME]  ${duration}s | ${endTime}`, "INFO");

      return {
        success: true,
        total: members.size,
        synced: syncSuccess,
        failed: syncFailed,
        rate,
        duration,
      };
    } catch (e) {
      this.logger?.send(`[FORCE_SYNC] [ERR] Erreur: ${e.message}`, "ERROR");
      return { success: false, error: e.message };
    }
  }

  // ===========================
  // [OK] APPLIQUER LA SYNC
  // ===========================

  async _applySyncFromData(
    member,
    data,
    force = false,
    source = "auto",
    immediateNick = false,
  ) {
    const guild = member.guild;

    if (this._has_exclude_role(member)) return;

    // Synchronisation du pseudo
    const rpName = this._extract_name(data);
    if (rpName) {
      const desired = rpName.substring(0, 32);
      const current = member.nickname || member.user.username;

      if (force || desired !== current) {
        if (immediateNick) {
          await this._setNickImmediately(member, desired, source);
        } else {
          this.enqueueNick(member.id, desired, source);
        }
      }
    }

    // Synchronisation des roles
    const apiRoleNames = this._extract_role_names(data);

    // Map normalise pour comparaison
    const apiRolesNorm = new Set(apiRoleNames.map((n) => this._normalize(n)));
    const apiRolesCanon = new Set(
      apiRoleNames.map((n) => this._normalize_role_name(n)).filter(Boolean),
    );
    const targetIds = new Set();

    const unresolvedApiRoles = [];
    for (const [apiName, discordId] of Object.entries(ROLE_MAP)) {
      const mapNorm = this._normalize(apiName);
      const mapCanon = this._normalize_role_name(apiName);
      const commissaireKey = this._is_commissaire_variant(apiName);
      const commissaireDetected = commissaireKey
        ? apiRoleNames.some((name) => this._is_commissaire_variant(name))
        : false;

      if (
        apiRolesNorm.has(mapNorm) ||
        apiRolesCanon.has(mapCanon) ||
        commissaireDetected
      ) {
        const resolvedId = this._resolve_discord_role_id(guild, apiName, discordId);
        if (resolvedId) targetIds.add(resolvedId);
        else unresolvedApiRoles.push(apiName);
      }
    }

    // Roles geres actuellement (IDs map + fallback par nom)
    const managedIds = new Set(
      Object.values(ROLE_MAP).filter((id) => guild.roles.cache.has(id)),
    );
    for (const apiName of Object.keys(ROLE_MAP)) {
      const byName = guild.roles.cache.find(
        (r) => this._normalize(r.name) === this._normalize(apiName),
      );
      if (byName) managedIds.add(byName.id);
    }
    const currentManaged = new Set(
      Array.from(member.roles.cache.values())
        .filter((r) => managedIds.has(r.id))
        .map((r) => r.id),
    );

    const toAddIds = [...targetIds].filter((id) => !currentManaged.has(id));
    const toRemoveIds = [...currentManaged].filter((id) => !targetIds.has(id));

    const commissaireRoleId = ROLE_MAP.Commissaire || ROLE_MAP.Comissaire;
    if (
      commissaireRoleId &&
      apiRoleNames.some((name) => this._is_commissaire_variant(name))
    ) {
      this.logger?.send(
        `[ROLES] Commissaire detecte API pour ${member.id} | cible=${targetIds.has(commissaireRoleId)} | deja_present=${member.roles.cache.has(commissaireRoleId)}`,
        "INFO",
      );
    }

    try {
      const me = guild.members.me;
      const canManageRoles =
        me?.permissions?.has(PermissionFlagsBits.ManageRoles) ?? false;

      if (!canManageRoles) {
        this.logger?.send(
          `[ROLES] Permission ManageRoles manquante pour synchroniser ${member.id}`,
          "ERROR",
        );
        return {
          apiRoleNames,
          targetCount: targetIds.size,
          addedCount: 0,
          removedCount: 0,
          unresolvedApiRoles,
          manageRolesMissing: true,
        };
      }

      let addedCount = 0;
      if (toAddIds.length > 0) {
        const rolesToAdd = toAddIds
          .map((id) => guild.roles.cache.get(id))
          .filter(Boolean);

        const added = [];
        for (const role of rolesToAdd) {
          const meTop = me?.roles?.highest?.position ?? 0;
          if (role.position >= meTop) {
            this.logger?.send(
              `[ROLES] Impossible d'ajouter ${role.name} (${role.id}) a ${member.id}: role bot trop bas`,
              "WARN",
            );
            continue;
          }

          try {
            await member.roles.add(role, `Sync API: ajout role (src:${source})`);
            added.push(role);
            addedCount++;
            await this._sleep(Math.max(150, ROLE_DELAY_S * 1000));
          } catch (addErr) {
            this.logger?.send(
              `[ROLES] Echec ajout ${role.name} (${role.id}) pour ${member.id}: ${addErr.message}`,
              "WARN",
            );
          }
        }

        if (added.length > 0) {
          await this.logEmbed(
            guild,
            `[OK] Roles ajoutes [${source}]`,
            `${member.toString()} a recu: ${added.map((r) => r.toString()).join(", ")}`,
            0x00aa00,
          );
        }
      }

      let removedCount = 0;
      if (toRemoveIds.length > 0) {
        const rolesToRemove = toRemoveIds
          .map((id) => guild.roles.cache.get(id))
          .filter(Boolean);

        const removed = [];
        for (const role of rolesToRemove) {
          const meTop = me?.roles?.highest?.position ?? 0;
          if (role.position >= meTop) {
            this.logger?.send(
              `[ROLES] Impossible de retirer ${role.name} (${role.id}) a ${member.id}: role bot trop bas`,
              "WARN",
            );
            continue;
          }

          try {
            await member.roles.remove(role, `Sync API: retrait role (src:${source})`);
            removed.push(role);
            removedCount++;
            await this._sleep(Math.max(150, ROLE_DELAY_S * 1000));
          } catch (removeErr) {
            this.logger?.send(
              `[ROLES] Echec retrait ${role.name} (${role.id}) pour ${member.id}: ${removeErr.message}`,
              "WARN",
            );
          }
        }

        if (removed.length > 0) {
          await this.logEmbed(
            guild,
            `[ERR] Roles retires [${source}]`,
            `${member.toString()} a perdu: ${removed.map((r) => r.toString()).join(", ")}`,
            0xffaa00,
          );
        }
      }

      return {
        apiRoleNames,
        targetCount: targetIds.size,
        addedCount,
        removedCount,
        unresolvedApiRoles,
        manageRolesMissing: false,
      };
    } catch (e) {
      this.logger?.send(
        `[ROLES] Erreur pour ${member.id}: ${e.message}`,
        "ERROR",
      );
      await this.logEmbed(
        guild,
        "[WARN] Erreur roles",
        `${member.toString()}\n${e.message}`,
        0xff0000,
      );
      return {
        apiRoleNames,
        targetCount: targetIds.size,
        addedCount: 0,
        removedCount: 0,
        unresolvedApiRoles,
        manageRolesMissing: false,
        error: e.message,
      };
    }
  }

  async _setNickImmediately(member, desired, source = "button") {
    if (
      !desired ||
      this._has_exclude_role(member) ||
      this._cannot_modify(member)
    ) {
      return false;
    }

    try {
      const current = member.nickname || member.user.username;
      if (current === desired) return true;

      const maxRetries = 2;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          await member.setNickname(
            desired,
            `Sync API: prenom RP (direct:${source})`,
          );

          await this.logEmbed(
            member.guild,
            `[EDIT] Pseudo mis a jour [${source}] (direct)`,
            `${member.toString()}\n**Avant:** ${current}\n**Apres:** ${desired}`,
            0x0099ff,
          );

          return true;
        } catch (e) {
          if (e.status === 50013) {
            // Permissions insuffisantes
            await this.logEmbed(
              member.guild,
              "[WARN] Erreur pseudo (permissions)",
              `${member.toString()}\nPermission refusee`,
              0xff0000,
            );
            return false;
          }

          if (attempt < maxRetries) {
            await this._sleep(ROLE_DELAY_S * (attempt + 1) * 1000);
          } else {
            throw e;
          }
        }
      }
    } catch (e) {
      this.logger?.send(
        `[NICK_IMMEDIATE] Erreur pour ${member.id}: ${e.message}`,
        "ERROR",
      );
      return false;
    }

    return false;
  }

  // ===========================
  // [OK] COMMANDES
  // ===========================

  async handleSyncCommand(interaction) {
    const member = interaction.options.getMember("member");
    if (!member)
      return interaction.reply({
        content: "Membre introuvable.",
        flags: MessageFlags.Ephemeral,
      });

    if (this._sync_in_progress.has(member.id)) {
      return interaction.reply({
        content: "[WAIT] Synchronisation deja en cours pour ce membre...",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (this._cannot_modify(member)) {
      return interaction.reply({
        content: "[WARN] Je ne peux pas modifier ce membre (role trop eleve).",
        flags: MessageFlags.Ephemeral,
      });
    }

    this._sync_in_progress.add(member.id);

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const { data, status, error } = await this.fetchUserData(member.id);
      if (!data) {
        return await interaction.editReply(
          `[ERR] **Utilisateur non trouve sur l'API (${status || "erreur"}).**`,
        );
      }

      // Ajouter role Membre si besoin
      const memberRole = interaction.guild.roles.cache.get(MEMBER_ROLE_ID);
      let roleAdded = false;
      if (memberRole && !member.roles.cache.has(memberRole.id)) {
        try {
          await member.roles.add(
            memberRole,
            `Sync Admin: ajout role Membre par ${interaction.user.name}.`,
          );
          roleAdded = true;
          await this._sleep(ROLE_DELAY_S * 1000);
        } catch (e) {
          this.logger?.send(
            `[SYNCPLAYER] Erreur ajout role: ${e.message}`,
            "WARN",
          );
        }
      }

      const syncResult = await this._applySyncFromData(
        member,
        data,
        true,
        "admin_cmd",
        true,
      );

      let response = `[OK] Synchronisation de ${member.toString()} terminee.`;
      if (roleAdded) response += " Role Membre attribue.";
      if (syncResult?.manageRolesMissing) {
        response += " Impossible de gerer les roles: permission ManageRoles manquante.";
      } else if ((syncResult?.targetCount || 0) === 0) {
        response += " Aucun role staff detecte cote API/mapping.";
      } else {
        response += ` Roles sync: +${syncResult?.addedCount || 0} / -${syncResult?.removedCount || 0}.`;
      }
      if (syncResult?.unresolvedApiRoles?.length > 0) {
        response += ` Roles non resolus: ${syncResult.unresolvedApiRoles.join(", ")}.`;
      }

      await interaction.editReply(response);

      await this.logEmbed(
        interaction.guild,
        "[OK] Synchronisation Manuelle",
        `${interaction.user.toString()} a synchronise ${member.toString()}.`,
        0x00aa00,
      );
    } catch (e) {
      this.logger?.send(`[SYNCPLAYER] Erreur: ${e.message}`, "ERROR");
      await interaction.editReply(
        "[WARN] Echec de la synchronisation. Une erreur est survenue.",
      );
    } finally {
      this._sync_in_progress.delete(member.id);
    }
  }

  async handleStatusCommand(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("[SYNC] Statut Synchronisation")
      .setColor(0x0099ff)
      .setTimestamp()
      .addFields([
        {
          name: "File d'attente Pseudos",
          value: `**En attente:** ${this._nick_queue.length} pseudos`,
          inline: true,
        },
        {
          name: "Syncs individuelles en cours",
          value: `**En cours:** ${this._sync_in_progress.size}`,
          inline: true,
        },
      ])
      .setFooter({ text: "Synchronisation KobraBot x Kobralost" });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // ===========================
  // [OK] MENU DE SYNC (Boutons + Embeds)
  // ===========================

  async sendSyncMenu() {
    await this.client.ready;

    const guild = this.client.guilds.cache.get(SYNC_GUILD_ID);
    const channel = guild?.channels.cache.get(SYNC_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      this.logger?.send(
        `[MENU] Salon ${SYNC_CHANNEL_ID} introuvable`,
        "ERROR",
      );
      return;
    }

    // Purge des anciens messages
    try {
      const messages = await channel.messages
        .fetch({ limit: 50 })
        .catch(() => null);
      if (messages) {
        const botMessages = Array.from(messages.values()).filter(
          (m) => m.author.id === this.client.user.id,
        );
        if (botMessages.length > 0) {
          await channel.bulkDelete(botMessages).catch(() => { });
          this.logger?.send(
            `[MENU] ${botMessages.length} message(s) supprimes`,
            "DEBUG",
          );
        }
      }
    } catch (e) {
      this.logger?.send(`[MENU] Erreur purge: ${e.message}`, "WARN");
    }

    const syncEmoji = this.client.emoji("purge", "\u23CF");
    const verifyEmoji = this.client.emoji("angel~1", "\u{1F607}");
    const buttonEmoji = this.client.emoji("ADanyes1", "\u{1F7E9}");

    // Creer les embeds et bouton
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("sync_button")
        .setLabel("Synchroniser")
        .setEmoji(buttonEmoji)
        .setStyle(ButtonStyle.Success),
    );

    const embedMain = new EmbedBuilder()
      .setTitle(`${syncEmoji} Synchronisation Kobralost-RP`)
      .setDescription(
        "Clique sur le bouton **Synchroniser** pour mettre ton **prenom RP** a jour " +
        "et actualiser tes **roles staff/moderation**.\n\n" +
        "En appuyant, tu obtiens le role **Membre** et tu seras inclus " +
        "dans la synchronisation automatique.",
      )
      .setColor(0xff0000)
      .setThumbnail("https://i.imgur.com/NGX3iiX.png")
      .setFooter({ text: "Synchronisation KobraBot - Kobralost" });

    const embedVerify = new EmbedBuilder()
      .setTitle(`${verifyEmoji} Verification obligatoire`)
      .setDescription(
        "Avant de pouvoir synchroniser, tu dois etre **verifie** sur le serveur principal.\n\n" +
        "Rejoins **https://discord.gg/kbrp** et fais la verification.\n" +
        "Sans verification, ton pseudo et tes roles **ne seront pas synchronisables**.",
      )
      .setColor(0xff0000)
      .setImage("https://i.imgur.com/ZoOiFus.png")
      .setFooter({ text: "Synchronisation KobraBot - Kobralost" });

    try {
      await channel.send({
        embeds: [embedMain, embedVerify],
        components: [row],
      });
      this.logger?.send("[MENU] Messages de sync envoyes", "INFO");
    } catch (e) {
      this.logger?.send(`[MENU] Erreur envoi: ${e.message}`, "ERROR");
    }
  }

  // ===========================
  // [OK] GESTION BOUTON SYNC
  // ===========================

  async handleSyncButton(interaction) {
    const member = interaction.member;
    if (this._sync_in_progress.has(member.id)) {
      this.logger?.send(
        `[SYNC_BUTTON] Sync deja en cours pour ${member.user.username}`,
        "DEBUG",
      );
      return interaction.reply({
        content: "Une synchronisation est deja en cours pour toi.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (this._cannot_modify(member)) {
      this.logger?.send(
        `[SYNC_BUTTON] Impossible de modifier ${member.user.username} (role trop eleve)`,
        "WARN",
      );
      return interaction.reply({
        content:
          "Je ne peux pas modifier ton profil (role trop eleve ou permissions insuffisantes).",
        flags: MessageFlags.Ephemeral,
      });
    }

    this._sync_in_progress.add(member.id);

    try {
      const isVerified = true;
      if (!isVerified) {
        this.logger?.send(
          `[SYNC_BUTTON] ${member.user.username} non verifie`,
          "DEBUG",
        );
        return interaction.reply({
          content:
            "**Verification requise !**\n\nTu dois d'abord etre **verifie sur le serveur principal** (discord.gg/kbrp) pour synchroniser ton compte.",
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      this.logger?.send(
        `[SYNC_BUTTON] Synchronisation lancee pour ${member.user.username} (${member.id})`,
        "INFO",
      );

      const { data, status, error } = await this.fetchUserData(member.id);
      if (!data) {
        this.logger?.send(
          `[SYNC_BUTTON] Aucune donnee pour ${member.user.username} | Status: ${status} | Erreur: ${error}`,
          "ERROR",
        );
        return interaction.editReply({
          content: `Aucune donnee trouvee sur le site RP pour ton compte Discord.\n\nErreur: ${error}\n\nAssure-toi d'etre enregistre sur le site. Si l'erreur persiste, contacte un administrateur.`,
        });
      }

      this.logger?.send(
        `[SYNC_BUTTON] Donnees recuperees pour ${member.user.username}`,
        "DEBUG",
      );

      const memberRole = interaction.guild.roles.cache.get(MEMBER_ROLE_ID);
      let roleAdded = false;
      if (memberRole && !member.roles.cache.has(memberRole.id)) {
        try {
          await member.roles.add(
            memberRole,
            "Sync: opt-in role Membre via bouton.",
          );
          roleAdded = true;
          this.logger?.send(
            `[SYNC_BUTTON] Role Membre ajoute a ${member.user.username}`,
            "INFO",
          );
          await this._sleep(ROLE_DELAY_S * 1000);
        } catch (e) {
          this.logger?.send(
            `[SYNC_BUTTON] Erreur ajout role Membre: ${e.message}`,
            "WARN",
          );
        }
      }

      if (roleAdded && SYNC_NOTIF_CHANNEL_ID) {
        const notifChannel = interaction.guild.channels.cache.get(
          SYNC_NOTIF_CHANNEL_ID,
        );
        if (notifChannel?.isTextBased()) {
          try {
            const ghostMsg = await notifChannel.send(member.toString());
            await ghostMsg.delete();
          } catch (e) {
            this.logger?.send(
              `[SYNC_BUTTON] Erreur ghost ping: ${e.message}`,
              "DEBUG",
            );
          }
        }
      }

      const rpName = this._extract_name(data);
      if (!rpName) {
        this.logger?.send(
          `[SYNC_BUTTON] Aucun prenom RP trouve pour ${member.user.username}, ouverture du modal`,
          "DEBUG",
        );
        return interaction.showModal(this.createNameModal(member));
      }

      const syncResult = await this._applySyncFromData(
        member,
        data,
        true,
        "button_sync",
        true,
      );

      let msg =
        "Ton compte a ete synchronise. Ton pseudo et tes roles sont a jour.";
      if (roleAdded) msg += " Le role `Membre` t'a ete attribue.";
      if (syncResult?.manageRolesMissing) {
        msg += " Je ne peux pas modifier les roles (permission ManageRoles manquante).";
      } else if ((syncResult?.targetCount || 0) === 0) {
        msg += " Aucun role staff n'a ete detecte depuis l'API.";
      }

      this.logger?.send(
        `[SYNC_BUTTON] Synchronisation terminee pour ${member.user.username}`,
        "READY",
      );
      await interaction.editReply(msg);

      await this.logEmbed(
        interaction.guild,
        "Sync Bouton",
        `${member.toString()} a utilise le bouton de synchronisation.`,
        0x00aa00,
      );
    } catch (e) {
      this.logger?.send(
        `[SYNC_BUTTON] Erreur pour ${member.user.username}: ${e.message}`,
        "ERROR",
      );
      this.logger?.send(`[SYNC_BUTTON] Stack: ${e.stack}`, "ERROR");
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(
          "Echec de la synchronisation. Une erreur est survenue.",
        );
      } else {
        await interaction.reply({
          content: "Echec de la synchronisation. Une erreur est survenue.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } finally {
      this._sync_in_progress.delete(member.id);
    }
  }

  // ===========================
  // [OK] MODAL POUR PRENOM RP
  // ===========================

  createNameModal(member) {
    const {
      ModalBuilder,
      TextInputBuilder,
      TextInputStyle,
      ActionRowBuilder,
    } = require("discord.js");

    const modal = new ModalBuilder()
      .setCustomId(`name_modal_${member.id}`)
      .setTitle("Definir mon prenom RP");

    const input = new TextInputBuilder()
      .setCustomId("rp_name")
      .setLabel("Prenom RP")
      .setPlaceholder("Ex: Miguel")
      .setStyle(TextInputStyle.Short)
      .setMinLength(2)
      .setMaxLength(32)
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    return modal;
  }

  async handleNameModalSubmit(interaction) {
    const rpName = interaction.fields.getTextInputValue("rp_name");
    if (!rpName) return;

    const member = interaction.member;
    const desired = rpName.substring(0, 32);

    const ok = await this._setNickImmediately(member, desired, "manual_modal");
    if (ok) {
      await interaction.reply({
        content: `Pseudo mis a jour: \`${desired}\``,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: "Impossible de mettre a jour ton pseudo (permissions ?).",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  // ===========================
  // [OK] UTILITAIRES
  // ===========================

  _extract_name(data) {
    if (!data || typeof data !== "object") return "";

    const keys = Object.keys(data);
    const nameKeys = [
      "name",
      "firstname",
      "first_name",
      "rp_name",
      "rpname",
      "prenom",
      "prenom",
    ];

    for (const k of keys) {
      const norm = k.toLowerCase();
      if (nameKeys.includes(norm)) {
        const v = data[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    }

    for (const parent of ["data", "profile", "user", "member", "account"]) {
      if (data[parent] && typeof data[parent] === "object") {
        const nested = this._extract_name(data[parent]);
        if (nested) return nested;
      }
    }

    return "";
  }

  _extract_role_names(data) {
    const collected = new Set();
    const roleKeys = new Set([
      "roles",
      "staff_roles",
      "staffroles",
      "groups",
      "ranks",
      "grade",
      "grades",
    ]);

    const pushRole = (value) => {
      if (typeof value === "string" && value.trim()) {
        collected.add(value.trim());
        return;
      }
      if (value && typeof value === "object") {
        const candidates = [
          value.name,
          value.role,
          value.label,
          value.title,
          value.grade,
        ];
        for (const candidate of candidates) {
          if (typeof candidate === "string" && candidate.trim()) {
            collected.add(candidate.trim());
          }
        }
      }
    };

    const visited = new WeakSet();
    const walk = (node, depth = 0) => {
      if (!node || typeof node !== "object" || depth > 6) return;
      if (visited.has(node)) return;
      visited.add(node);

      if (Array.isArray(node)) {
        for (const item of node) {
          pushRole(item);
          walk(item, depth + 1);
        }
        return;
      }

      for (const [key, value] of Object.entries(node)) {
        const keyNorm = this._normalize(key).replace(/\s+/g, "_");
        if (roleKeys.has(keyNorm) && Array.isArray(value)) {
          for (const item of value) pushRole(item);
        } else if (roleKeys.has(keyNorm)) {
          pushRole(value);
        }
        walk(value, depth + 1);
      }
    };

    walk(data, 0);
    return Array.from(collected);
  }

  _resolve_discord_role_id(guild, apiName, mappedId) {
    const normApi = this._normalize(apiName);
    const canonApi = this._normalize_role_name(apiName);
    const mappedRole = guild.roles.cache.get(mappedId);
    if (mappedRole) return mappedRole.id;

    const exact = guild.roles.cache.find((r) => this._normalize(r.name) === normApi);
    if (exact) {
      this.logger?.send(
        `[ROLES] Fallback exact name pour "${apiName}" -> ${exact.id}`,
        "WARN",
      );
      return exact.id;
    }

    const exactCanon =
      canonApi &&
      guild.roles.cache.find(
        (r) => this._normalize_role_name(r.name) === canonApi,
      );
    if (exactCanon) {
      this.logger?.send(
        `[ROLES] Fallback canonique pour "${apiName}" -> ${exactCanon.id}`,
        "WARN",
      );
      return exactCanon.id;
    }

    // Fuzzy fallback for prefixed/suffixed role names (ex: "[STAFF] Moderateur").
    const fuzzy = guild.roles.cache.find((r) => {
      const n = this._normalize(r.name);
      const c = this._normalize_role_name(r.name);
      return (
        n.includes(normApi) ||
        normApi.includes(n) ||
        (canonApi && c && (c.includes(canonApi) || canonApi.includes(c)))
      );
    });
    if (fuzzy) {
      this.logger?.send(
        `[ROLES] Fallback fuzzy pour "${apiName}" -> ${fuzzy.id} (${fuzzy.name})`,
        "WARN",
      );
      return fuzzy.id;
    }

    this.logger?.send(
      `[ROLES] Role Discord introuvable pour mapping "${apiName}" (id:${mappedId})`,
      "WARN",
    );
    return null;
  }

  _cannot_modify(member) {
    const me = member.guild.members.me;
    if (!me || !me.roles.highest || !member.roles.highest) return false;
    return (
      me.roles.highest.position <= member.roles.highest.position ||
      member.id === member.guild.ownerId
    );
  }

  _has_exclude_role(member) {
    if (!EXCLUDE_FROM_AUTO_ROLE_ID) return false;
    return member.roles.cache.has(EXCLUDE_FROM_AUTO_ROLE_ID);
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = SyncAPI;
module.exports.DEFAULT_ROLE_MAP = DEFAULT_ROLE_MAP;
module.exports.parseRoleMapFromEnv = parseRoleMapFromEnv;

