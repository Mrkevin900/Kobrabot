const { AttachmentBuilder } = require("discord.js");
const canvacord = require("canvacord");

function getAvatarUrl(user) {
  if (!user || typeof user.displayAvatarURL !== "function") return null;
  return user.displayAvatarURL({ format: "png", extension: "png", size: 256 });
}

async function buildWelcomeCard(member) {
  try {
    const guild = member.guild;
    const user = member.user;

    // Use environment backgrounds if available, otherwise fallback
    const bgEnv = process.env.WELCOME_BG_URLS;
    let bgUrl = "https://i.imgur.com/EgG2BeB.png";
    if (bgEnv) {
      const urls = bgEnv.split(",");
      bgUrl = urls[Math.floor(Math.random() * urls.length)].trim();
    }

    const card = new canvacord.Welcomer()
      .setUsername(user.username)
      .setDiscriminator(user.discriminator || "0000")
      .setMemberCount(guild.memberCount)
      .setGuildName(guild.name)
      .setAvatar(getAvatarUrl(user) || "https://cdn.discordapp.com/embed/avatars/0.png")
      .setColor("border", "#ffcf4d")
      .setColor("username-box", "#ffcf4d")
      .setColor("discriminator-box", "#ffcf4d")
      .setColor("message-box", "#ffcf4d")
      .setColor("title", "#ffffff")
      .setColor("avatar", "#ffcf4d")
      .setBackground(bgUrl);

    const buffer = await card.build();
    return new AttachmentBuilder(buffer, { name: "welcome-card.png" });
  } catch (error) {
    console.error("Erreur génération carte bienvenue:", error);
    return null;
  }
}

async function buildLevelUpCard({ member, level, rank, progress, needed }) {
  const user = member.user;

  const card = new canvacord.Rank()
    .setAvatar(getAvatarUrl(user))
    .setCurrentXP(Math.max(0, Number(progress) || 0))
    .setRequiredXP(Math.max(1, Number(needed) || 1))
    .setStatus("online")
    .setProgressBar("#ffcf4d", "COLOR")
    .setUsername(user.username)
    .setDiscriminator(user.discriminator)
    .setRank(Math.max(0, Number(rank) || 0))
    .setLevel(Math.max(0, Number(level) || 0))
    .setBackground("COLOR", "#2a2d46");

  const buffer = await card.build();
  return new AttachmentBuilder(buffer, { name: "levelup-card.png" });
}

async function buildLevelLeaderboardCard() {
  return null;
}

module.exports = {
  buildWelcomeCard,
  buildLevelUpCard,
  buildLevelLeaderboardCard,
};
