const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, AttachmentBuilder } = require("discord.js");
const { getDatabase } = require("../../database/database");

function parseDuration(str) {
  const match = String(str || "").match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

const giveaway = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("\u2728 Lance un giveaway sur le serveur")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName("titre")
        .setDescription("\u2728 Le titre du giveaway")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("duree")
        .setDescription("\u2728 Durée du giveaway (ex: 1h, 30m)")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("gagnants")
        .setDescription("\u2728 Nombre de gagnants")
        .setRequired(true)
        .setMinValue(1)
    ),

  async executeCommand(client, interaction) {
    const titre = interaction.options.getString("titre");
    const duree = interaction.options.getString("duree");
    const gagnants = interaction.options.getInteger("gagnants");

    const durationMs = parseDuration(duree) || (60 * 60 * 1000);
    const endTimestamp = Math.floor((Date.now() + durationMs) / 1000);

    const path = require("path");
    const giveawayAttachment = new AttachmentBuilder(
      path.join(__dirname, "../../assets/giveaway_banner.jpg"),
      { name: "giveaway_banner.jpg" }
    );

    const embed = new EmbedBuilder()
      .setColor(0xFFAA00)
      .setTitle("🎁 Tirage au sort / Giveaway")
      .setDescription(
        `🎉 **Nouveau Concours lancé !**\n\n` +
        `🏆 **Prix à gagner :** \`${titre}\`\n` +
        `👥 **Nombre de gagnants :** \`${gagnants}\`\n` +
        `⏳ **Fin du tirage :** <t:${endTimestamp}:F> (<t:${endTimestamp}:R>)\n\n` +
        `Clique sur le bouton **Participer** ci-dessous pour t'inscrire !`
      )
      .setImage("attachment://giveaway_banner.jpg")
      .setFooter({
        text: `Lancé par ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("giveaway_participate")
        .setLabel("Participer")
        .setEmoji(client.emoji("party", "\u{1F389}"))
        .setStyle(ButtonStyle.Success)
    );

    const reply = await interaction.reply({
      embeds: [embed],
      components: [button],
      files: [giveawayAttachment],
      fetchReply: true
    });

    const db = getDatabase();
    if (db) {
      try {
        await db("giveaways").insert({
          message_id: reply.id,
          channel_id: interaction.channelId,
          host_id: interaction.user.id,
          prize: titre,
          winners_count: gagnants,
          ends_at: new Date(Date.now() + durationMs),
          ended: false,
          participants: JSON.stringify([])
        });
      } catch (err) {
        client.getLogger()?.send(`[GIVEAWAY] Erreur SQL insertion: ${err.message}`, "ERROR");
      }
    }
  },

  settings: {
    module: "fun",
    enabled: true,
  },
};

module.exports = { default: giveaway };


