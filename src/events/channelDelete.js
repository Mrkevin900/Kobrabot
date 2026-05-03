const channelDelete = {
  async executeHandler(client, channel) {
    if (!(channel && channel.guild)) return;
    const logger = client.getLogger && client.getLogger();
    if (logger && typeof logger.send === "function") {
      logger.send(`[SERVER] Salon supprime | #${channel.name || channel.id} | type=${channel.type}`, "SERVER");
    }
  },
  settings: { enabled: true },
};

module.exports = { default: channelDelete };

