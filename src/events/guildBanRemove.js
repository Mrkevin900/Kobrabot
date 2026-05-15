const guildBanRemove = {
  async executeHandler(client, ban) {
    if (!(ban && ban.guild) || !(ban && ban.user)) return;
    
    if (client.loggerManager) {
      await client.loggerManager.logUnban(ban.guild, ban.user);
    }
  },
  settings: { enabled: true },
};

module.exports = { default: guildBanRemove };

