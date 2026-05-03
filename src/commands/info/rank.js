const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require("discord.js");
const { getDatabase } = require("../../database/database");
const { getProfile, getRank, xpForLevel } = require("../../utils/levelSystem");
const { buildLevelUpCard } = require("../../utils/cards");

function buildBar(progress, total, size = 12) {
  const safeTotal = Math.max(1, total);
  const ratio = Math.max(0, Math.min(1, progress / safeTotal));
  const filled = Math.round(ratio * size);
  return `${"█".repeat(filled)}${"░".repeat(size - filled)}`;
}

const rank = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("📊 Affiche ton niveau et ton XP")
    .addUserOption((option) =>
      option.setName("utilisateur").setDescription("👤 Voir le niveau de quelqu'un")
    )
    .setContexts(InteractionContextType.Guild),

  async executeCommand(client, interaction) {
    await interaction.deferReply();

    const db = getDatabase();
    if (!db) {
      return interaction.editReply({
        content: "Base de donnees indisponible.",
      });
    }

    const user = interaction.options.getUser("utilisateur") || interaction.user;
    const member =
      interaction.guild.members.cache.get(user.id) ||
      (await interaction.guild.members.fetch(user.id).catch(() => null));

    const profile = await getProfile(db, interaction.guild.id, user.id);
    const rankPos = await getRank(db, interaction.guild.id, profile.xp);

    const currentBase = xpForLevel(profile.level);
    const nextBase = xpForLevel(profile.level + 1);
    const progress = profile.xp - currentBase;
    const needed = Math.max(1, nextBase - currentBase);

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle(`Niveau de ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "Niveau", value: `${profile.level}`, inline: true },
        { name: "Rang", value: `#${rankPos}`, inline: true },
        { name: "XP total", value: `${profile.xp}`, inline: true },
        { name: "Progression", value: `${buildBar(progress, needed)}\n${progress}/${needed}`, inline: false }
      )
      .setTimestamp();

    const card = await buildLevelUpCard({
      member: member || { user, roles: null },
      level: profile.level,
      xp: profile.xp,
      rank: rankPos,
      progress,
      needed,
    });

    embed.setImage("attachment://levelup-card.png");
    await interaction.editReply({ embeds: [embed], files: [card] });
  },

  settings: {
    module: "general",
    enabled: true,
  },
};

module.exports = { default: rank };


