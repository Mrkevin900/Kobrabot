const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  SECURITY_FEATURES,
  applySecurityMode,
  isFeatureEnabled,
  setFeatureStatus,
} = require("../../utils/SecurityUtils");

function getFeatureStatus(feature, guildId) {
  return isFeatureEnabled(feature, guildId);
}

function buildStatusEmbed(guildId, guildName) {
  const embed = new EmbedBuilder()
    .setTitle(`Panneau sécurité - ${guildName}`)
    .setColor(0x2f3136)
    .setTimestamp();

  const fields = Object.entries(SECURITY_FEATURES).map(([feature, def]) => ({
    name: def.label,
    value: getFeatureStatus(feature, guildId) ? "✅ Activée" : "❌ Désactivée",
    inline: true,
  }));

  embed.addFields(fields);
  embed.setFooter({ text: "Utilise /security-panel set ou /security-panel mode" });
  return embed;
}

function applyMode(guildId, mode) {
  return applySecurityMode(guildId, mode);
}

const securityPanel = {
  data: new SlashCommandBuilder()
    .setName("security-panel")
    .setDescription("Panneau de sécurité du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName("status").setDescription("Affiche l'état des protections de sécurité"))
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Activer ou désactiver une protection spécifique")
        .addStringOption((opt) =>
          opt
            .setName("feature")
            .setDescription("Protection à modifier")
            .setRequired(true)
            .addChoices(
              ...Object.entries(SECURITY_FEATURES).map(([feature, def]) => ({ name: def.label, value: feature })),
            ),
        )
        .addBooleanOption((opt) =>
          opt.setName("enabled").setDescription("Activer ou désactiver")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("mode")
        .setDescription("Appliquer un mode de sécurité prédéfini")
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Mode de sécurité")
            .setRequired(true)
            .addChoices(
              { name: "Sécurité OFF", value: "off" },
              { name: "Sécurité ON", value: "on" },
              { name: "Sécurité MAX", value: "max" },
            ),
        ),
    )
    .addSubcommand((sub) => sub.setName("panel").setDescription("Affiche le panneau interactif des sécurités")),

  async executeCommand(client, interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: "Cette commande ne peut être utilisée qu'en serveur.", ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = guild.id;

    if (subcommand === "status") {
      const embed = buildStatusEmbed(guildId, guild.name);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === "set") {
      const feature = interaction.options.getString("feature");
      const enabled = interaction.options.getBoolean("enabled");
      setFeatureStatus(feature, guildId, enabled);
      return interaction.reply({
        content: `${SECURITY_FEATURES[feature].label} est maintenant ${enabled ? "activée" : "désactivée"}.`,
        ephemeral: true,
      });
    }

    if (subcommand === "mode") {
      const mode = interaction.options.getString("mode");
      const message = applyMode(guildId, mode);
      return interaction.reply({ content: message, ephemeral: true });
    }

    if (subcommand === "panel") {
      const embed = new EmbedBuilder()
        .setTitle(`🛡️ Panneau Sécurité - ${guild.name}`)
        .setDescription("Cliquez sur les boutons pour activer/désactiver les sécurités.")
        .setColor("Blue");

      const rows = [];
      const features = Object.keys(SECURITY_FEATURES);
      for (let i = 0; i < features.length; i += 5) {
        const row = new ActionRowBuilder();
        for (let j = i; j < Math.min(i + 5, features.length); j++) {
          const feature = features[j];
          const def = SECURITY_FEATURES[feature];
          const isActive = getFeatureStatus(feature, guildId);
          const button = new ButtonBuilder()
            .setCustomId(`security_toggle_${feature}`)
            .setLabel(`${def.label} ${isActive ? "✅" : "❌"}`)
            .setStyle(isActive ? ButtonStyle.Success : ButtonStyle.Danger);
          row.addComponents(button);
        }
        rows.push(row);
      }

      return interaction.reply({ embeds: [embed], components: rows });
    }

    return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: securityPanel };

