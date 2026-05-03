const {
  bumpCounter,
  fetchAuditExecutor,
  isFeatureEnabled,
  logSecurity,
  punishExecutor,
} = require("../utils/SecurityUtils");

const guildBanAdd = {
  async executeHandler(client, ban) {
    if (!(ban && ban.guild) || !(ban && ban.user)) return;
    
    if (client.loggerManager) {
      await client.loggerManager.logBan(ban.guild, ban.user, ban.reason);
    }

    const guild = ban.guild;
    const executor = await fetchAuditExecutor(guild, "ban", ban.user.id);

    if (isFeatureEnabled("antiban", guild.id)) {
      await guild.members.unban(ban.user.id, "Anti-ban active").catch(() => null);
      logSecurity(client, `Ban annule: ${ban.user.tag} (${ban.user.id})`);
      await punishExecutor(client, guild, executor, "Anti-ban active");
      return;
    }

    if (executor && isFeatureEnabled("antimassban", guild.id)) {
      const count = bumpCounter("ban", guild.id, executor.id, 30000);
      if (count >= 3) {
        await punishExecutor(client, guild, executor, "Anti-mass-ban active");
      }
    }
  },
  settings: { enabled: true },
};

module.exports = { default: guildBanAdd };


