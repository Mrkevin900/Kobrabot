const {
  fetchAuditExecutor,
  isFeatureEnabled,
  logSecurity,
  punishExecutor,
} = require("../utils/SecurityUtils");

const channelCreate = {
  async executeHandler(client, channel) {
    if (!(channel && channel.guild)) return;
    const logger = client.getLogger && client.getLogger();
    if (logger && typeof logger.send === "function") {
      logger.send(`[SERVER] Salon cree | #${channel.name || channel.id} | type=${channel.type}`, "SERVER");
    }

    if (!isFeatureEnabled("antichannel", channel.guild.id)) return;

    const executor = await fetchAuditExecutor(channel.guild, "channelCreate", channel.id);
    await channel.delete("Anti-channel active").catch(() => null);
    logSecurity(client, `Salon cree supprime: ${channel.name || channel.id}`);
    await punishExecutor(client, channel.guild, executor, "Anti-channel active");
  },
  settings: { enabled: true },
};

module.exports = { default: channelCreate };


