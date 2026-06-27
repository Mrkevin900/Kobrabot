require("dotenv").config();
const Application = require("./src/interfaces/application");
const logRotator = require("./src/utils/logRotator");
const ProgressionManager = require("./src/utils/ProgressionManager");
const RankCardManager = require("./src/utils/RankCardManager");

const client = new Application();
client.progressionManager = new ProgressionManager(client);
client.rankCardManager = new RankCardManager(client);

function validateEnvironment() {
  const isProd = process.env.PRODUCTION === "TRUE";

  const requiredVars = {
    PRODUCTION: "Mode production/test",
    SQL_HOST: "Host MySQL",
    SQL_USER: "Utilisateur MySQL",
    SQL_BASE: "Base de donnees MySQL",
  };

  if (isProd) {
    requiredVars.CLIENT_TOKEN_PROD = "Token Discord (production)";
    requiredVars.CLIENT_ID_PROD = "Client ID Discord (production)";
  } else {
    requiredVars.CLIENT_TOKEN_TEST = "Token Discord (test)";
    requiredVars.CLIENT_ID_TEST = "Client ID Discord (test)";
  }

  const missingVars = [];
  for (const [key, desc] of Object.entries(requiredVars)) {
    if (!process.env[key]) {
      missingVars.push(`  - ${key} (${desc})`);
    }
  }

  if (missingVars.length > 0) {
    client.getLogger().send("Variables d'environnement manquantes:", "ERROR");
    missingVars.forEach((v) => client.getLogger().send(v, "ERROR"));
    process.exit(1);
  }

  client.getLogger().send("Validation des variables d'environnement OK", "READY");
}

async function safeStart() {
  try {
    validateEnvironment();

    client.getLogger().send("KOBRABOT - Demarrage", "NOTIF");

    await client.loadDatabase();
    await client.loadHandlers();
    await client.loadCommands();
    await client.loadSyncAPI();
    
    // [PROGRESION] Demarrer le systeme de progression
    client.progressionManager.startVoiceTracking();
    client.getLogger().send("Systeme de progression (XP/Rangs) active", "READY");

    const shouldSyncCommands = process.env.SYNC_COMMANDS !== 'false';
    await client.syncInts({ commands: shouldSyncCommands });

    const token =
      process.env.PRODUCTION === "TRUE"
        ? process.env.CLIENT_TOKEN_PROD
        : process.env.CLIENT_TOKEN_TEST;

    if (!token) {
      client.getLogger().send("Token Discord manquant", "ERROR");
      process.exit(1);
    }

    await client.login(token);
    client.getLogger().setClient(client);
    client.getLogger().send("BOT CONNECTE ET OPERATIONNEL", "READY");

    // Démarrage du serveur API Express pour l'interconnexion
    const { startServer } = require("./src/api/apiServer");
    startServer(client);
  } catch (error) {
    client.getLogger().send(`Erreur critique au demarrage: ${error.message}`, "ERROR");
    if (error.stack) {
      client.getLogger().send(error.stack, "DEBUG");
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
    process.exit(1);
  }
}

process.on("unhandledRejection", async (error) => {
  client.getLogger().send(`Unhandled Rejection: ${error.message}`, "ERROR");
  if (error.stack) {
    client.getLogger().send(error.stack, "DEBUG");
  }
});

process.on("uncaughtException", async (error) => {
  client.getLogger().send(`Uncaught Exception: ${error.message}`, "ERROR");
  if (error.stack) {
    client.getLogger().send(error.stack, "DEBUG");
  }

  await new Promise((resolve) => setTimeout(resolve, 3000));
  process.exit(1);
});

process.on("SIGINT", async () => {
  client.getLogger().send("Arret du bot (SIGINT)", "ALERT");
  client.freeGamesWatcher?.cleanup?.();
  await client.destroy();
  logRotator.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  client.getLogger().send("Arret du bot (SIGTERM)", "ALERT");
  client.freeGamesWatcher?.cleanup?.();
  await client.destroy();
  logRotator.close();
  process.exit(0);
});

safeStart();

module.exports = client;


