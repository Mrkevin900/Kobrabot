const { InteractionContextType, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const ping = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("✨ Affiche le ping du bot et de l'API Discord")
    .setContexts(InteractionContextType.Guild),

  async executeCommand(client, interaction) {
    const msgPing = Date.now() - interaction.createdTimestamp;
    const apiPing = client.ws.ping;
    const mascot = client.mascot("\u{1F497}");

    const getMsgEmoji = (ping) =>
      ping <= 200 ? client.emoji("public", "\u{1F7E2}") : ping <= 400 ? client.emoji("status", "\u{1F7E0}") : client.emoji("blacklist", "\u{1F534}");
    const getApiEmoji = (ping) =>
      ping <= 150 ? client.emoji("public", "\u{1F7E2}") : ping <= 300 ? client.emoji("status", "\u{1F7E0}") : client.emoji("blacklist", "\u{1F534}");

    const embed = new EmbedBuilder()
      .setColor(client.getConfig().embed.readyColor)
      .setTitle(`${mascot} Ping - KobraBot`)
      .setDescription(
        `${getMsgEmoji(msgPing)} **Ping Message** : \`${msgPing}ms\`\n` +
        `${getApiEmoji(apiPing)} **API Discord** : \`${apiPing}ms\``,
      )
      .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ping_refresh")
        .setLabel("Actualiser")
        .setEmoji(client.emoji("refresh", "\u{1F504}"))
        .setStyle(ButtonStyle.Success),
    );

    await interaction.reply({ embeds: [embed], components: [button], ephemeral: false });
  },

  settings: {
    module: "general",
    enabled: true,
  },
};

module.exports = { default: ping };
