const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");

function formatStatusLine(ok, label, detail) {
  return `${ok ? "OK" : "KO"} ${label}${detail ? ` - ${detail}` : ""}`;
}

function resolveChannelStatus(guild, envKey, label) {
  const value = String(process.env[envKey] || "").trim();
  if (!value) {
    return { ok: false, line: formatStatusLine(false, label, `${envKey} manquant`) };
  }

  const channel = guild.channels.cache.get(value);
  if (!channel) {
    return { ok: false, line: formatStatusLine(false, label, `ID ${value} introuvable`) };
  }

  return { ok: true, line: formatStatusLine(true, label, `${channel.name} (${value})`) };
}

function resolveRoleStatus(guild, envKey, label) {
  const value = String(process.env[envKey] || "").trim();
  if (!value) {
    return { ok: false, line: formatStatusLine(false, label, `${envKey} manquant`) };
  }

  const role = guild.roles.cache.get(value);
  if (!role) {
    return { ok: false, line: formatStatusLine(false, label, `ID ${value} introuvable`) };
  }

  return { ok: true, line: formatStatusLine(true, label, `${role.name} (${value})`) };
}

const configCheck = {
  data: new SlashCommandBuilder()
    .setName("config-check")
    .setDescription("Verifie la configuration principale du bot")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async executeCommand(client, interaction) {
    const guild = interaction.guild;
    const isProd = process.env.PRODUCTION === "TRUE";

    const coreChecks = [
      ["PRODUCTION", "Mode"],
      [isProd ? "CLIENT_TOKEN_PROD" : "CLIENT_TOKEN_TEST", "Token Discord actif"],
      [isProd ? "CLIENT_ID_PROD" : "CLIENT_ID_TEST", "Client ID actif"],
      ["SQL_HOST", "SQL host"],
      ["SQL_USER", "SQL user"],
      ["SQL_BASE", "SQL base"],
      ["API_BASE_URL", "API base"],
      ["API_TOKEN", "API token"],
    ].map(([envKey, label]) => {
      const value = String(process.env[envKey] || "").trim();
      return {
        ok: Boolean(value),
        line: formatStatusLine(Boolean(value), label, value ? "renseigne" : `${envKey} manquant`),
      };
    });

    const guildChecks = [
      {
        ok: String(process.env.SYNC_GUILD_ID || "") === guild.id,
        line: formatStatusLine(
          String(process.env.SYNC_GUILD_ID || "") === guild.id,
          "Serveur sync",
          process.env.SYNC_GUILD_ID
            ? process.env.SYNC_GUILD_ID === guild.id
              ? "correspond au serveur courant"
              : `SYNC_GUILD_ID=${process.env.SYNC_GUILD_ID}`
            : "SYNC_GUILD_ID manquant",
        ),
      },
    ];

    const channelChecks = [
      resolveChannelStatus(guild, "LOGS_CHANNEL_ID", "Salon logs"),
      resolveChannelStatus(guild, "SYNC_CHANNEL_ID", "Salon sync"),
      resolveChannelStatus(guild, "SYNC_LOG_CHANNEL_ID", "Salon logs sync"),
      resolveChannelStatus(guild, "WELCOME_CHANNEL_ID", "Salon bienvenue"),
      resolveChannelStatus(guild, "GOODBYE_CHANNEL_ID", "Salon départ"),
      resolveChannelStatus(guild, "TICKET_LOG_CHANNEL_ID", "Salon logs ticket"),
      resolveChannelStatus(guild, "SUGGEST_CHANNEL_ID", "Salon suggestions"),
    ];

    const roleChecks = [
      resolveRoleStatus(guild, "MEMBER_ROLE_ID", "Role membre"),
      resolveRoleStatus(guild, "ADMIN_ROLE_ID", "Role admin"),
      resolveRoleStatus(guild, "TICKET_STAFF_ROLE_ID", "Role staff ticket"),
    ];

    const me = guild.members.me;
    const requiredPermissions = [
      ["ViewChannel", PermissionFlagsBits.ViewChannel],
      ["SendMessages", PermissionFlagsBits.SendMessages],
      ["ManageMessages", PermissionFlagsBits.ManageMessages],
      ["ManageRoles", PermissionFlagsBits.ManageRoles],
      ["ManageNicknames", PermissionFlagsBits.ManageNicknames],
      ["ManageChannels", PermissionFlagsBits.ManageChannels],
      ["ModerateMembers", PermissionFlagsBits.ModerateMembers],
      ["BanMembers", PermissionFlagsBits.BanMembers],
      ["KickMembers", PermissionFlagsBits.KickMembers],
    ];

    const missingPermissions = requiredPermissions.filter(
      ([, permission]) => !me?.permissions?.has(permission),
    );

    const allChecks = [...coreChecks, ...guildChecks, ...channelChecks, ...roleChecks];
    const okCount = allChecks.filter((entry) => entry.ok).length;
    const totalCount = allChecks.length;

    const embed = new EmbedBuilder()
      .setColor(okCount === totalCount && missingPermissions.length === 0 ? 0x57f287 : 0xfaa61a)
      .setTitle("Config Check")
      .setDescription(
        `Verification terminee pour **${guild.name}**.\n` +
          `Resultat: **${okCount}/${totalCount}** verifications valides.`,
      )
      .addFields(
        {
          name: "Variables critiques",
          value: coreChecks.map((entry) => entry.line).join("\n").slice(0, 1024),
          inline: false,
        },
        {
          name: "Salons",
          value: channelChecks.map((entry) => entry.line).join("\n").slice(0, 1024),
          inline: false,
        },
        {
          name: "Roles",
          value: roleChecks.map((entry) => entry.line).join("\n").slice(0, 1024),
          inline: false,
        },
        {
          name: "Permissions bot",
          value:
            missingPermissions.length === 0
              ? "OK Toutes les permissions principales sont presentes."
              : `Permissions manquantes: ${missingPermissions.length}`,
          inline: false,
        },
      )
      .setFooter({
        text:
          missingPermissions.length === 0
            ? "Configuration globalement exploitable"
            : "Certaines permissions ou variables restent a corriger",
      })
      .setTimestamp();

    if (missingPermissions.length > 0) {
      embed.addFields({
        name: "Detail permissions manquantes",
        value: missingPermissions.map(([name]) => `- ${name}`).join("\n").slice(0, 1024),
        inline: false,
      });
    }

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: configCheck };
