const chalk = require("chalk");
const dayjs = require("dayjs");
const { EmbedBuilder } = require("discord.js");
const { formatContext } = require("./CommandUtils");
const logRotator = require("./logRotator");
require("dayjs/locale/fr");

dayjs.locale("fr");

class RuntimeLogger {
  constructor(client = null) {
    this.client = client;
    const { LOGGER_ALIASES, LOGGER_STYLES } = require("../settings/mappings");
    this.aliases = LOGGER_ALIASES;
    this.styles = LOGGER_STYLES;

    this.discordForwardLevels = this.parseLevelSet(process.env.DISCORD_LOG_LEVELS, [
      "ERROR",
      "ALERT",
      "WARN",
      "READY",
      "NOTIF",
      "INFO",
      "METHOD",
      "SERVER",
      "SECURITY",
      "SYNCHRONISATION",
      "AUTOMOD",
    ]);
    this.recentLines = new Map();

    // [OPTIMISATION] Nettoyage asynchrone de la memoire (evite de bloquer le CPU a chaque log)
    setInterval(() => {
      const now = Date.now();
      const dedupeMs = Math.max(0, Number(process.env.LOG_DEDUPE_MS) || 1500);
      for (const [entryKey, timestamp] of this.recentLines.entries()) {
        if (now - timestamp > dedupeMs * 4) {
          this.recentLines.delete(entryKey);
        }
      }
    }, 10000).unref?.();
  }

  setClient(client) {
    this.client = client;
  }

  parseLevelSet(raw, fallback) {
    const source = raw || fallback.join(",");
    if (String(source).trim() === "*") return null;
    return new Set(
      String(source)
        .split(",")
        .map((item) => this.normalizeLevel(item))
        .filter(Boolean),
    );
  }

  normalizeLevel(level) {
    const raw = String(level || "INFO").toUpperCase().trim();
    return this.aliases[raw] || raw;
  }

  resolveStyle(level) {
    const rawStyle = this.styles[level] || {
      emoji: "❔",
      label: level,
      color: "white",
      embed: 0xffffff,
    };

    // Convert string color to chalk function
    let colorFn = chalk.white;
    if (typeof rawStyle.color === "string") {
      if (rawStyle.color.startsWith("#")) {
        colorFn = chalk.hex(rawStyle.color);
      } else if (typeof chalk[rawStyle.color] === "function") {
        colorFn = chalk[rawStyle.color];
      }
    }

    return { ...rawStyle, color: colorFn };
  }

  inferCategoryLevel(level, message) {
    const text = String(message || "");
    if (/^\s*\[(API|SYNC|AUTO_SYNC|SLOW_SYNC|FORCE_SYNC|SYNCPLAYER|SYNC_BUTTON|KOBRALOST_API|SyncLogger)\]/i.test(text)) {
      return "SYNCHRONISATION";
    }

    if (/^\s*\[(AUTOMOD|SECURITY)\]/i.test(text)) {
      return "AUTOMOD";
    }

    if (/^\s*\[ROLES\]/i.test(text)) {
      return "ROLES";
    }

    if (/^\s*\[VOCAL\]/i.test(text)) return "VOCAL";
    if (/^\s*\[TICKET\]/i.test(text)) return "TICKET";
    if (/^\s*\[LEVEL\]/i.test(text)) return "LEVEL";
    if (/^\s*\[SUGGEST\]/i.test(text)) return "SUGGEST";
    if (/^\s*\[FREE_GAMES\]/i.test(text)) return "FREE_GAMES";

    return level;
  }

  sanitizeText(text) {
    if (!text) return "";
    return String(text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  }

  normalizeContent(content) {
    if (content instanceof Error) {
      return `${content.message}\n${content.stack || ""}`;
    }

    if (typeof content === "string") return content;

    if (typeof content === "object" && content !== null) {
      try {
        return JSON.stringify(content, null, 2);
      } catch (_) {
        return String(content);
      }
    }

    return String(content ?? "");
  }

  composeMessage(content, context) {
    const base = this.normalizeContent(content);
    const contextLine = formatContext(context);
    if (!contextLine) return base;
    return `${base}\nContext: ${contextLine}`;
  }

  toLines(content) {
    const value = this.sanitizeText(this.normalizeContent(content));
    const lines = value.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return lines.length > 0 ? lines : [""];
  }

  shouldPrintLine(level, line) {
    const dedupeMs = Math.max(0, Number(process.env.LOG_DEDUPE_MS) || 1500);
    if (dedupeMs <= 0) return true;

    const key = `${level}:${line}`;
    const now = Date.now();
    const previous = this.recentLines.get(key) || 0;
    this.recentLines.set(key, now);

    return now - previous > dedupeMs;
  }

  prefix() {
    const now = dayjs();
    return (
      chalk.gray("[") +
      chalk.white(now.format("DD/MM/YYYY")) +
      chalk.gray(" • ") +
      chalk.cyanBright(now.format("HH:mm:ss")) +
      chalk.gray("]")
    );
  }

  shouldForwardToDiscord(level) {
    const ready =
      typeof this.client?.isReady === "function"
        ? this.client.isReady()
        : this.client?.isReady === true;

    if (!ready) {
      return false;
    }

    if (this.discordForwardLevels === null) return true;
    return this.discordForwardLevels.has(level);
  }

  send(content, status = "INFO", context = null) {
    if (status && typeof status === "object" && !Array.isArray(status)) {
      context = status;
      status = "INFO";
    }

    const requestedLevel = this.normalizeLevel(status);
    const composed = this.composeMessage(content, context);
    const level = this.inferCategoryLevel(requestedLevel, composed);
    const style = this.resolveStyle(level);
    const lines = this.toLines(composed);

    const printableLines = [];
    for (const line of lines) {
      if (!this.shouldPrintLine(level, line)) continue;
      printableLines.push(line);
      console.log(
        `${this.prefix()} ${style.color(`${style.emoji} ${style.label}`)} ${chalk.gray("│")} ${chalk.white(line)}`,
      );
      // [LOG ROTATOR] Écriture optionnelle dans un fichier log avec rotation
      logRotator.writeLine(level, line);
    }

    if (printableLines.length > 0 && this.shouldForwardToDiscord(level)) {
      // [OPTIMISATION] Desactivé temporairement ou limité aux erreurs pour éviter les spams API et libérer de l'espace disque.
      if (level === "ERROR" || level === "ALERT") {
        this.forwardToDiscord(level, printableLines.join("\n"));
      }
    }
  }

  forwardToDiscord(level, message) {
    try {
      const channelId =
        process.env.SERVER_LOG_CHANNEL_ID ||
        process.env.LOGS_CHANNEL_ID ||
        process.env.LOG_CHANNEL_ID;
      if (!channelId) return;

      const channel =
        this.client.channels?.cache?.get(channelId) ||
        this.client.guilds?.cache?.first()?.channels?.cache?.get(channelId);
      if (!channel || typeof channel.send !== "function") return;

      const style = this.resolveStyle(level);
      const text = this.sanitizeText(message).slice(0, 3900);
      const embed = new EmbedBuilder()
        .setColor(style.embed)
        .setAuthor({
          name: `KobraBot Logs • ${level}`,
          iconURL: this.client.user?.displayAvatarURL?.({ size: 128 }) || undefined,
        })
        .setTitle(`${style.emoji} ${this.resolveServerTitle(level)}`)
        .setDescription(`\`\`\`\n${text || "Aucun detail"}\n\`\`\``)
        .addFields(
          { name: "📌 Niveau", value: `\`${level}\``, inline: true },
          { name: "🕐 Heure", value: dayjs().format("DD/MM/YYYY HH:mm:ss"), inline: true },
        )
        .setFooter({ text: "Terminal + Server Logger" })
        .setTimestamp();

      channel.send({ embeds: [embed] }).catch(() => {});
    } catch (_) {
      // Never crash the bot because the log transport failed.
    }
  }

  resolveServerTitle(level) {
    if (level === "SERVER") return "Log serveur";
    if (level === "SYNCHRONISATION" || level === "SYNC") return "Synchronisation API";
    if (level === "AUTOMOD") return "AutoMod";
    if (level === "ROLES") return "Roles Discord";
    if (level === "VOCAL") return "Salons vocaux";
    if (level === "TICKET") return "Tickets";
    if (level === "LEVEL") return "Niveaux";
    if (level === "SUGGEST") return "Suggestions";
    if (level === "FREE_GAMES") return "Jeux gratuits";
    if (level === "SECURITY") return "Protection serveur";
    if (level === "ERROR") return "Erreur terminal";
    if (level === "READY") return "Statut operationnel";
    return "Log terminal";
  }

  server(content, context = null) {
    this.send(content, "SERVER", context);
  }

  security(content, context = null) {
    this.send(content, "SECURITY", context);
  }

  sync(content, context = null) {
    this.send(content, "SYNCHRONISATION", context);
  }

  automod(content, context = null) {
    this.send(content, "AUTOMOD", context);
  }

  info(content, context = null) {
    this.send(content, "INFO", context);
  }

  warn(content, context = null) {
    this.send(content, "WARN", context);
  }

  error(content, context = null) {
    this.send(content, "ERROR", context);
  }
}

module.exports = RuntimeLogger;
