const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
} = require("discord.js");

const ball = {
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("🔮 Pose une question à la boule de cristal")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("La question à poser")
        .setRequired(true),
    ),

  async executeCommand(client, interaction) {
    const question = interaction.options.getString("question");

    if (!question) {
      return interaction.reply({
        content: ":x: Question incorrecte",
        ephemeral: true,
      });
    }

    let replies = ["Oui !", "Non !", "Probablement que oui !", "Probablement que non !", "Peut-être !"];

    let result = Math.floor((Math.random() * replies.length));

    const embed = new EmbedBuilder()
      .setColor(client.getConfig().embed.readyColor)
      .setTitle("🔮 Boule de Cristal")
      .addFields(
        { name: "Question", value: question, inline: false },
        { name: "Réponse", value: `||${replies[result]}||`, inline: false }
      )
      .setFooter({ text: `KobraBot | ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  settings: {
    module: "fun",
  },
};

module.exports = ball;
