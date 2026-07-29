const {
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
} = require("discord.js");
const ProgressionService = require("../../services/ProgressionService");
const ProgressionRepository = require("../../database/repositories/ProgressionRepository");
const ProgressionDashboardManager = require("../../managers/ProgressionDashboardManager");
const { formatLeaderboardTable } = require("../../utils/ChartGenerator");

const productionCommand = {
  data: new SlashCommandBuilder()
    .setName("production")
    .setDescription("📦 Gestion de la production et progression des équipes RP")
    .addSubcommand((sub) =>
      sub
        .setName("ajouter")
        .setDescription("📦 Déclarer une nouvelle production avec preuve obligatoire")
        .addStringOption((opt) =>
          opt.setName("equipe").setDescription("Nom de l'équipe").setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName("quantite").setDescription("Quantité produite").setMinValue(1).setRequired(true)
        )
        .addAttachmentOption((opt) =>
          opt.setName("preuve").setDescription("Capture d'écran (Preuve obligatoire)").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("commentaire").setDescription("Commentaire optionnel").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("dashboard")
        .setDescription("📊 Afficher le tableau de bord d'une équipe")
        .addStringOption((opt) =>
          opt.setName("equipe").setDescription("Nom de l'équipe").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("stats")
        .setDescription("📈 Consulter les statistiques générales de production")
    )
    .addSubcommand((sub) =>
      sub
        .setName("classement")
        .setDescription("🏆 Afficher les classements généraux et par équipe")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Type de classement")
            .setRequired(false)
            .addChoices(
              { name: "🥇 Top Producteurs", value: "producers" },
              { name: "🚩 Top Équipes", value: "teams" },
              { name: "🛡️ Top Validateurs Staff", value: "validators" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("profil")
        .setDescription("👤 Afficher le profil de production d'un membre")
        .addUserOption((opt) =>
          opt.setName("utilisateur").setDescription("Membre ciblé").setRequired(false)
        )
    ),

  async executeCommand(client, interaction) {
    const subcommand = interaction.options.getSubcommand();
    const repo = new ProgressionRepository(() => client.database?.getDatabase());
    const service = new ProgressionService(client);

    if (subcommand === "ajouter") {
      const teamName = interaction.options.getString("equipe", true);
      const quantity = interaction.options.getInteger("quantite", true);
      const attachment = interaction.options.getAttachment("preuve", true);
      const comment = interaction.options.getString("commentaire") || null;

      const team = await repo.getTeamByName(interaction.guildId, teamName);
      if (!team) {
        return interaction.reply({
          content: `❌ L'équipe **${teamName}** n'existe pas sur ce serveur.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!attachment.contentType || !attachment.contentType.startsWith("image/")) {
        return interaction.reply({
          content: "❌ Le fichier envoyé doit être une image (PNG, JPG, WebP).",
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await service.submitProduction(
          interaction.guildId,
          interaction.user.id,
          team.id,
          quantity,
          attachment.url,
          comment
        );

        return interaction.editReply({
          content: `✅ **Déclaration transmise !** Votre déclaration de **+${quantity.toLocaleString("fr-FR")} ${team.goal_item}** pour **${team.name}** a été envoyée au Staff.`,
        });
      } catch (err) {
        return interaction.editReply({ content: `❌ Erreur: ${err.message}` });
      }
    }

    if (subcommand === "dashboard") {
      const teamName = interaction.options.getString("equipe", true);
      const team = await repo.getTeamByName(interaction.guildId, teamName);

      if (!team) {
        return interaction.reply({
          content: `❌ L'équipe **${teamName}** n'existe pas.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const members = await repo.getTeamMembers(team.id);
      const lastSubmissions = await repo.knex("progression_submissions")
        .where({ team_id: team.id, status: "approved" })
        .orderBy("validated_at", "desc")
        .first();

      const dashboardPayload = ProgressionDashboardManager.buildTeamDashboardEmbed(
        client,
        team,
        members,
        lastSubmissions
      );

      return interaction.reply(dashboardPayload);
    }

    if (subcommand === "stats") {
      const teams = await repo.getTeams(interaction.guildId);
      const totalUnits = teams.reduce((acc, t) => acc + Number(t.goal_current), 0);
      const completedGoals = teams.filter((t) => Number(t.goal_current) >= Number(t.goal_target)).length;

      const mascot = client.mascot ? client.mascot("📈") : "📈";
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${mascot} Statistiques Générales de Production`)
        .addFields(
          { name: "🚩 Équipes Actives", value: `${teams.length}`, inline: true },
          { name: "📦 Total Unités Produites", value: `${totalUnits.toLocaleString("fr-FR")}`, inline: true },
          { name: "🏆 Objectifs Complétés", value: `${completedGoals} / ${teams.length}`, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "classement") {
      const type = interaction.options.getString("type") || "producers";
      const mascot = client.mascot ? client.mascot("🏆") : "🏆";

      if (type === "producers") {
        const topProducers = await repo.getTopProducers(interaction.guildId, 10);
        const formatted = formatLeaderboardTable(
          topProducers.map((p) => ({ name: `<@${p.user_id}>`, total: p.total_produced })),
          "Top Producteurs"
        );

        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`${mascot} Classement — Top Producteurs`)
          .setDescription(formatted)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (type === "teams") {
        const topTeams = await repo.getTopTeams(interaction.guildId, 10);
        const formatted = formatLeaderboardTable(
          topTeams.map((t) => ({ name: `${t.emoji || "📦"} ${t.name}`, total: t.goal_current })),
          "Top Équipes"
        );

        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`${mascot} Classement — Top Équipes`)
          .setDescription(formatted)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (type === "validators") {
        const topValidators = await repo.getTopValidators(interaction.guildId, 10);
        const formatted = formatLeaderboardTable(
          topValidators.map((v) => ({ name: `<@${v.validator_id}>`, total: v.count })),
          "Top Validateurs",
          "validations"
        );

        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`${mascot} Classement — Top Validateurs Staff`)
          .setDescription(formatted)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }
    }

    if (subcommand === "profil") {
      const targetUser = interaction.options.getUser("utilisateur") || interaction.user;
      const member = await repo.getMember(interaction.guildId, targetUser.id);
      const team = member ? await repo.getTeamById(member.team_id) : null;
      const achievements = await repo.getUserAchievements(interaction.guildId, targetUser.id);

      let gmodPlayer = null;
      if (client.database?.getDatabase()) {
        gmodPlayer = await repo.knex("gmod_players").where({ discord_id: targetUser.id }).first().catch(() => null);
      }

      const embed = ProgressionDashboardManager.buildProfileEmbed(
        client,
        targetUser,
        member,
        team,
        achievements,
        gmodPlayer
      );

      return interaction.reply({ embeds: [embed] });
    }
  },

  settings: {
    module: "progression",
    enabled: true,
  },
};

module.exports = { default: productionCommand };
