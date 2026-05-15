const { readdirSync, statSync, existsSync } = require("fs");
const { join } = require("path");
const Logger = require("../utils/logger.runtime");
const { validateCommandDefinition } = require("../utils/CommandUtils");

function parseDisabledCommandsFromEnv() {
  const raw = process.env.DISABLED_COMMANDS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function createSender(client) {
  const logger = client?.getLogger?.();
  if (logger && typeof logger.send === "function") {
    return (message, status = "INFO") => logger.send(message, status);
  }

  const fallback = new Logger();
  return (message, status = "INFO") => fallback.send(message, status);
}

module.exports = async (client) => {
  const send = createSender(client);
  const commandsPath = join(__dirname, "..", "commands");
  const blockedCommands = new Set(["syncstatus"]);
  const envBlocked = parseDisabledCommandsFromEnv();
  const seenCommands = new Map();
  const moduleCounters = new Map();

  let loadedCount = 0;
  let disabledCount = 0;
  let errorCount = 0;

  function scanDir(dirPath) {
    const items = readdirSync(dirPath).sort((a, b) => a.localeCompare(b, "fr"));

    for (const item of items) {
      const itemPath = join(dirPath, item);
      const stat = statSync(itemPath);

      if (stat.isDirectory()) {
        scanDir(itemPath);
        continue;
      }

      if (!item.endsWith(".js")) {
        continue;
      }

      try {
        const mod = require(itemPath);
        const command = mod && (mod.default || mod);
        if (
          command &&
          typeof command === "object" &&
          typeof command.run === "function" &&
          command.name &&
          !command.data
        ) {
          continue;
        }

        const effective = command;
        const validation = validateCommandDefinition(effective, itemPath);
        const { valid, issues, meta } = validation;
        const lowered = meta.commandName;

        if (!valid) {
          errorCount++;
          send(
            `Commande invalide ignoree: ${meta.displayName} (${issues.join(", ")}) [${meta.source}]`,
            "WARN",
          );
          continue;
        }

        if (blockedCommands.has(lowered) || envBlocked.has(lowered)) {
          disabledCount++;
          send(`Commande desactivee (blacklist): /${meta.commandName} [${meta.source}]`, "DEBUG");
          continue;
        }

        const isEnabled = effective.settings?.enabled !== false;
        if (!isEnabled) {
          disabledCount++;
          send(`Commande desactivee (settings): /${meta.commandName} [${meta.source}]`, "DEBUG");
          continue;
        }

        if (seenCommands.has(meta.commandName) || client.getCommand?.(meta.commandName)) {
          errorCount++;
          send(
            `Commande en doublon ignoree: /${meta.commandName} [${meta.source}] deja vue dans ${seenCommands.get(meta.commandName)}`,
            "ERROR",
          );
          continue;
        }

        client.registerCommand(effective, {
          commandName: meta.commandName,
          displayName: meta.displayName,
          moduleName: meta.moduleName,
          source: meta.source,
          filePath: itemPath,
        });
        seenCommands.set(meta.commandName, meta.source);
        moduleCounters.set(meta.moduleName, (moduleCounters.get(meta.moduleName) || 0) + 1);
        send(
          `Commande chargee: /${meta.commandName} [module=${meta.moduleName}] [source=${meta.source}]`,
          "COMMAND",
        );
        loadedCount++;
      } catch (error) {
        send(`Erreur en chargeant ${item}: ${error.message}`, "ERROR");
        errorCount++;
      }
    }
  }

  send("Demarrage de la methode LoadCommands...", "METHOD");

  if (!existsSync(commandsPath)) {
    send(`Dossier commandes introuvable: ${commandsPath}`, "ERROR");
    return;
  }

  scanDir(commandsPath);

  const moduleSummary = Array.from(moduleCounters.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "fr"))
    .map(([moduleName, count]) => `${moduleName}:${count}`)
    .join(", ");

  send(
    `Methode loadCommands terminee : ${loadedCount} commandes chargees, ${disabledCount} desactivees, ${errorCount} erreur(s)`,
    "METHOD",
  );

  if (moduleSummary) {
    send(`Repartition des commandes: ${moduleSummary}`, "DEBUG");
  }

  if (errorCount > 0) {
    send(`${errorCount} erreurs lors du chargement`, "ERROR");
  }
};


