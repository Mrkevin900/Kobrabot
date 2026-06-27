const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require("discord.js");
const { join } = require("path");
const pkg = require(join(__dirname, "../../../package.json"));

const botinfo = {
  data: new SlashCommandBuilder()
    .setName("botinfo")
    .setDescription("\u2728 Affiche les informations du bot")
    .setContexts(InteractionContextType.Guild),

  async executeCommand(client, interaction) {
    const embed = new EmbedBuilder()
      .setColor(client.getConfig().embed.readyColor)
      .setTitle("Informations - KobraBot")
      .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: "Version", value: pkg.version, inline: true },
        { name: "Createur", value: pkg.author.name, inline: true },
        {
          name: "Serveurs",
          value: `${interaction.client.guilds.cache.size}`,
          inline: true,
        },
        {
          name: "Utilisateurs",
          value: `${interaction.client.users.cache.size}`,
          inline: true,
        },
        {
          name: "Commandes",
          value: `${interaction.client.getCommands().length}`,
          inline: true,
        },
        {
          name: "Discord.js",
          value: `v${require("discord.js").version}`,
          inline: true,
        },
        { name: "Node", value: process.version, inline: true },
        {
          name: "Dev",
          value: "Le bot est en developpement. En cas de probleme, contacte mrkevin.",
          inline: false,
        },
      )
      .setFooter({
        text:
          "Copyright KobraBot | Mode : " +
          (process.env.PRODUCTION === "TRUE" ? "Prod" : "Test"),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  settings: {
    module: "info",
    enabled: true,
  },
};

module.exports = { default: botinfo };


