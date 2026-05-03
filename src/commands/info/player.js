const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");

const player = {
  data: new SlashCommandBuilder()
    .setName("player")
    .setDescription("\u2728 📊 Affiche les informations d'un joueur RP")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName("membre")
        .setDescription("\u2728 Membre Discord à rechercher")
        .setRequired(true),
    ),

  async executeCommand(client, interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const KobralostAPI = require("../../utils/KobralostAPI");
    const api = new KobralostAPI(client);

    const member = interaction.options.getUser("membre");
    if (!member) {
      return interaction.editReply("❌ Membre introuvable.");
    }

    const result = await api.getPlayer(member.id);

    if (!result.success) {
      return interaction.editReply({
        content: `❌ Impossible de récupérer les données du joueur.\n\n**Erreur:** ${result.error}\n**Status:** ${result.status || "N/A"}`,
      });
    }

    const playerData = result.data;

    if (!playerData) {
      return interaction.editReply({
        content: `❌ Aucune donnée trouvée pour ${member.toString()}.\n\nLe joueur n'est peut-être pas enregistré sur le serveur RP.`,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 Profil RP de ${member.username}`)
      .setThumbnail(member.displayAvatarURL({ size: 256 }))
      .setColor(0x0099ff)
      .setTimestamp();

    if (playerData.name || playerData.firstname) {
      embed.addFields({
        name: "👤 Prénom RP",
        value: playerData.name || playerData.firstname || "Non défini",
        inline: true,
      });
    }

    if (playerData.roles && Array.isArray(playerData.roles)) {
      const roleNames = playerData.roles
        .filter((r) => typeof r === "object" && r.name)
        .map((r) => r.name)
        .join(", ");

      if (roleNames) {
        embed.addFields({
          name: "🎭 Rôles Staff/Modération",
          value: roleNames || "Aucun",
          inline: false,
        });
      }
    }

    if (playerData.playtime !== undefined) {
      const hours = Math.floor(playerData.playtime / 60);
      const minutes = playerData.playtime % 60;
      embed.addFields({
        name: "⏱️ Temps de jeu",
        value: `${hours}h ${minutes}min`,
        inline: true,
      });
    }

    if (playerData.level !== undefined) {
      embed.addFields({
        name: "📈 Niveau",
        value: `${playerData.level}`,
        inline: true,
      });
    }

    if (playerData.money !== undefined) {
      embed.addFields({
        name: "💰 Argent",
        value: `$${playerData.money.toLocaleString("fr-FR")}`,
        inline: true,
      });
    }

    if (playerData.job) {
      embed.addFields({
        name: "💼 Métier",
        value: playerData.job,
        inline: true,
      });
    }

    if (playerData.gang || playerData.organization) {
      embed.addFields({
        name: "👥 Organisation",
        value: playerData.gang || playerData.organization || "Aucune",
        inline: true,
      });
    }

    if (playerData.warnings !== undefined) {
      embed.addFields({
        name: "⚠️ Avertissements",
        value: `${playerData.warnings}`,
        inline: true,
      });
    }

    if (playerData.bans !== undefined) {
      embed.addFields({
        name: "🚫 Bannissements",
        value: `${playerData.bans}`,
        inline: true,
      });
    }

    embed.setFooter({ text: `ID Discord: ${member.id}` });

    return interaction.editReply({ embeds: [embed] });
  },

  settings: {
    module: "info",
    enabled: true,
  },
};

module.exports = { default: player };



