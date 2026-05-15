const messageDelete = {
  async executeHandler(client, message) {
    if (!message || !message.guild) return;
    if (message.author?.bot) return;

    if (client.loggerManager) {
      await client.loggerManager.logMessageDelete(message);
    }
  },
  settings: { enabled: true },
};

module.exports = { default: messageDelete };

