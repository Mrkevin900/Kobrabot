const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require("discord.js");

const boost = {
  data: new SlashCommandBuilder()
    .setName("boost")
    .setDescription("\u2728 Remercie un membre pour avoir boosté le serveur")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) =>
      option
        .setName("membre")
        .setDescription("\u2728 Le membre à remercier")
        .setRequired(true)
    ),

  async executeCommand(client, interaction) {
    const guild = interaction.guild;
    const membre = interaction.options.getUser("membre");

    if (!guild) {
      return interaction.reply({
        content: "❌ Cette commande ne peut être utilisée que sur un serveur.",
        ephemeral: true,
      });
    }

    const boostCount = guild.premiumSubscriptionCount || 0;
    const boostTier = guild.premiumTier;

    const tiers = {
      0: "Aucun",
      1: "Niveau 1 ⭐",
      2: "Niveau 2 ⭐⭐",
      3: "Niveau 3 ⭐⭐⭐",
    };

    const embed = new EmbedBuilder()
      .setColor("#FF1493")
      .setTitle("🎉 Merci pour le boost !")
      .setDescription(
        `💖 Un énorme merci à ${membre} pour avoir boosté **${guild.name}** !\n\n` +
        `Grâce à toi, la communauté débloque des avantages exclusifs.`
      )
      .setThumbnail(membre.displayAvatarURL({ dynamic: true, size: 512 }))
      .addFields(
        { name: "📦 Nombre total de boosts", value: `**${boostCount}**`, inline: true },
        { name: "🚀 Niveau de boost", value: `**${tiers[boostTier] || "Inconnu"}**`, inline: true }
      )
      .setFooter({ text: `${guild.name} | Toute l'équipe te remercie ! ❤️` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  settings: {
    module: "fun",
    enabled: true,
  },
};

module.exports = { default: boost };


