const channelUpdate = {
  async executeHandler(client, oldChannel, newChannel) {
    if (!(newChannel && newChannel.guild)) return;
    if (((oldChannel && oldChannel.name) || "") === ((newChannel && newChannel.name) || "")) return;

    const logger = client.getLogger && client.getLogger();
    if (logger && typeof logger.send === "function") {
      logger.send(
        `[SERVER] Salon renomme | #${(oldChannel && (oldChannel.name || oldChannel.id)) || "inconnu"} -> #${(newChannel && (newChannel.name || newChannel.id)) || "inconnu"}`,
        "SERVER",
      );
    }
  },
  settings: { enabled: true },
};

module.exports = { default: channelUpdate };

