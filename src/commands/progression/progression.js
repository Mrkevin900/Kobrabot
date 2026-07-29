const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const ProgressionRepository = require("../../database/repositories/ProgressionRepository");
const ProgressionService = require("../../services/ProgressionService");

const progressionAdminCommand = {
  data: new SlashCommandBuilder()
    .setName("progression")
    .setDescription("⚙️ Panneau d'administration du Progression Manager")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("config")
        .setDescription("⚙️ Configurer les salons et paramètres globaux")
        .addChannelOption((opt) =>
          opt
            .setName("salon_staff")
            .setDescription("Salon de validation des demandes Staff")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("salon_logs")
            .setDescription("Salon des logs d'audit")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("auto_suivant").setDescription("Activer l'enchaînement automatique des objectifs").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("notifications_mp").setDescription("Notifier les joueurs en MP lors des validations").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("team_create")
        .setDescription("➕ Créer une nouvelle équipe de production")
        .addStringOption((opt) => opt.setName("nom").setDescription("Nom de l'équipe").setRequired(true))
        .addStringOption((opt) => opt.setName("item").setDescription("Nom de l'item à produire (ex: Meth)").setRequired(true))
        .addIntegerOption((opt) => opt.setName("objectif").setDescription("Quantité cible").setMinValue(1).setRequired(true))
        .addStringOption((opt) => opt.setName("emoji").setDescription("Emoji de l'équipe").setRequired(false))
        .addStringOption((opt) => opt.setName("couleur").setDescription("Code Hex (ex: #00FF00)").setRequired(false))
        .addStringOption((opt) => opt.setName("description").setDescription("Description").setRequired(false))
        .addRoleOption((opt) => opt.setName("role").setDescription("Rôle Discord").setRequired(false))
        .addChannelOption((opt) => opt.setName("salon").setDescription("Salon d'affichage").addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addUserOption((opt) => opt.setName("chef").setDescription("Chef d'équipe").setRequired(false))
        .addUserOption((opt) => opt.setName("sous_chef").setDescription("Sous-chef").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("team_edit")
        .setDescription("✏️ Modifier une équipe existante")
        .addStringOption((opt) => opt.setName("equipe").setDescription("Équipe à modifier").setRequired(true))
        .addStringOption((opt) => opt.setName("nouveau_nom").setDescription("Nouveau nom").setRequired(false))
        .addStringOption((opt) => opt.setName("item").setDescription("Nouvel item").setRequired(false))
        .addIntegerOption((opt) => opt.setName("objectif").setDescription("Nouvel objectif").setMinValue(1).setRequired(false))
        .addStringOption((opt) =>
          opt
            .setName("statut")
            .setDescription("Statut")
            .setRequired(false)
            .addChoices(
              { name: "🟢 Ouvert", value: "open" },
              { name: "🔴 Fermé", value: "closed" },
              { name: "🟡 Suspendu", value: "suspended" }
            )
        )
        .addUserOption((opt) => opt.setName("chef").setDescription("Nouveau chef").setRequired(false))
        .addUserOption((opt) => opt.setName("sous_chef").setDescription("Nouveau sous-chef").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("team_delete")
        .setDescription("❌ Supprimer une équipe")
        .addStringOption((opt) => opt.setName("equipe").setDescription("Équipe à supprimer").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("team_reset")
        .setDescription("🔄 Réinitialiser la progression d'une équipe")
        .addStringOption((opt) => opt.setName("equipe").setDescription("Équipe à réinitialiser").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("export")
        .setDescription("📤 Exporter la configuration des équipes au format JSON")
    )
    .addSubcommand((sub) =>
      sub
        .setName("import")
        .setDescription("📥 Importer la configuration des équipes depuis un fichier JSON")
        .addAttachmentOption((opt) =>
          opt.setName("fichier").setDescription("Fichier JSON de configuration").setRequired(true)
        )
    ),

  async executeCommand(client, interaction) {
    const subcommand = interaction.options.getSubcommand();
    const repo = new ProgressionRepository(() => client.database?.getDatabase());
    const service = new ProgressionService(client);

    if (subcommand === "config") {
      const staffChannel = interaction.options.getChannel("salon_staff");
      const logChannel = interaction.options.getChannel("salon_logs");
      const autoNext = interaction.options.getBoolean("auto_suivant");
      const dmNotifs = interaction.options.getBoolean("notifications_mp");

      const updateData = {};
      if (staffChannel) updateData.staff_channel_id = staffChannel.id;
      if (logChannel) updateData.log_channel_id = logChannel.id;
      if (autoNext !== null) updateData.auto_next_objective = autoNext;
      if (dmNotifs !== null) updateData.dm_notifications = dmNotifs;

      const config = await repo.updateGuildConfig(interaction.guildId, updateData);

      const mascot = client.mascot ? client.mascot("⚙️") : "⚙️";
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${mascot} Configuration Progression Manager`)
        .addFields(
          { name: "🛡️ Salon Validation Staff", value: config.staff_channel_id ? `<#${config.staff_channel_id}>` : "Non configuré", inline: true },
          { name: "📜 Salon Logs Audit", value: config.log_channel_id ? `<#${config.log_channel_id}>` : "Non configuré", inline: true },
          { name: "🔄 Auto Enchaînement", value: config.auto_next_objective ? "Activé" : "Désactivé", inline: true },
          { name: "🔔 Notifications MP", value: config.dm_notifications ? "Activées" : "Désactivées", inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (subcommand === "team_create") {
      const name = interaction.options.getString("nom", true);
      const item = interaction.options.getString("item", true);
      const target = interaction.options.getInteger("objectif", true);
      const emoji = interaction.options.getString("emoji") || "📦";
      const color = interaction.options.getString("couleur") || "#5865F2";
      const description = interaction.options.getString("description") || null;
      const role = interaction.options.getRole("role");
      const channel = interaction.options.getChannel("salon");
      const chef = interaction.options.getUser("chef");
      const sousChef = interaction.options.getUser("sous_chef");

      const existing = await repo.getTeamByName(interaction.guildId, name);
      if (existing) {
        return interaction.reply({
          content: `❌ Une équipe nommée **${name}** existe déjà.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const team = await repo.createTeam({
        guild_id: interaction.guildId,
        name,
        goal_item: item,
        goal_target: target,
        emoji,
        color,
        description,
        role_id: role ? role.id : null,
        channel_id: channel ? channel.id : null,
        leader_id: chef ? chef.id : null,
        co_leader_id: sousChef ? sousChef.id : null,
      });

      if (team.channel_id) {
        await service.refreshTeamDashboard(team.id).catch(() => null);
      }

      return interaction.reply({
        content: `✅ Équipe **${team.emoji} ${team.name}** créée avec succès ! Objectif: **${team.goal_target.toLocaleString("fr-FR")} ${team.goal_item}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === "team_edit") {
      const teamName = interaction.options.getString("equipe", true);
      const team = await repo.getTeamByName(interaction.guildId, teamName);

      if (!team) {
        return interaction.reply({
          content: `❌ Équipe **${teamName}** introuvable.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const newName = interaction.options.getString("nouveau_nom");
      const item = interaction.options.getString("item");
      const target = interaction.options.getInteger("objectif");
      const status = interaction.options.getString("statut");
      const chef = interaction.options.getUser("chef");
      const sousChef = interaction.options.getUser("sous_chef");

      const updateData = {};
      if (newName) updateData.name = newName;
      if (item) updateData.goal_item = item;
      if (target) updateData.goal_target = target;
      if (status) updateData.status = status;
      if (chef) updateData.leader_id = chef.id;
      if (sousChef) updateData.co_leader_id = sousChef.id;

      await repo.updateTeam(team.id, updateData);
      await service.refreshTeamDashboard(team.id).catch(() => null);

      return interaction.reply({
        content: `✅ Équipe **${team.name}** mise à jour avec succès.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === "team_delete") {
      const teamName = interaction.options.getString("equipe", true);
      const team = await repo.getTeamByName(interaction.guildId, teamName);

      if (!team) {
        return interaction.reply({
          content: `❌ Équipe **${teamName}** introuvable.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await repo.deleteTeam(team.id);
      return interaction.reply({
        content: `🗑️ Équipe **${team.name}** supprimée avec succès.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === "team_reset") {
      const teamName = interaction.options.getString("equipe", true);
      const team = await repo.getTeamByName(interaction.guildId, teamName);

      if (!team) {
        return interaction.reply({
          content: `❌ Équipe **${teamName}** introuvable.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await repo.resetTeamGoal(team.id);
      await service.refreshTeamDashboard(team.id).catch(() => null);

      return interaction.reply({
        content: `🔄 Progression de l'équipe **${team.name}** réinitialisée à 0 / ${team.goal_target}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === "export") {
      const teams = await repo.getTeams(interaction.guildId);
      const jsonBuffer = Buffer.from(JSON.stringify(teams, null, 2), "utf-8");
      const attachment = new AttachmentBuilder(jsonBuffer, { name: `teams_export_${interaction.guildId}.json` });

      return interaction.reply({
        content: `📤 Exportation terminée (${teams.length} équipes).`,
        files: [attachment],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === "import") {
      const file = interaction.options.getAttachment("fichier", true);
      const res = await fetch(file.url);
      const data = await res.json();

      if (!Array.isArray(data)) {
        return interaction.reply({
          content: "❌ Le fichier JSON est invalide ou mal structuré (tableau d'équipes attendu).",
          flags: MessageFlags.Ephemeral,
        });
      }

      let imported = 0;
      for (const t of data) {
        if (t.name && t.goal_item && t.goal_target) {
          await repo.createTeam({
            guild_id: interaction.guildId,
            name: t.name,
            goal_item: t.goal_item,
            goal_target: t.goal_target,
            emoji: t.emoji || "📦",
            color: t.color || "#5865F2",
            description: t.description || null,
          }).catch(() => null);
          imported++;
        }
      }

      return interaction.reply({
        content: `📥 Importation réussie: **${imported}** équipes importées.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  settings: {
    module: "progression",
    enabled: true,
  },
};

module.exports = { default: progressionAdminCommand };
