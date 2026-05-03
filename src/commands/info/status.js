const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require("discord.js");
const { join } = require("path");
const { name, version } = require(join(__dirname, "../../../package.json"));

const status = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Affiche le statut du bot KobraBot")
    .setContexts(InteractionContextType.Guild),

  async executeCommand(client, interaction) {
    const ping = client.ws.ping;
    const uptime = process.uptime();
    let memberCount = 0;

    client.guilds.cache.forEach((guild) => {
      memberCount += guild.memberCount;
    });

    const formatUptime = (seconds) => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      return `${days}j ${hours}h ${minutes}m ${secs}s`;
    };

    const ramMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

    let pingColor = "#00FF00";
    if (ping > 100) pingColor = "#FFFF00";
    if (ping > 200) pingColor = "#FF5500";
    if (ping > 300) pingColor = "#FF0000";

    const embed = new EmbedBuilder()
      .setColor(pingColor)
      .setTitle("Statut - KobraBot")
      .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: "Etat", value: "En ligne et actif", inline: true },
        { name: "Ping", value: `\`${ping}ms\``, inline: true },
        { name: "Uptime", value: `\`${formatUptime(uptime)}\``, inline: true },
        { name: "Serveurs", value: `\`${interaction.client.guilds.cache.size}\``, inline: true },
        { name: "Utilisateurs", value: `\`${memberCount.toLocaleString()}\``, inline: true },
        { name: "RAM (RSS)", value: `\`${ramMb} MB\``, inline: true },
        { name: "Version", value: `${name} v${version}`, inline: true },
        {
          name: "Technos",
          value: `Node.js ${process.version}\nDiscord.js v${require("discord.js").version}`,
          inline: false,
        }
      )
      .setFooter({ text: "KobraBot | Mode: " + (process.env.PRODUCTION === "TRUE" ? "PRODUCTION" : "TEST") })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  settings: {
    module: "info",
    enabled: true,
  },
};

module.exports = { default: status };

