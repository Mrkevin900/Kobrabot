const numabbr = require("numabbr");
const { ActivityType } = require("discord.js");
const { name, version } = require("../../package.json");
const FreeGamesWatcher = require("../utils/freeGamesWatcher");

const abbreviate =
  typeof numabbr === "function" ? numabbr : numabbr.default || numabbr;
const ready = {
  async executeHandler(client) {
    let memberCount = 0;
    let guildCount = client.guilds.cache.size;
    client.guilds.cache.forEach((guild) => {
      memberCount += guild.memberCount;
    });

    if (typeof client.loadApplicationEmojis === "function") {
      const loadedApplicationEmojis = await client.loadApplicationEmojis();
      client.getLogger()?.send(`Emojis application charges: ${loadedApplicationEmojis}`, "INFO");
    }

    // Statuts rotatif inspire de bot1 - plus de variete
    let statuts = [
      `Programme : ${name}@${version}`,
      `Surveille ${client.guilds.cache.size} serveurs`,
      `Protege ${abbreviate(memberCount)} utilisateurs`,
      "https://discord.gg/Kbrp",
    ];

    setInterval(() => {
      let randomiser = Math.floor(Math.random() * statuts.length);
      client.user?.setActivity({
        name: statuts[randomiser],
        type: ActivityType.Listening,
      });
    }, 20000);

    client
      .getLogger()
      .send(
        `Le client est maintenant connecte en tant que : ${client.user?.tag}`,
        "READY",
        {
          guilds: guildCount,
          members: memberCount,
          commands: client.getCommands().length,
        },
      );

    // Initialiser la synchronisation API si disponible
    if (client.syncAPI) {
      await client.syncAPI.init();

      // Envoyer le menu de synchronisation apres un court delai
      setTimeout(async () => {
        try {
          await client.syncAPI.sendSyncMenu();
          client.getLogger().send("Menu de synchronisation envoye", "INFO");
        } catch (e) {
          client
            .getLogger()
            .send(`Erreur envoi menu sync: ${e.message}`, "WARN");
        }
      }, 3000);

      client
        .getLogger()
        .send("Systeme de synchronisation API initialise", "INFO");
    }

    if (client.autoModManager) {
      await client.autoModManager.syncAllGuilds();
      client.getLogger().send("Règles natives AutoMod synchronisées", "INFO");
    }

    if (!client.freeGamesWatcher) {
      client.freeGamesWatcher = new FreeGamesWatcher(client);
    }
    await client.freeGamesWatcher.init();
  },

  settings: {
    enabled: true,
  },
};

module.exports = { default: ready };

