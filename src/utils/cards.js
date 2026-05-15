const { AttachmentBuilder } = require("discord.js");

/**
 * Cards utility - LITE VERSION (No Canvas)
 * Optimized for low storage usage and Node v24 compatibility.
 * Image generation is disabled to save ~100MB of disk space.
 */

function getAvatarUrl(user) {
  if (!user || typeof user.displayAvatarURL !== "function") return null;
  return user.displayAvatarURL({ format: "png", extension: "png", size: 256 });
}

async function buildWelcomeCard(member) {
  // Image generation disabled for optimization
  return null;
}

async function buildLevelUpCard({ member, level, rank, progress, needed }) {
  // Image generation disabled for optimization
  return null;
}

async function buildLevelLeaderboardCard() {
  return null;
}

module.exports = {
  buildWelcomeCard,
  buildLevelUpCard,
  buildLevelLeaderboardCard,
};
