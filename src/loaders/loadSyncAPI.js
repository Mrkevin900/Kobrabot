const SyncAPI = require("../utils/syncAPI");
const SyncLogger = require("../utils/SyncLogger");
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

  try {
    const KobralostAPI = require("../utils/KobralostAPI");
    client.kobralostAPI = new KobralostAPI(client);
    send("KobralostAPI V2 initialise", "NOTIF");

    client.syncAPI = new SyncAPI(client);
    // Do not start background loops before Discord is ready.
    // They are started in the `ready` handler to avoid long startup sleeps.
    send("SyncAPI charge (initialisation des tasks au ready)", "NOTIF");

    client.syncLogger = new SyncLogger(client, client.syncAPI);
    send("SyncLogger initialise", "NOTIF");
    send("Synchronisation API prete et fonctionnelle", "NOTIF");
  } catch (error) {
    send(`Erreur lors du chargement du systeme API: ${error.message}`, "ERROR");
    if (error.stack) {
      send(error.stack, "DEBUG");
    }
  }
};

