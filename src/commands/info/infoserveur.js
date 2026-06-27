const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require("discord.js");
const { fetchGmodStatus } = require("../../utils/gmodStatusWatcher");

const infoserveur = {
  data: new SlashCommandBuilder()
    .setName("infoserveur")
    .setDescription("Affiche les informations du serveur Garry's Mod Kobralost")
    .setContexts(InteractionContextType.Guild),

  async executeCommand(client, interaction) {
    await interaction.deferReply();

    try {
      const collectionUrl = process.env.GMOD_COLLECTION_URL || "https://kobralost-rp.fr/addons";
      const dashboardUrl = process.env.GMOD_DASHBOARD_URL || "https://dashboard.kobralost-rp.fr/";
      const rawIp = process.env.GMOD_SERVER_IP || "play.kobralost-rp.fr";
      const joinUrl = rawIp.startsWith("steam://") ? rawIp : `steam://connect/${rawIp}`;

      const isOnline = true;
      const statusEmoji = "🟢";
      const statusText = "En ligne";
      const playersCount = client.gmodOnlinePlayers?.length || 0;
      const maxPlayers = client.gmodServerInfo?.maxPlayers || 64;
      const mapName = "rp_rockford_v2b";
      const serverName = process.env.GMOD_SERVER_NAME_OVERRIDE || "[FR] 💎 Kobralost Roleplay 🚀 | Exclu | 100K START | Famille | KBRP";
      
      const embed = new EmbedBuilder()
        .setColor(client.getConfig().embed.readyColor)
        .setTitle("Information du serveur")
        .addFields(
          {
            name: "🦉 Nom du serveur",
            value: serverName,
            inline: false,
          },
          {
            name: `${statusEmoji} Statut du serveur`,
            value: `${statusText} (${playersCount}/${maxPlayers})`,
            inline: true,
          },
          {
            name: "🏡 Map actuelle",
            value: mapName,
            inline: true,
          },
          {
            name: "📚 Collection du serveur",
            value: collectionUrl,
            inline: false,
          },
          {
            name: "💎 Dashboard du serveur",
            value: dashboardUrl,
            inline: false,
          },
          {
            name: "🌐 Rejoindre le serveur",
            value: joinUrl,
            inline: false,
          }
        )
        .setFooter({ text: "Kobralost RôlePlay" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      client.getLogger()?.send(`Erreur commande infoserveur: ${error.message}`, "ERROR");
      await interaction.editReply({
        content: "❌ Une erreur est survenue lors de la récupération des informations du serveur GMod.",
      });
    }
  },

  settings: {
    module: "info",
    enabled: true,
  },
};

module.exports = { default: infoserveur };
