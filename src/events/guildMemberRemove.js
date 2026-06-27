const { EmbedBuilder, ChannelType } = require("discord.js");
const {
  bumpCounter,
  fetchAuditExecutor,
  isFeatureEnabled,
  logSecurity,
  punishExecutor,
} = require("../utils/SecurityUtils");

async function resolveTextChannel(guild, channelId, fallbackKeywords = null) {
  if (!guild) return null;

  if (channelId) {
    const cached = guild.channels.cache.get(channelId);
    if (cached && cached.isTextBased && cached.isTextBased()) return cached;

    const fetched = await guild.channels.fetch(channelId).catch(() => null);
    if (fetched && fetched.isTextBased && fetched.isTextBased()) return fetched;
  }

  if (fallbackKeywords) {
    const regex = new RegExp(fallbackKeywords, "i");
    return (
      guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && regex.test(c.name),
      ) || null
    );
  }

  return null;
}

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
        const goodbyeChannelId = process.env.GOODBYE_CHANNEL_ID || "";
        const goodbyeChannel = await resolveTextChannel(guild, goodbyeChannelId, "depart|goodbye|leave|quit|au-revoir|au revoir");

        if (goodbyeChannel && goodbyeChannel.isTextBased()) {
          const byeEmoji = client?.emoji?.("bye") || "👋";
          const cancelEmoji = client?.emoji?.("cancel") || "❌";

          const goodbyeEmbed = new EmbedBuilder()
            .setColor(client.getConfig()?.embed?.errorColor || 0xff3d00)
            .setAuthor({ 
              name: `Départ de ${member.user.tag}`, 
              iconURL: member.user.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription(
              `${byeEmoji} Au revoir **${member.user.username}**\n\n` +
              `Merci d'avoir fait partie de notre communauté.\n\n` +
              `Nous espérons te revoir un jour.\n\n` +
              `Bonne continuation !`
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `ID: ${member.user.id} • Il reste ${guild.memberCount} membres` })
            .setTimestamp();

          const fs = require("fs");
          const path = require("path");
          const { AttachmentBuilder } = require("discord.js");
          const goodbyeBannerPath = path.join(__dirname, "../assets/goodbye_banner.png");
          
          let files = [];
          if (fs.existsSync(goodbyeBannerPath)) {
            const goodbyeAttachment = new AttachmentBuilder(goodbyeBannerPath, { name: "goodbye_banner.png" });
            goodbyeEmbed.setImage("attachment://goodbye_banner.png");
            files.push(goodbyeAttachment);
          }

          await goodbyeChannel.send({ embeds: [goodbyeEmbed], files: files }).catch(() => {});
        } else {
          safeSend(log, `[GOODBYE] Salon départ introuvable (${goodbyeChannelId || "non-defini"})`, "WARN");
        }
      } catch (error) {
        safeSend(log, `Erreur message depart: ${error.message}`, "ERROR");
      }

      try {
        const logsChannelId = process.env.LOGS_CHANNEL_ID;
        if (logsChannelId) {
          const logsChannel = await resolveTextChannel(guild, logsChannelId);
          if (logsChannel && logsChannel.isTextBased()) {
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

