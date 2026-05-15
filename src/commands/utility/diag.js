const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");
const KobralostAPI = require("../../utils/KobralostAPI");
const { ensureDatabaseConnection, getDatabase } = require("../../database/database");

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}j ${hours}h ${minutes}m ${secs}s`;
}

const diag = {
  data: new SlashCommandBuilder()
    .setName("diag")
    .setDescription("Affiche un diagnostic global du bot")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async executeCommand(client, interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let dbOk = false;
    try {
      const db = (await ensureDatabaseConnection(client)) || getDatabase();
      if (db) {
        await db.raw("SELECT 1");
        dbOk = true;
      }
    } catch (_) {
      dbOk = false;
    }

    const api = new KobralostAPI(client);
    const apiConfigured = api.isConfigured();
    const apiOk = apiConfigured ? await api.testConnection() : false;

    const syncAPI = client.syncAPI;
    const freeGamesWatcher = client.freeGamesWatcher;
    const embed = new EmbedBuilder()
      .setColor(dbOk && (apiOk || !apiConfigured) ? 0x57f287 : 0xfaa61a)
      .setTitle("Diagnostic Bot")
      .addFields(
        {
          name: "Systeme",
          value:
            `Ping WS: **${client.ws.ping}ms**\n` +
            `Uptime: **${formatUptime(process.uptime())}**\n` +
            `RAM RSS: **${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB**`,
          inline: false,
        },
        {
          name: "Services",
          value:
            `Database: **${dbOk ? "OK" : "KO"}**\n` +
            `API Kobralost: **${apiConfigured ? (apiOk ? "OK" : "KO") : "NON CONFIGUREE"}**\n` +
            `SyncAPI: **${syncAPI ? "CHARGEE" : "ABSENTE"}**\n` +
            `FreeGames: **${freeGamesWatcher ? "CHARGE" : "ABSENT"}**`,
          inline: false,
        },
        {
          name: "Runtime",
          value:
            `Commandes chargees: **${client.getCommands().length}**\n` +
            `Guilds: **${client.guilds.cache.size}**\n` +
            `Queue pseudos: **${syncAPI?._nick_queue?.length || 0}**\n` +
            `Syncs en cours: **${syncAPI?._sync_in_progress?.size || 0}**`,
          inline: false,
        },
        {
          name: "Configuration rapide",
          value:
            `Mode: **${process.env.PRODUCTION === "TRUE" ? "PRODUCTION" : "TEST"}**\n` +
            `Salon suggestions: **${process.env.SUGGEST_CHANNEL_ID ? "CONFIGURE" : "NON CONFIGURE"}**\n` +
            `Salon logs: **${process.env.LOGS_CHANNEL_ID ? "CONFIGURE" : "NON CONFIGURE"}**`,
          inline: false,
        },
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: diag };


