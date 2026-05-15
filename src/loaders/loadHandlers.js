const { readdirSync } = require("fs");
const { join } = require("path");
const Logger = require("../utils/logger.runtime");

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
  const handlersPath = join(__dirname, "..", "events");
  const files = readdirSync(handlersPath).filter((f) => f.endsWith(".js"));

  let loadedCount = 0;

  send("Demarrage de la methode LoadHandlers...", "METHOD");

  for (const file of files) {
    try {
      const mod = require(join(handlersPath, file));
      const handler = mod && (mod.default || mod);
      const handlerName = file.split(".")[0];

      if (!handler || !handler.executeHandler) {
        send(`Handler mal structure (${handlerName}) - ignore`, "DEBUG");
        continue;
      }

      const isEnabled = handler.settings?.enabled !== false;
      if (!isEnabled) {
        send(`Handler desactive: ${handlerName}`, "DEBUG");
        continue;
      }

      client.on(handlerName, (...args) => handler.executeHandler(client, ...args));
      send(`Handler charge: ${handlerName}`, "HANDLER");
      loadedCount++;
    } catch (error) {
      send(`Erreur en chargeant ${file}: ${error.message}`, "ERROR");
    }
  }

  send(`Methode loadHandlers terminee : ${loadedCount} handlers charges`, "METHOD");
};

