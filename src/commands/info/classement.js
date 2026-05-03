const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require("discord.js");
const { getDatabase } = require("../../database/database");
const { getLeaderboard, getProfile, getRank } = require("../../utils/levelSystem");
const { buildLevelLeaderboardCard } = require("../../utils/cards");

async function resolveGuildMember(guild, userId) {
  return guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
}

const classement = {
  data: new SlashCommandBuilder()
    .setName("classement")
    .setDescription("Affiche le top niveaux du serveur")
    .setContexts(InteractionContextType.Guild),

  async executeCommand(client, interaction) {
    await interaction.deferReply();

    const db = getDatabase();
    if (!db) {
      return interaction.editReply({
        content: "Base de donnees indisponible.",
      });
    }

    const rawTop = await getLeaderboard(db, interaction.guild.id, 10);
    if (!rawTop.length) {
      return interaction.editReply({
        content: "Aucune donnee de niveau pour le moment.",
      });
    }

    const top = [];
    for (const entry of rawTop) {
      const member = await resolveGuildMember(interaction.guild, entry.userId);
      const user = member?.user || client.users.cache.get(entry.userId) || null;
      top.push({
        ...entry,
        displayName: member?.displayName || user?.username || `Utilisateur ${entry.userId}`,
        avatarUrl: user?.displayAvatarURL?.({ extension: "png", size: 256 }) || null,
      });
    }

    const myProfile = await getProfile(db, interaction.guild.id, interaction.user.id);
    const myRank = await getRank(db, interaction.guild.id, myProfile.xp);
    const card = await buildLevelLeaderboardCard(top);

    if (card) {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Classement des niveaux")
        .setDescription(`Ton rang actuel: **#${myRank}** - Niveau **${myProfile.level}**`)
        .setImage("attachment://level-leaderboard.png")
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
        files: [card],
      });
    } else {
      // Fallback to embed with text
      const description = top
        .map((entry, index) => {
          const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `**${index + 1}.**`;
          return `${medal} ${entry.displayName} - Niveau ${entry.level} (${entry.xp} XP)`;
        })
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Classement des niveaux")
        .setDescription(`Ton rang actuel: **#${myRank}** - Niveau **${myProfile.level}**\n\n${description}`)
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
      });
    }
  },

  settings: {
    module: "info",
    enabled: true,
  },
};

module.exports = { default: classement };



