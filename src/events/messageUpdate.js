const messageUpdate = {
  async executeHandler(client, oldMessage, newMessage) {
    if (!newMessage || !newMessage.guild) return;
    if (newMessage.author?.bot) return;

    if (client.loggerManager) {
      await client.loggerManager.logMessageUpdate(oldMessage, newMessage);
    }
  },
  settings: { enabled: true },
};

module.exports = { default: messageUpdate };

