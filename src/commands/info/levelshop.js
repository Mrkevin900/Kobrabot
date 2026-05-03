const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require("discord.js");
const { getDatabase } = require("../../database/database");
const {
  getGuildSettings,
  getWallet,
  spendPoints,
  grantMultiplier,
} = require("../../utils/levelRewards");

function boostText(wallet) {
  if (wallet.xpMultiplier <= 1 || wallet.multiplierUntil <= Date.now()) {
    return "Aucun boost actif";
  }
  return `x${wallet.xpMultiplier} jusqu'a <t:${Math.floor(wallet.multiplierUntil / 1000)}:R>`;
}

const levelshop = {
  data: new SlashCommandBuilder()
    .setName("levelshop")
    .setDescription("Boutique des niveaux et boosts XP")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub.setName("voir").setDescription("Voir la boutique et ton solde"),
    )
    .addSubcommand((sub) =>
      sub.setName("acheter_x2").setDescription("Acheter un boost x2 XP"),
    ),

  async executeCommand(client, interaction) {
    const db = getDatabase();
    if (!db) {
      return interaction.reply({
        content: "Base de donnees indisponible.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    if (sub === "voir") {
      const settings = await getGuildSettings(db, guildId);
      const wallet = await getWallet(db, guildId, userId);

      const embed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle("Boutique de niveaux")
        .setDescription("Gagne des points a chaque niveau et depense-les ici.")
        .addFields(
          { name: "Tes points", value: `${wallet.points}`, inline: true },
          { name: "Boost actif", value: boostText(wallet), inline: true },
          { name: "Item: x2 XP", value: `${settings.x2PricePoints} points`, inline: true },
          { name: "Duree x2", value: `${settings.x2DurationMinutes} minute(s)`, inline: true },
          {
            name: "Recompense par niveau",
            value: `${settings.rewardPointsPerLevel} point(s)`,
            inline: true,
          },
          { name: "Boutique", value: settings.shopEnabled ? "Active" : "Desactivee", inline: true },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === "acheter_x2") {
      const settings = await getGuildSettings(db, guildId);
      if (!settings.shopEnabled) {
        return interaction.reply({
          content: "La boutique est desactivee sur ce serveur.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const spent = await spendPoints(db, guildId, userId, settings.x2PricePoints);
      if (!spent.ok) {
        return interaction.reply({
          content: `Points insuffisants. Il te faut ${settings.x2PricePoints} points.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const wallet = await grantMultiplier(db, guildId, userId, 2, settings.x2DurationMinutes);
      const embed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("Boost x2 active")
        .setDescription(
          `Ton boost x2 XP est actif.\nFin: <t:${Math.floor(wallet.multiplierUntil / 1000)}:F>`,
        )
        .addFields(
          { name: "Cout", value: `${settings.x2PricePoints} points`, inline: true },
          { name: "Points restants", value: `${spent.wallet.points}`, inline: true },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
      content: "Sous-commande inconnue.",
      flags: MessageFlags.Ephemeral,
    });
  },

  settings: {
    module: "info",
    enabled: true,
  },
};

module.exports = { default: levelshop };




