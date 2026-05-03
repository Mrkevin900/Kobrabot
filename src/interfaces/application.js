const { Client, REST, Routes, Options } = require("discord.js");

const Logger = require("../utils/logger.runtime");
const Database = require("../database/database");
const { normalizeCommandName } = require("../utils/CommandUtils");
const settingsProd = require("../settings/settings.prod");
const settingsTest = require("../settings/settings.test");
const { registerEmojiHelpers } = require("../utils/emojis");
const CacheManager = require("../utils/CacheManager");
const LoggerManager = require("../logger/LoggerManager");
const AutoModManager = require("../automod/AutoModManager");

const loadCommands = require("../loaders/loadCommands");
const loadHandlers = require("../loaders/loadHandlers");
const loadSyncAPI = require("../loaders/loadSyncAPI");

class Application extends Client {
  constructor() {
    const isProd = process.env.PRODUCTION === "TRUE";
    const config = isProd ? settingsProd : settingsTest;

    super({
      intents: config.intents,
      partials: config.partials,
      makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        MessageManager: 25, // Limiter la taille du cache des messages pour économiser de la RAM
        PresenceManager: 0, // Désactiver le cache des présences (inutile ici)
        ReactionManager: 0, // Désactiver le cache des réactions par défaut
        ThreadManager: 25,  // Limiter le cache des threads
      }),
    });

    this.config = config;
    this.commands = [];
    this.commandMap = new Map();
    this.commandStats = new Map();
    registerEmojiHelpers(this);
    // Support both CommonJS `require` and ES module default shapes:
    // - if `Logger` is a constructor -> instantiate with `new Logger(this)`
    // - if `Logger` is an object with `.default` constructor -> use that
    // - if `Logger` is already an instance -> use it directly
    try {
      const MaybeLogger = Logger && Logger.default ? Logger.default : Logger;
      if (typeof MaybeLogger === "function") {
        this.logger = new MaybeLogger(this);
      } else {
        this.logger = MaybeLogger;
      }
    } catch (e) {
      this.logger = Logger;
    }
    this.database = null;
    this.db = this.db || null;
    this.cache = new CacheManager();
    this.loggerManager = new LoggerManager(this);
    this.autoModManager = new AutoModManager(this);
  }

  getConfig() {
    return this.config;
  }

  getCommands() {
    return this.commands;
  }

  getCommand(name) {
    return this.commandMap.get(normalizeCommandName(name)) || null;
  }

  getLogger() {
    return this.logger;
  }

  resetCommandsRegistry() {
    this.commands = [];
    this.commandMap = new Map();
    this.commandStats = new Map();
  }

  registerCommand(command, meta = {}) {
    const commandName = normalizeCommandName(command?.data?.name || meta.commandName);
    if (!commandName) {
      throw new Error("Impossible d'enregistrer une commande sans nom");
    }

    const normalizedModule = meta.moduleName || command?.settings?.module || "general";
    command.settings = {
      ...(command.settings || {}),
      enabled: command?.settings?.enabled !== false,
      module: normalizedModule,
    };
    command.__meta = {
      ...(command.__meta || {}),
      ...meta,
      commandName,
      registeredAt: new Date().toISOString(),
    };

    this.commands.push(command);
    this.commandMap.set(commandName, command);
    return command;
  }

  recordCommandExecution(commandName, execution = {}) {
    const key = normalizeCommandName(commandName);
    if (!key) return null;

    const current = this.commandStats.get(key) || {
      count: 0,
      successCount: 0,
      errorCount: 0,
      slowCount: 0,
      lastDurationMs: null,
      maxDurationMs: 0,
      lastStatus: "unknown",
      lastRunAt: null,
      lastType: "slash",
      lastActorId: null,
    };

    const durationMs = Number.isFinite(execution.durationMs) ? execution.durationMs : null;
    current.count += 1;
    current.lastStatus = execution.success === false ? "error" : "success";
    current.lastRunAt = new Date().toISOString();
    current.lastType = execution.type || "slash";
    current.lastActorId = execution.actorId || null;
    current.lastDurationMs = durationMs;

    if (execution.success === false) current.errorCount += 1;
    else current.successCount += 1;

    if (durationMs !== null) {
      current.maxDurationMs = Math.max(current.maxDurationMs || 0, durationMs);
      if (durationMs >= (execution.slowThresholdMs || 2500)) current.slowCount += 1;
    }

    this.commandStats.set(key, current);
    return { ...current };
  }

  getCommandStats(commandName) {
    return this.commandStats.get(normalizeCommandName(commandName)) || null;
  }

  async loadDatabase() {
    if (!this.database) {
      this.database = new Database(this);
    }

    const ok = await this.database.connect();

    if (!ok) {
      this.getLogger().send("Database non disponible. Le bot continue en mode degrade.", "WARN");
      return false;
    }

    return true;
  }

  async loadHandlers() {
    await loadHandlers(this);
  }

  async loadCommands() {
    this.resetCommandsRegistry();
    await loadCommands(this);
  }

  async loadSyncAPI() {
    await loadSyncAPI(this);
  }

  async syncInts(options = {}) {
    const shouldSyncCommands = options.commands !== false;
    if (!shouldSyncCommands) return;
    const blockedCommandNames = new Set(["absence", "apitest", "applications"]);

    const isProd = process.env.PRODUCTION === "TRUE";
    const clientId = isProd ? process.env.CLIENT_ID_PROD : process.env.CLIENT_ID_TEST;
    const guildId =
      options.guildId ||
      process.env.GUILD_ID ||
      process.env.SYNC_GUILD_ID ||
      this.getConfig().guildId;

    if (!clientId || !guildId) {
      this.getLogger().send("Sync slash commands ignoree: CLIENT_ID ou GUILD_ID manquant.", "WARN", {
        clientId: clientId || "missing",
        guildId: guildId || "missing",
      });
      return;
    }

    const body = this.commands
      .filter((command) => command && command.data && typeof command.data.toJSON === "function")
      .map((command) => command.data.toJSON())
      .filter((commandJson) => !blockedCommandNames.has(String(commandJson?.name || "").toLowerCase()));

    const token = isProd ? process.env.CLIENT_TOKEN_PROD : process.env.CLIENT_TOKEN_TEST;
    if (!token) {
      this.getLogger().send("Sync slash commands ignoree: token Discord manquant.", "WARN", {
        environment: isProd ? "production" : "test",
      });
      return;
    }

    const rest = new REST({ version: "10" }).setToken(token);

    try {
      this.getLogger().send(`Sync slash commands cible: app=${clientId}, guild=${guildId}`, "DEBUG", {
        environment: isProd ? "production" : "test",
      });
      this.getLogger().send(`Publication de ${body.length} slash commands...`, "INFO", {
        appId: clientId,
        guildId,
        count: body.length,
      });

      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });

      const deleteBlocked = async (routeList, routeDelete, scopeLabel) => {
        const existing = await rest.get(routeList);
        const blocked = Array.isArray(existing)
          ? existing.filter((cmd) => blockedCommandNames.has(String(cmd?.name || "").toLowerCase()))
          : [];
        for (const cmd of blocked) {
          await rest.delete(routeDelete(cmd.id));
          this.getLogger().send(
            `Commande supprimee (${scopeLabel}): ${cmd.name}`,
            "INFO",
          );
        }
      };

      await deleteBlocked(
        Routes.applicationCommands(clientId),
        (commandId) => Routes.applicationCommand(clientId, commandId),
        "global",
      );
      await deleteBlocked(
        Routes.applicationGuildCommands(clientId, guildId),
        (commandId) => Routes.applicationGuildCommand(clientId, guildId, commandId),
        "guild",
      );

      this.getLogger().send(`Slash commands synchronisees: ${body.length}`, "READY", {
        appId: clientId,
        guildId,
        count: body.length,
      });
    } catch (error) {
      this.getLogger().send(`Erreur sync slash commands: ${error.message}`, "ERROR", {
        appId: clientId,
        guildId,
        count: body.length,
      });
      if (error.stack) {
        this.getLogger().send(error.stack, "DEBUG", {
          appId: clientId,
          guildId,
        });
      }
    }
  }

  async breakSync() {
    await this.application?.commands.set([]);
    for (const guild of this.guilds.cache.values()) {
      await guild.commands.set([]);
    }
  }
}

module.exports = Application;


