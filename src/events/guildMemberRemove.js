const { EmbedBuilder, ChannelType } = require("discord.js");
const {
  bumpCounter,
  fetchAuditExecutor,
  isFeatureEnabled,
  logSecurity,
  punishExecutor,
} = require("../utils/SecurityUtils");

const guildMemberRemove = {
  async executeHandler(client, member) {
    const log = client.getLogger && client.getLogger();

    function safeSend(l, ...args) {
      if (l && typeof l.send === "function") l.send(...args);
    }

    try {
      const guild = member.guild;

      if (isFeatureEnabled("antikick", guild.id) || isFeatureEnabled("antimasskick", guild.id)) {
        const executor = await fetchAuditExecutor(guild, "kick", member.id);
        if (executor) {
          if (isFeatureEnabled("antikick", guild.id)) {
            logSecurity(client, `Kick detecte: ${member.user.tag} (${member.id})`);
            await punishExecutor(client, guild, executor, "Anti-kick active");
          } else if (isFeatureEnabled("antimasskick", guild.id)) {
            const count = bumpCounter("kick", guild.id, executor.id, 30000);
            if (count >= 3) {
              await punishExecutor(client, guild, executor, "Anti-mass-kick active");
            }
          }
        }
      }

      try {
        const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
        const welcomeChannel =
          guild.channels.cache.get(welcomeChannelId) ||
          guild.channels.cache.find(
            (c) => c.name === "bienvenue" && c.type === ChannelType.GuildText,
          );

        if (welcomeChannel && welcomeChannel.isTextBased()) {
          const goodbyeEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("Depart du serveur")
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setDescription(
              `**${member.user.username}** a quitte le serveur.\n\n` +
                `Nous esperons que tu reviendras bientot.\n\n` +
                `Il y a maintenant **${guild.memberCount}** membres.`,
            )
            .setFooter({ text: `ID: ${member.user.id}` })
            .setTimestamp();

          await welcomeChannel.send({ embeds: [goodbyeEmbed] }).catch(() => {});
        }
      } catch (error) {
        safeSend(log, `Erreur message depart: ${error.message}`, "ERROR");
      }

      try {
        const logsChannelId = process.env.LOGS_CHANNEL_ID;
        if (logsChannelId) {
          const logsChannel = guild.channels.cache.get(logsChannelId);
          if (logsChannel && logsChannel.type === ChannelType.GuildText) {
            const logEmbed = new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle("Membre parti")
              .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
              .addFields(
                { name: "Utilisateur", value: `${member.user.tag}`, inline: true },
                { name: "ID", value: `\`${member.user.id}\``, inline: true },
                {
                  name: "Rejoint le",
                  value: member.joinedTimestamp
                    ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
                    : "Inconnu",
                  inline: false,
                },
                {
                  name: "Duree sur le serveur",
                  value: member.joinedTimestamp
                    ? calculateDuration(member.joinedTimestamp)
                    : "Inconnue",
                  inline: true,
                },
                { name: "Membres restants", value: `${guild.memberCount}`, inline: true },
              )
              .setTimestamp();

            await logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }
      } catch (error) {
        safeSend(log, `Erreur log depart: ${error.message}`, "ERROR");
      }

      safeSend(log, `${member.user.tag} a quitte ${guild.name}`, "NOTIF");
    } catch (error) {
      safeSend(log, `Erreur guildMemberRemove: ${error.message}`, "ERROR");
      if (error && error.stack) safeSend(log, error.stack, "DEBUG");
    }
  },

  settings: {
    enabled: true,
  },
};

function calculateDuration(joinedTimestamp) {
  const now = Date.now();
  const duration = now - joinedTimestamp;

  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

module.exports = { default: guildMemberRemove };

