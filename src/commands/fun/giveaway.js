const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType } = require("discord.js");

const giveaway = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("\u2728 Lance un giveaway sur le serveur")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName("titre")
        .setDescription("\u2728 Le titre du giveaway")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("duree")
        .setDescription("\u2728 Durée du giveaway (ex: 1h, 30m)")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("gagnants")
        .setDescription("\u2728 Nombre de gagnants")
        .setRequired(true)
        .setMinValue(1)
    ),

  async executeCommand(client, interaction) {
    const titre = interaction.options.getString("titre");
    const duree = interaction.options.getString("duree");
    const gagnants = interaction.options.getInteger("gagnants");

    const embed = new EmbedBuilder()
      .setColor(client.getConfig().embed.readyColor)
      .setTitle("🎁 Giveaway")
      .setDescription(`Prix : **${titre}**\nNombre de gagnants : **${gagnants}**`)
      .setFooter({ text: `Giveaway lancé par ${interaction.user.username}` })
      .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("giveaway_participate")
        .setLabel("Participer")
        .setEmoji(client.emoji("party", "\u{1F389}"))
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ embeds: [embed], components: [button] });
  },

  settings: {
    module: "fun",
    enabled: true,
  },
};

module.exports = { default: giveaway };


