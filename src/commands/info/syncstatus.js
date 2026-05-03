const { SlashCommandBuilder } = require("discord.js");

const SyncStatus = {
  data: new SlashCommandBuilder()
    .setName("syncstatus")
    .setDescription("\u2728 Affiche le statut de la synchronisation"),

  async executeCommand(client, interaction) {
    if (!client.syncAPI) {
      return interaction.reply({
        content: "❌ Le système de synchronisation n'est pas initialisé.",
        ephemeral: true,
      });
    }

    await client.syncAPI.handleStatusCommand(interaction);
  },

  settings: {
    enabled: false,
  },
};

module.exports = { default: SyncStatus };


