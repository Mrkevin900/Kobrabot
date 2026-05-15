const autoModerationActionExecution = {
  async executeHandler(client, actionExecution) {
    if (!actionExecution.guild) return;

    if (client.loggerManager) {
      await client.loggerManager.logAutoMod(actionExecution).catch(() => null);
    }
  },
  settings: { enabled: true }
};

module.exports = { default: autoModerationActionExecution };
