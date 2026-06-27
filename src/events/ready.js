const numabbr = require("numabbr");
const { ActivityType } = require("discord.js");
const { name, version } = require("../../package.json");
const FreeGamesWatcher = require("../utils/freeGamesWatcher");
const { fetchGmodStatus } = require("../utils/gmodStatusWatcher");
const GiveawayWatcher = require("../utils/giveawayWatcher");

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

    // Statuts rotatif - intègre dynamiquement le serveur Garry's Mod
    setInterval(async () => {
      let currentStatuses = [
        { name: `Programme : ${name}@${version}`, type: ActivityType.Listening },
        { name: `Surveille ${client.guilds.cache.size} serveurs`, type: ActivityType.Listening },
        { name: `Protege ${abbreviate(memberCount)} utilisateurs`, type: ActivityType.Listening },
        { name: "https://discord.gg/Kbrp", type: ActivityType.Listening },
      ];

      if (process.env.GMOD_STATUS_IN_PRESENCE !== "FALSE") {
        try {
          const gmod = await fetchGmodStatus();
          if (gmod && gmod.success && gmod.status === "online") {
            currentStatuses.push({
              name: `GMod: ${gmod.players}/${gmod.maxPlayers} joueurs`,
              type: ActivityType.Playing,
            });
            currentStatuses.push({
              name: `Map GMod: ${gmod.map}`,
              type: ActivityType.Playing,
            });
          }
        } catch (e) {
          // Ignore les erreurs lors de la rotation
        }
      }

      const randomiser = Math.floor(Math.random() * currentStatuses.length);
      const selected = currentStatuses[randomiser];
      client.user?.setActivity({
        name: selected.name,
        type: selected.type,
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

    if (!client.giveawayWatcher) {
      client.giveawayWatcher = new GiveawayWatcher(client);
    }
    client.giveawayWatcher.start();
  },

  settings: {
    enabled: true,
  },
};

module.exports = { default: ready };

