const path = require("path");

const { MODULE_ALIASES } = require("../settings/mappings");

const SUBCOMMAND_TYPES = new Set([1, 2]);

function normalizeCommandName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function truncate(value, maxLength = 96) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function toSingleLine(value) {
  return truncate(String(value ?? "").replace(/\r?\n/g, " "), 160);
}

function inferModuleName(filePath) {
  const parent = path.basename(path.dirname(filePath || ""));
  return normalizeModuleName(parent, "general");
}

function normalizeModuleName(value, fallback = "general") {
  const raw = normalizeCommandName(value || fallback || "general");
  return MODULE_ALIASES[raw] || raw || "general";
}

function safeCommandJson(command) {
  try {
    if (!command?.data) return null;
    if (typeof command.data.toJSON === "function") return command.data.toJSON();
    return command.data;
  } catch (_) {
    return null;
  }
}

function buildCommandMeta(command, filePath) {
  const fileName = path.basename(filePath || "", ".js");
  const commandJson = safeCommandJson(command);
  const displayName = commandJson?.name || command?.data?.name || fileName || "unknown";
  const commandName = normalizeCommandName(displayName);
  const relativePath = filePath
    ? path.relative(process.cwd(), filePath).replace(/\\/g, "/")
    : fileName;
  const moduleName = normalizeModuleName(command?.settings?.module, inferModuleName(filePath));

  return {
    commandJson,
    commandName,
    displayName,
    moduleName,
    source: relativePath,
    fileName,
  };
}

function validateCommandDefinition(command, filePath) {
  const meta = buildCommandMeta(command, filePath);
  const issues = [];

  if (!command || typeof command !== "object") {
    issues.push("export invalide");
  }

  if (!command?.data) {
    issues.push("champ data manquant");
  }

  if (command?.data && typeof command.data.toJSON !== "function") {
    issues.push("data.toJSON() manquant");
  }

  if (typeof command?.executeCommand !== "function") {
    issues.push("executeCommand manquant");
  }

  if (!meta.commandJson?.name) {
    issues.push("nom de commande introuvable");
  }

  if (!meta.commandJson?.description) {
    issues.push("description de commande introuvable");
  }

  return {
    valid: issues.length === 0,
    issues,
    meta,
  };
}

function extractFlatOptions(options, parents = []) {
  const list = [];

  for (const option of Array.isArray(options) ? options : []) {
    if (!option || !option.name) continue;

    if (SUBCOMMAND_TYPES.has(option.type) && Array.isArray(option.options)) {
      list.push(...extractFlatOptions(option.options, [...parents, option.name]));
      continue;
    }

    list.push({
      name: [...parents, option.name].join("."),
      value: resolveOptionValue(option),
    });
  }

  return list;
}

function resolveOptionValue(option) {
  if (option.user) return `${option.user.tag || option.user.username || "user"}:${option.user.id}`;
  if (option.member?.user) {
    return `${option.member.user.tag || option.member.user.username || "member"}:${option.member.user.id}`;
  }
  if (option.channel) return `#${option.channel.name || option.channel.id}`;
  if (option.role) return `@${option.role.name || option.role.id}`;
  if (option.attachment) return `file:${option.attachment.name || option.attachment.id}`;
  if (typeof option.value === "string") return truncate(option.value, 72);
  if (Array.isArray(option.value)) return truncate(option.value.join(", "), 72);
  return String(option.value);
}

function summarizeInteractionOptions(interaction, maxLength = 240) {
  const flat = extractFlatOptions(interaction?.options?.data || []);
  if (flat.length === 0) return "aucune";

  const summary = flat
    .map((entry) => `${entry.name}=${truncate(entry.value, 64)}`)
    .join(", ");

  return truncate(summary, maxLength);
}

function extractCommandRoute(interaction) {
  const segments = [interaction?.commandName].filter(Boolean);
  let current = Array.isArray(interaction?.options?.data) ? interaction.options.data : [];

  while (Array.isArray(current) && current.length > 0 && SUBCOMMAND_TYPES.has(current[0]?.type)) {
    const next = current[0];
    segments.push(next.name);
    current = Array.isArray(next.options) ? next.options : [];
  }

  return segments.join(" ");
}

function buildInteractionContext(interaction, extra = {}) {
  return {
    route: extractCommandRoute(interaction) || interaction?.commandName || "unknown",
    guild: interaction?.guild?.name || "DM",
    guildId: interaction?.guildId || "DM",
    channel: interaction?.channel?.name || interaction?.channelId || "unknown",
    channelId: interaction?.channelId || "unknown",
    user: interaction?.user?.tag || interaction?.user?.username || "unknown",
    userId: interaction?.user?.id || "unknown",
    options: summarizeInteractionOptions(interaction),
    ...extra,
  };
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function formatContext(context) {
  if (!context || typeof context !== "object") return "";

  const entries = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${toSingleLine(typeof value === "object" ? safeStringify(value) : value)}`);

  return entries.join(" | ");
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "n/a";
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 1 : 2)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m${remainingSeconds}s`;
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "Erreur inconnue",
      stack: String(error.stack || "").trim(),
    };
  }

  return {
    name: typeof error,
    message: String(error),
    stack: "",
  };
}

module.exports = {
  buildCommandMeta,
  buildInteractionContext,
  formatContext,
  formatDuration,
  normalizeCommandName,
  normalizeModuleName,
  serializeError,
  summarizeInteractionOptions,
  truncate,
  validateCommandDefinition,
};
