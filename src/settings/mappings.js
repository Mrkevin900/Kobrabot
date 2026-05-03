/**
 * Professional centralized mapping for KobraBot
 * This file contains all static configurations, roles, emojis and aliases.
 */

const ROLE_MAPPINGS = {
  // Staff Roles
  Fondateur: "1449129871514009826",
  "Co-Fondateur": "1449129820117274714",
  Administration: "1449129799057543218",
  "Developpeur apprenti": "1449129740395876464",
  "Moderateur Loyal": "1449130440224145529",
  "Moderateur Senior": "1449130544800727211",
  "Moderateur Certifie": "1449129714680729630",
  Moderateur: "1449129691876298854",
  "Moderateur Apprenti": "1449129654530347170",

  // RP Roles (Police / Commissaire)
  Commissaire: "1458211387091325101",
  Comissaire: "1458211387091325101",
  Comisere: "1458211387091325101",
  "Commissaire Police": "1458211387091325101",
  "Commissaire de Police": "1458211387091325101",
  Comissaire_Gérant: "1500639443118461110",

  // Technical / Other Roles
  Mappeur: "1449129618111205416",
  Legende: "1411313306651721768",
  Donateur: "1411313344543068210",

  // Pending Roles
  Formateur Staff: "1500639132211347586",
  Animateur: "1500639228768555049",
  Designer: "1500639298154795048",
};

const EMOJI_CONFIG = {
  kbrp: { names: ["kbrp", "kbrp_emojis", "bot", "verifiedbook", "checkmark", "crown", "ADITHYANGAMINGemojis", "angel", "angry"], fallback: "\u{1F497}" },
  mascot: { names: ["bot", "verifiedbook", "checkmark", "crown", "kbrp_emojis", "kbrp", "mascot", "ADITHYANGAMINGemojis", "angel", "angry"], fallback: "\u{1F497}" },
  refresh: { names: ["progress", "refresh", "reload", "sync"], fallback: "\u{1F504}" },
  trash: { names: ["kb_no", "trash", "delete", "rip"], fallback: "\u{1F5D1}\uFE0F" },
  repeat: { names: ["progress", "repeat", "loop"], fallback: "\u{1F501}" },
  lock: { names: ["lock", "shield", "muted", "verifiedbook"], fallback: "\u{1F512}" },
  private: { names: ["private", "mute", "muted"], fallback: "\u{1F509}" },
  public: { names: ["thumbsup", "thumbs_up", "public", "unmute"], fallback: "\u{1F50A}" },
  transfer: { names: ["transfer", "crown", "star"], fallback: "\u{1F451}" },
  whitelist: { names: ["whitelist", "list", "thumbsup", "thumbs_up", "checkmark", "verifiedroxo"], fallback: "\u{1F4DC}" },
  blacklist: { names: ["kb_no", "blacklist", "banlist", "ban", "alert", "exc"], fallback: "\u{1F6D1}" },
  purge: { names: ["purge", "eject"], fallback: "\u{23CF}" },
  mic: { names: ["mic", "microphone", "muted"], fallback: "\u{1F3A4}" },
  video: { names: ["video", "camera"], fallback: "\u{1F3A5}" },
  party: { names: ["party", "beer", "staffdiscord", "giveaway"], fallback: "\u{1F389}" },
  force: { names: ["kb_add", "force", "rocket", "ufo", "zeus"], fallback: "\u{1F680}" },
  status: { names: ["magnifying_glass_112", "magnifying_glass", "status", "search"], fallback: "\u{1F50D}" },
  stats: { names: ["briefcase", "money", "stats", "chart", "star", "manuteno"], fallback: "\u{1F4CA}" },
};

const EMOJI_ALIASES = {
  kbrp: "mascot",
  kbrpemoji: "mascot",
  kbrpemojis: "mascot",
  kbtpemoji: "mascot",
  kbtpemojis: "mascot",
  mascot: "mascot",
};

const MODULE_ALIASES = {
  admin: "admin",
  administration: "admin",
  api: "api",
  fan: "fan",
  fun: "fun",
  general: "general",
  info: "info",
  information: "info",
  informations: "info",
  mod: "moderation",
  moderation: "moderation",
  module_mo: "moderation",
  module_moderation: "moderation",
};

const LOGGER_ALIASES = {
  WARNING: "WARN",
  SUCCESS: "READY",
  SNEC: "READY",
  DATABESE: "DATABASE",
  METHODE: "METHOD",
  COMMANDE: "COMMAND",
  SERVERLOG: "SERVER",
  LOGSERVER: "SERVER",
  SYNCHRONISATION: "SYNCHRONISATION",
  SYNCHRO: "SYNCHRONISATION",
  API: "SYNCHRONISATION",
  AUTOMODE: "AUTOMOD",
};

const LOGGER_STYLES = {
  ERROR: { emoji: "❌", label: "ERROR", color: "redBright", embed: 0xed4245 },
  ALERT: { emoji: "🚨", label: "ALERT", color: "#ff3d00", embed: 0xff3d00 },
  WARN: { emoji: "⚠️", label: "WARN", color: "yellowBright", embed: 0xfaa61a },
  READY: { emoji: "✅", label: "READY", color: "greenBright", embed: 0x57f287 },
  NOTIF: { emoji: "🔔", label: "NOTIF", color: "cyanBright", embed: 0x5865f2 },
  INFO: { emoji: "ℹ️", label: "INFO", color: "whiteBright", embed: 0x3498db },
  DEBUG: { emoji: "🧪", label: "DEBUG", color: "gray", embed: 0x95a5a6 },
  DATABASE: { emoji: "🗄️", label: "DATABASE", color: "blueBright", embed: 0x1abc9c },
  METHOD: { emoji: "🧩", label: "METHOD", color: "yellowBright", embed: 0xe67e22 },
  HANDLER: { emoji: "⚙️", label: "HANDLER", color: "cyanBright", embed: 0x00bcd4 },
  COMMAND: { emoji: "📦", label: "COMMAND", color: "blueBright", embed: 0x8e44ad },
  CMD: { emoji: "🤖", label: "CMD", color: "magentaBright", embed: 0x9b59b6 },
  SERVER: { emoji: "🛡️", label: "SERVER", color: "green", embed: 0x2ecc71 },
  SYNC: { emoji: "🧪", label: "synchronisation", color: "cyanBright", embed: 0x00a8ff },
  SYNCHRONISATION: { emoji: "🧪", label: "synchronisation", color: "cyanBright", embed: 0x00a8ff },
  AUTOMOD: { emoji: "🛡️", label: "automod", color: "#ff6b35", embed: 0xff6b35 },
  SECURITY: { emoji: "🔐", label: "SECURITY", color: "red", embed: 0xe74c3c },
  ROLES: { emoji: "🎭", label: "roles", color: "magentaBright", embed: 0x9b59b6 },
  VOCAL: { emoji: "🎙️", label: "vocal", color: "#00d2d3", embed: 0x00d2d3 },
  TICKET: { emoji: "🎫", label: "ticket", color: "#feca57", embed: 0xfeca57 },
  LEVEL: { emoji: "⭐", label: "level", color: "#ff9ff3", embed: 0xff9ff3 },
  SUGGEST: { emoji: "💡", label: "suggestion", color: "#48dbfb", embed: 0x48dbfb },
  FREE_GAMES: { emoji: "🎮", label: "free-games", color: "#1dd1a1", embed: 0x1dd1a1 },
};

module.exports = {
  ROLE_MAPPINGS,
  EMOJI_CONFIG,
  EMOJI_ALIASES,
  MODULE_ALIASES,
  LOGGER_ALIASES,
  LOGGER_STYLES,
};
