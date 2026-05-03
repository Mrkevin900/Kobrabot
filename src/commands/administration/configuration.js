const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");
const { isFeatureEnabled } = require("../../utils/SecurityUtils");

function status(enabled, on = "Active", off = "Desactive") {
  return enabled ? on : off;
}

function channelLabel(channel) {
  return channel ? `${channel}` : "Aucun";
}

function roleLabel(role) {
  return role ? `${role}` : "Aucun";
}

function resolveConfiguredChannel(guild, ...envNames) {
  for (const name of envNames) {
    const id = process.env[name];
    if (!id) continue;
    const channel = guild.channels.cache.get(id);
    if (channel) return channel;
  }
  return null;
}

function resolveConfiguredRole(guild, ...envNames) {
  for (const name of envNames) {
    const id = process.env[name];
    if (!id) continue;
    const role = guild.roles.cache.get(id);
    if (role) return role;
  }
  return null;
}

function buildConfigEmbed(guild) {
  const logsChannel = resolveConfiguredChannel(guild, "LOGS_CHANNEL_ID", "SERVER_LOG_CHANNEL_ID");
  const moderationChannel = resolveConfiguredChannel(guild, "MOD_LOG_CHANNEL_ID", "LOGS_CHANNEL_ID");
  const captchaChannel = resolveConfiguredChannel(guild, "CAPTCHA_CHANNEL_ID", "LOGS_CHANNEL_ID");
  const captchaRole = resolveConfiguredRole(guild, "CAPTCHA_ROLE_ID", "MEMBER_ROLE_ID");

  return new EmbedBuilder()
    .setColor(0x2b1238)
    .setTitle("Menu principal de configuration")
    .setDescription(
      "Ce menu vous permet de visualiser, ajuster ou personnaliser les fonctionnalites !\n\n" +
        "Chaque categorie presente une liste d'options modifiables sous forme de boutons ou menus deroulants. " +
        "Utilisez les boutons ci-dessous pour configurer les differentes fonctionnalites.",
    )
    .addFields(
      { name: "🌐 Langue", value: "Français", inline: true },
      { name: "↪️ Prefixe", value: process.env.PREFIX ? `\`${process.env.PREFIX}\`` : "Desactive", inline: true },
      { name: "🛡️ Auto RaidMode", value: status(isFeatureEnabled("antiraid", guild.id)), inline: true },
      { name: "🔒 Verrouillage de salon", value: status(isFeatureEnabled("antichannel", guild.id), "Actif", "Ne renomme pas avec le cadenas"), inline: true },
      {
        name: "🔁 Captcha",
        value: `${status(isFeatureEnabled("captcha", guild.id))}\n${channelLabel(captchaChannel)}\n${roleLabel(captchaRole)}`,
        inline: true,
      },
      { name: "📅 Age Minimum", value: process.env.MIN_ACCOUNT_AGE_DAYS ? `${process.env.MIN_ACCOUNT_AGE_DAYS} jour(s)` : "Aucun", inline: true },
      { name: "🚫 Anti-spam", value: status(isFeatureEnabled("antispam", guild.id)), inline: true },
      {
        name: "☰ Logs",
        value:
          `General\n${channelLabel(logsChannel)}\n` +
          `Moderation\n${channelLabel(moderationChannel)}\n` +
          `Captcha\n${channelLabel(captchaChannel)}`,
        inline: true,
      },
      { name: "🚩 Signalements", value: status(Boolean(process.env.SUGGEST_CHANNEL_ID)), inline: true },
      { name: "🏷️ Role de Tag", value: status(Boolean(process.env.TAG_ROLE_ID)), inline: true },
      { name: "💬 Fermeture des MP", value: status(process.env.CLOSE_DM === "true" || process.env.CLOSE_DM === "TRUE"), inline: true },
    )
    .setFooter({ text: "KobraBot • Configuration" })
    .setTimestamp();
}

function toggleButton(feature, label, emoji, guildId) {
  const active = isFeatureEnabled(feature, guildId);
  return new ButtonBuilder()
    .setCustomId(`security_toggle_${feature}`)
    .setEmoji(emoji)
    .setLabel(`${label} ${active ? "ON" : "OFF"}`)
    .setStyle(active ? ButtonStyle.Primary : ButtonStyle.Secondary);
}

function disabledButton(customId, label, emoji) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setEmoji(emoji)
    .setLabel(label)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);
}

function linkButton(label, emoji, url) {
  return new ButtonBuilder()
    .setEmoji(emoji)
    .setLabel(label)
    .setStyle(ButtonStyle.Link)
    .setURL(url);
}

function buildRows(guildId) {
  return [
    new ActionRowBuilder().addComponents(
      disabledButton("config_lang", "Langue", "🌐"),
      disabledButton("config_prefix", "Prefixe", "↪️"),
      toggleButton("antiraid", "Auto RaidMode", "🛡️", guildId),
      toggleButton("antichannel", "Cadenas salons", "🔒", guildId),
    ),
    new ActionRowBuilder().addComponents(
      toggleButton("captcha", "Captcha", "🔁", guildId),
      disabledButton("config_age", "Age Minimum", "📅"),
      toggleButton("antispam", "Anti-spam", "🚫", guildId),
      disabledButton("config_logs", "Logs", "☰"),
      disabledButton("config_reports", "Signalements", "🚩"),
    ),
    new ActionRowBuilder().addComponents(
      disabledButton("config_tag_role", "Role de Tag", "🏷️"),
      disabledButton("config_dm_close", "Fermeture des MP", "💬"),
      disabledButton("config_sanctions", "Sanctions", "🔐"),
      disabledButton("config_auth", "Authentication Manager", "🛡️"),
      disabledButton("config_changelog", "Changelog", "❤️"),
    ),
    new ActionRowBuilder().addComponents(
      linkButton("Serveur Support", "💬", process.env.SUPPORT_URL || "https://discord.gg/Kbrp"),
      linkButton("Documentation", "📖", process.env.DOCS_URL || "https://discord.com"),
      disabledButton("config_export", "Exporter", "⬇️"),
      disabledButton("config_premium", "Premium", "⭐"),
    ),
  ];
}

const configuration = {
  data: new SlashCommandBuilder()
    .setName("configuration")
    .setDescription("Affiche le menu principal de configuration")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async executeCommand(client, interaction) {
    if (!interaction.guild || interaction.channel?.type === ChannelType.DM) {
      return interaction.reply({ content: "Cette commande doit etre utilisee dans un serveur.", ephemeral: true });
    }

    return interaction.reply({
      embeds: [buildConfigEmbed(interaction.guild)],
      components: buildRows(interaction.guild.id),
    });
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: configuration };

