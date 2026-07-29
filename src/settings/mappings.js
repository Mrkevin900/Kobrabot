/**
 * Professional centralized mapping for KobraBot
 * This file contains all static configurations, roles, emojis and aliases.
 */

const ROLE_MAPPINGS = {
  // Staff Roles
  Fondateur: "1520741442098692096",
  "Co-Fondateur": "1520741423069003856",
  Administration: "1520741380916514946",
  "Developpeur apprenti": "1520741335857102900",
  "Moderateur Loyal": "1520741309206364230",
  "Moderateur Senior": "1520741287043534878",
  "Moderateur Certifie": "1520741264805335161",
  Moderateur: "1520741236338593953",
  "Moderateur Apprenti": "1520741213618311309",

  // RP Roles (Police / Commissaire)
  "Commissaire Gérant": "1520741168168702032",
  "Comissaire Gérant": "1520741168168702032",
  "Commissaire Gerant": "1520741168168702032",
  "Comissaire Gerant": "1520741168168702032",
  Commissaire_Gérant: "1520741168168702032",
  Commissaire: "1520741143762178129",

  // Technical / Other Roles
  Mappeur: "1520741191853936713",
  Legende: "1520434458161971250",
  Donateur: "1520434458161971250",

  // Pending Roles
  "Formateur Staff": "1520741097108930570",
  Formateur: "1520741097108930570",
  Animateur: "1520741025616760842",
  Designer: "1520741118789156934",
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

  // Custom overhaul mapping
  success: { names: ["success", "checkmark", "verifiedroxo", "verifiedbook", "2", "4"], fallback: "✅" },
  error: { names: ["error", "error_112", "no", "ban", "cancel", "trash"], fallback: "❌" },
  warning: { names: ["warning", "alert", "exc"], fallback: "⚠️" },
  info: { names: ["info", "information", "magnifying_glass_112", "magnifying_glass"], fallback: "ℹ️" },
  loading: { names: ["loading", "loader", "progress", "refresh", "repeat"], fallback: "⏳" },
  giveaway: { names: ["giveaway", "party", "star", "crown", "gift"], fallback: "🎉" },
  moderation: { names: ["moderation", "police", "shield", "ban", "muted"], fallback: "🛡️" },
  tickets: { names: ["tickets", "ticket", "briefcase", "star"], fallback: "🎫" },
  logs: { names: ["logs", "log", "manuteno", "briefcase"], fallback: "📝" },
  security: { names: ["security", "shield", "lock", "verifiedbook", "verifiedroxo"], fallback: "🔐" },
  level: { names: ["level", "xp", "star", "crown"], fallback: "⭐" },
  administration: { names: ["administration", "admin", "crown", "star"], fallback: "👑" },
  music: { names: ["music", "song", "mic", "microphone"], fallback: "🎵" },
  fun: { names: ["fun", "lol", "hi", "wink", "cool"], fallback: "🎮" },
  verification: { names: ["verification", "verifiedroxo", "verifiedbook", "checkmark"], fallback: "✅" },
  validation: { names: ["validation", "checkmark", "verifiedroxo", "success"], fallback: "✅" },
  cancel: { names: ["cancel", "no", "error", "trash"], fallback: "❌" },
  clock: { names: ["clock", "time", "date", "manuteno"], fallback: "⏰" },
  bell: { names: ["bell", "notif", "alert"], fallback: "🔔" },
  gift: { names: ["gift", "giveaway", "party"], fallback: "🎁" },
  hi: { names: ["hi", "welcome", "cool", "lol"], fallback: "👋" },
  bye: { names: ["bye", "rip", "cry"], fallback: "👋" },
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
