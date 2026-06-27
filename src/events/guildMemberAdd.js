const { ChannelType, EmbedBuilder } = require("discord.js");
const { buildWelcomeCard } = require("../utils/cards");
const { isFeatureEnabled, logSecurity } = require("../utils/SecurityUtils");

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

const guildMemberAdd = {
  async executeHandler(client, member) {
    const guild = member.guild;
    const logger = client.getLogger && client.getLogger();

    function safeSend(l, ...args) {
      if (l && typeof l.send === "function") l.send(...args);
    }

    const welcomeChannelId = process.env.WELCOME_CHANNEL_ID || "";
    const logsChannelId = process.env.LOGS_CHANNEL_ID || "";
    const memberRoleId = process.env.MEMBER_ROLE_ID || "";

    if (member.user?.bot && isFeatureEnabled("antibot", guild.id)) {
      await member.ban({ reason: "Anti-bot active" }).catch(async () => {
        await member.kick("Anti-bot active").catch(() => null);
      });
      logSecurity(client, `Bot bloque a l'arrivee: ${member.user.tag} (${member.id})`);
      return;
    }

    try {
      if (client.progressionManager) {
        await client.progressionManager.initializeUser(member.id);
      }
    } catch (error) {
      safeSend(logger, `[WELCOME] Initialisation profil niveau impossible: ${error.message}`, "WARN");
    }

    if (memberRoleId) {
      try {
        const role = await guild.roles.fetch(memberRoleId);
        if (role) {
          await member.roles.add(role, "Attribution automatique role membre");
        }
      } catch (error) {
        safeSend(logger, `[WELCOME] Erreur attribution role membre: ${error.message}`, "WARN");
      }
    }

    try {
      const channel = await resolveTextChannel(guild, welcomeChannelId, "bienvenue|welcome");
      if (!channel || !channel.isTextBased()) {
        safeSend(logger, `[WELCOME] Salon bienvenue introuvable (${welcomeChannelId || "non-defini"})`, "WARN");
      } else {
        const hiEmoji = client?.emoji?.("hi") || "👋";
        const mascotEmoji = client?.emoji?.("mascot") || "🎉";
        const bookEmoji = client?.emoji?.("whitelist") || "📖";
        const clockEmoji = client?.emoji?.("clock") || "⏰";

        const card = await buildWelcomeCard(member);
        const embed = new EmbedBuilder()
          .setColor(client.getConfig()?.embed?.classColor || 0x847bee)
          .setAuthor({ 
            name: `Bienvenue sur ${guild.name} !`, 
            iconURL: guild.iconURL({ dynamic: true, size: 128 }) || member.user.displayAvatarURL({ dynamic: true }) 
          })
          .setDescription(
            `${hiEmoji} Salut ${member} !\n\n` +
            `Bienvenue sur **${guild.name}** !\n\n` +
            `Nous sommes heureux de t'accueillir parmi nous.\n\n` +
            `${bookEmoji} Pense à lire le règlement afin de connaître les règles du serveur.\n\n` +
            `Nous te souhaitons un excellent moment parmi nous !`
          )
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setFooter({ 
            text: `Bienvenue parmi nous • Membre n°${guild.memberCount}`, 
            iconURL: member.user.displayAvatarURL({ dynamic: true, size: 64 }) 
          })
          .setTimestamp();

        let files = [];
        if (card) {
          embed.setImage("attachment://welcome-card.png");
          files.push(card);
        } else {
          const { AttachmentBuilder } = require("discord.js");
          const path = require("path");
          const welcomeAttachment = new AttachmentBuilder(
            path.join(__dirname, "../assets/welcome_banner.png"),
            { name: "welcome_banner.png" }
          );
          embed.setImage("attachment://welcome_banner.png");
          files.push(welcomeAttachment);
        }

        await channel.send({
          content: `${hiEmoji} Salut ${member} ! ${mascotEmoji}`,
          embeds: [embed],
          files: files,
        });

        safeSend(logger, `[WELCOME] Message de bienvenue envoye pour ${member.user.tag}`, "READY");
      }
    } catch (error) {
      safeSend(logger, `[WELCOME] Erreur envoi bienvenue: ${error.message}`, "ERROR");
      if (error.stack) {
        safeSend(logger, error.stack, "DEBUG");
      }
    }

    try {
      if (!logsChannelId) return;
      const logsChannel = await resolveTextChannel(guild, logsChannelId);
      if (!logsChannel || !logsChannel.isTextBased()) return;

      const logEmbed = new EmbedBuilder()
        .setColor(0x00aa00)
        .setTitle("Nouveau membre")
        .addFields(
          { name: "Utilisateur", value: `${member.user.tag}`, inline: true },
          { name: "ID", value: `\`${member.user.id}\``, inline: true },
          {
            name: "Compte cree",
            value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`,
            inline: false,
          },
          { name: "Total membres", value: `${guild.memberCount}`, inline: true },
        )
        .setTimestamp();

      await logsChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      safeSend(logger, `[WELCOME] Erreur log arrivee membre: ${error.message}`, "WARN");
    }
  },

  settings: {
    enabled: true,
  },
};

module.exports = { default: guildMemberAdd };


