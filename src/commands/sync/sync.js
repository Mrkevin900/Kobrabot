const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
  InteractionContextType,
} = require("discord.js");
const {
  DEFAULT_ROLE_MAP,
  parseRoleMapFromEnv,
} = require("../../utils/syncAPI");

function getRoleMap() {
  return parseRoleMapFromEnv() || DEFAULT_ROLE_MAP;
}

function formatRoleList(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return "Aucun";
  return roles.map((role) => role.toString()).join(", ");
}

const sync = {
  data: new SlashCommandBuilder()
    .setName("sync")
    .setDescription("\u2728 🔄 Outils de synchronisation avec l'API Kobralost-RP")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName("run")
        .setDescription("\u2728 Synchronise un membre")
        .addUserOption((opt) =>
          opt
            .setName("member")
            .setDescription("\u2728 Membre a synchroniser")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("diff")
        .setDescription("\u2728 Affiche les changements avant la synchronisation")
        .addUserOption((opt) =>
          opt
            .setName("member")
            .setDescription("\u2728 Membre a analyser")
            .setRequired(true),
        ),
    ),

  async executeCommand(client, interaction) {
    const syncAPI = client.syncAPI;
    if (!syncAPI) {
      return interaction.reply({
        content: "❌ Système de sync non chargé.",
        flags: MessageFlags.Ephemeral,
      });
    }

    let subcommand;
    try {
      subcommand = interaction.options.getSubcommand(false);
    } catch (e) {
      subcommand = null;
    }

    if (!subcommand) {
      return interaction.reply({
        content: "⚠️ Veuillez utiliser une sous-commande : `/sync run` ou `/sync diff`.\n*Si vous ne les voyez pas, redémarrez votre client Discord.*",
        flags: MessageFlags.Ephemeral,
      });
    }

    const member = interaction.options.getMember("member");
    if (!member) {
      return interaction.reply({
        content: "Membre introuvable dans ce serveur.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === "diff") {
      return this.handleDiff(client, interaction, member, syncAPI);
    }

    return syncAPI.handleSyncCommand(interaction);
  },

  async handleDiff(client, interaction, member, syncAPI) {
    if (syncAPI._cannot_modify(member)) {
      return interaction.reply({
        content: "Je ne peux pas analyser proprement ce membre car il est au-dessus de moi dans la hierarchie.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const safeEdit = async (payload) => {
      try {
        if (interaction.replied || interaction.deferred) {
          return await interaction.editReply(payload);
        }
        return await interaction.reply(payload);
      } catch (e) {
        if (interaction.channel && typeof interaction.channel.send === "function") {
          return await interaction.channel.send(payload).catch(() => {});
        }
      }
    };

    const { data, status, error: apiError } = await syncAPI.fetchUserData(member.id);
    if (!data) {
      return await safeEdit(
        `Aucune donnee API disponible pour ce membre (${status || "erreur"}). ${apiError || ""}`.trim(),
      );
    }

    const roleMap = getRoleMap();
    const guild = interaction.guild;
    const rpName = syncAPI._extract_name(data);
    const apiRoleNames = syncAPI._extract_role_names(data);
    const apiRolesNorm = new Set(apiRoleNames.map((name) => syncAPI._normalize(name)));
    const apiRolesCanon = new Set(
      apiRoleNames
        .map((name) => syncAPI._normalize_role_name(name))
        .filter(Boolean),
    );
    const targetIds = new Set();
    const unresolvedApiRoles = [];

    for (const [apiName, discordId] of Object.entries(roleMap)) {
      const mapNorm = syncAPI._normalize(apiName);
      const mapCanon = syncAPI._normalize_role_name(apiName);
      const commissaireDetected = syncAPI._is_commissaire_variant(apiName)
        ? apiRoleNames.some((name) => syncAPI._is_commissaire_variant(name))
        : false;

      if (
        apiRolesNorm.has(mapNorm) ||
        apiRolesCanon.has(mapCanon) ||
        commissaireDetected
      ) {
        const resolvedId = syncAPI._resolve_discord_role_id(guild, apiName, discordId);
        if (resolvedId) targetIds.add(resolvedId);
        else unresolvedApiRoles.push(apiName);
      }
    }

    const managedIds = new Set(
      Object.values(roleMap).filter((id) => guild.roles.cache.has(id)),
    );
    for (const apiName of Object.keys(roleMap)) {
      const byName = guild.roles.cache.find(
        (role) => syncAPI._normalize(role.name) === syncAPI._normalize(apiName),
      );
      if (byName) managedIds.add(byName.id);
    }

    const currentManagedRoles = Array.from(member.roles.cache.values()).filter((role) =>
      managedIds.has(role.id),
    );
    const targetRoles = Array.from(targetIds)
      .map((id) => guild.roles.cache.get(id))
      .filter(Boolean);
    const toAdd = targetRoles.filter(
      (role) => !currentManagedRoles.some((currentRole) => currentRole.id === role.id),
    );
    const toRemove = currentManagedRoles.filter(
      (role) => !targetRoles.some((targetRole) => targetRole.id === role.id),
    );

    const currentNick = member.nickname || member.user.username;
    const desiredNick = rpName ? rpName.slice(0, 32) : "Aucun nom RP detecte";
    const memberRole = guild.roles.cache.get(process.env.MEMBER_ROLE_ID || "");
    const memberRoleMissing =
      Boolean(memberRole) && !member.roles.cache.has(memberRole.id) ? memberRole : null;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Analyse de sync - ${member.user.tag}`)
      .setThumbnail(member.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: "Pseudo",
          value: `Actuel: **${currentNick}**\nCible: **${desiredNick}**`,
          inline: false,
        },
        {
          name: "Role Membre",
          value: memberRoleMissing ? `A ajouter: ${memberRoleMissing}` : "Deja present ou non configure",
          inline: false,
        },
        {
          name: "Roles API detectes",
          value: apiRoleNames.length > 0 ? apiRoleNames.join(", ").slice(0, 1024) : "Aucun",
          inline: false,
        },
        {
          name: "Roles a ajouter",
          value: formatRoleList(toAdd),
          inline: false,
        },
        {
          name: "Roles a retirer",
          value: formatRoleList(toRemove),
          inline: false,
        },
        {
          name: "Roles non resolus",
          value: unresolvedApiRoles.length > 0 ? unresolvedApiRoles.join(", ").slice(0, 1024) : "Aucun",
          inline: false,
        },
      )
      .setFooter({
        text: `Diff uniquement - aucune modification n'a ete appliquee`,
      })
      .setTimestamp();

    return await safeEdit({ embeds: [embed] });
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: sync };
