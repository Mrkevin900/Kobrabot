const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, PermissionFlagsBits } = require("discord.js");

const say = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("\u2728 Envoie un message")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("\u2728 Le message à envoyer")
        .setRequired(true)
    ),

  async executeCommand(client, interaction) {
    const message = interaction.options.getString("message");

    await interaction.channel.send(message);
    await interaction.reply({
      content: "✅ Message envoyé !",
      ephemeral: true,
    });
  },

  settings: {
    module: "fun",
    enabled: true,
  },
};

module.exports = { default: say };


