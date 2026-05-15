const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const dayjs = require("dayjs");

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
    await interaction.deferReply();

    const KobralostAPI = require("../../utils/KobralostAPI");
    const api = new KobralostAPI(client);

    const member = interaction.options.getUser("membre") || interaction.user;
    if (!member) {
      return interaction.editReply("❌ Membre introuvable.");
    }

    // Resolve player UUID first
    let uuid = null;
    let playerData = null;
    let result = await api.getMember(member.id);
    
    if (result.success && result.data) {
        playerData = result.data;
        uuid = playerData.uuid;
    } else {
        const searchResult = await api.getPlayersList({ search: member.username });
        if (searchResult.success && Array.isArray(searchResult.data)) {
            playerData = searchResult.data.find(p => 
                (p.accountId && String(p.accountId) === String(member.id)) ||
                (p.accountName && p.accountName.toLowerCase() === member.username.toLowerCase()) || 
                (p.name && p.name.toLowerCase().includes(member.username.toLowerCase()))
            );
            if (playerData) uuid = playerData.uuid;
        }
    }

    await interaction.editReply({ 
        content: `⌛ Demande d'autorisation envoyée par MP à **${member.username}**... En attente d'approbation.`
    });

    const pollCallback = async () => {
        if (!uuid) {
            const memberRes = await api.getMember(member.id);
            if (memberRes.success && memberRes.data?.uuid) {
                uuid = memberRes.data.uuid;
            }
        }
        if (!uuid) return false;
        
        const res = await api.getPlayerStatus(uuid);
        return res.status !== 403;
    };

    // Permission System: Ask target for approval via DM
    const PermissionManager = require("../../utils/PermissionManager");
    const approved = await PermissionManager.requestApproval(
        client, 
        interaction.user, 
        member, 
        "Profil RP",
        pollCallback
    );

    if (!approved) {
        return interaction.editReply({ 
            content: `❌ L'accès au profil de **${member.username}** a été refusé ou la demande a expiré.`
        });
    }

    // Re-fetch playerData if we were unauthorized before
    if (!playerData || result.status === 403) {
        result = await api.getMember(member.id);
        if (result.success && result.data) {
            playerData = result.data;
            uuid = playerData.uuid;
        }
    }

    if (!playerData) {
      return interaction.editReply({
        content: `❌ Impossible de récupérer les données du joueur.\n\nLe joueur n'est peut-être pas enregistré sur le serveur RP ou n'est pas lié à son compte Discord.\n**Status:** ${result.status || "N/A"}`,
      });
    }

    // Fetch status if UUID is available
    let statusText = "Inconnu";
    if (uuid) {
        const statusResult = await api.getPlayerStatus(uuid);
        if (statusResult.success && statusResult.data) {
            const s = statusResult.data;
            const tags = [];
            if (s.online) tags.push("🟢 En ligne");
            if (s.inQueue) tags.push("⏳ En file d'attente");
            if (s.offline && !s.online && !s.inQueue) tags.push("🔴 Hors ligne");
            if (s.banned) tags.push("🚫 Banni");
            if (s["discord-banned"]) tags.push("💀 Banni Discord");
            if (s["discord-timedout"]) tags.push("🔇 Timeout Discord");
            if (s.suspended) tags.push("🛑 Suspendu");
            
            if (tags.length > 0) statusText = tags.join(" | ");
            else if (s.offline) statusText = "🔴 Hors ligne";
        }
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 Profil RP de ${member.username}`)
      .setThumbnail(member.displayAvatarURL({ size: 256 }))
      .setColor(0x0099ff)
      .addFields({ name: "📡 Statut", value: statusText, inline: false })
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

    // New: Fetch session if online
    if (playerData.uuid && statusText.includes("En ligne")) {
        const sessionResult = await api.getPlayerSessions(member.id);
        if (sessionResult.success && Array.isArray(sessionResult.data) && sessionResult.data.length > 0) {
            const lastSession = sessionResult.data[0];
            if (!lastSession.finished_at) {
                const startTime = dayjs(lastSession.created_at);
                const duration = dayjs().diff(startTime, 'minute');
                embed.addFields({
                    name: "🎮 Session en cours",
                    value: `Depuis <t:${Math.floor(startTime.valueOf() / 1000)}:R> (${duration} min)`,
                    inline: false
                });
            }
        }
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



