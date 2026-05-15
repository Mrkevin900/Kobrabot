const insertGuild = require("../utils/Scripts/insertGuild");

const guildCreate = {
  async executeHandler(client, guild) {
    try {
      await insertGuild(guild);
      client
        .getLogger()
        .send("Nouvelle entrée serveur crée :" + guild.name, "NOTIF");
    } catch (error) {
      client.getLogger().send("Erreur Database :" + error, "ERROR");
    }
  },

  settings: {
    enabled: true,
  },
};

module.exports = { default: guildCreate };

