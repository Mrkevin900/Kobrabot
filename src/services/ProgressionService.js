const ProgressionRepository = require("../database/repositories/ProgressionRepository");
const ProgressionDashboardManager = require("../managers/ProgressionDashboardManager");
const { EmbedBuilder } = require("discord.js");

class ProgressionService {
  constructor(client) {
    this.client = client;
    this.repo = new ProgressionRepository(() => client.database?.getDatabase());
  }

  /**
   * Crée une déclaration de production et l'envoie dans le salon Staff.
   */
  async submitProduction(guildId, userId, teamId, quantity, proofUrl, comment) {
    const team = await this.repo.getTeamById(teamId);
    if (!team) throw new Error("Équipe introuvable.");
    if (team.status !== "open") throw new Error("Cette équipe est fermée ou suspendue.");

    const submission = await this.repo.createSubmission({
      guild_id: guildId,
      team_id: teamId,
      user_id: userId,
      quantity,
      proof_url: proofUrl,
      comment,
    });

    await this.repo.logAction(guildId, teamId, userId, userId, "PRODUCTION_SUBMIT", null, {
      submissionId: submission.id,
      quantity,
    });

    const guildConfig = await this.repo.getGuildConfig(guildId);
    if (guildConfig && guildConfig.staff_channel_id) {
      const staffChannel = await this.client.channels.fetch(guildConfig.staff_channel_id).catch(() => null);
      if (staffChannel && staffChannel.isTextBased()) {
        const user = await this.client.users.fetch(userId).catch(() => ({ id: userId, username: "Inconnu", displayAvatarURL: () => null }));
        const ticketData = ProgressionDashboardManager.buildValidationTicket(this.client, submission, user, team);
        const sentMsg = await staffChannel.send(ticketData).catch(() => null);
        if (sentMsg) {
          await this.repo.updateSubmissionStatus(submission.id, "pending", null, null, sentMsg.id);
        }
      }
    }

    return submission;
  }

  /**
   * Valide une déclaration de production par le Staff.
   */
  async approveSubmission(submissionId, validatorId) {
    const submission = await this.repo.getSubmissionById(submissionId);
    if (!submission) throw new Error("Déclaration introuvable.");
    if (submission.status !== "pending") throw new Error("Cette déclaration a déjà été traitée.");

    const team = await this.repo.getTeamById(submission.team_id);
    if (!team) throw new Error("Équipe associée introuvable.");

    // Transactional updates
    const updatedSub = await this.repo.updateSubmissionStatus(submissionId, "approved", validatorId);
    const newGoalCurrent = Number(team.goal_current) + Number(submission.quantity);
    const updatedTeam = await this.repo.updateTeam(team.id, { goal_current: newGoalCurrent });
    await this.repo.incrementMemberStats(submission.guild_id, submission.user_id, submission.quantity, true);

    // Audit log
    await this.repo.logAction(submission.guild_id, team.id, submission.user_id, validatorId, "PRODUCTION_APPROVE", {
      old_current: team.goal_current,
    }, {
      new_current: newGoalCurrent,
      quantity: submission.quantity,
    });

    // Check achievement badges
    const member = await this.repo.getMember(submission.guild_id, submission.user_id);
    if (member && member.total_produced >= 1000) {
      await this.repo.unlockAchievement(submission.guild_id, submission.user_id, "PRODUCER_1000");
    }

    // DM Notification
    const guildConfig = await this.repo.getGuildConfig(submission.guild_id);
    if (guildConfig?.dm_notifications) {
      const user = await this.client.users.fetch(submission.user_id).catch(() => null);
      if (user) {
        await user.send(
          `🎉 **Validation reçue !** Votre déclaration de **+${Number(submission.quantity).toLocaleString("fr-FR")} ${team.goal_item}** pour l'équipe **${team.name}** a été validée.`
        ).catch(() => {});
      }
    }

    // Auto-refresh Team Dashboard Embed
    await this.refreshTeamDashboard(team.id);

    // Check if goal reached
    if (newGoalCurrent >= Number(team.goal_target)) {
      await this.handleGoalReached(updatedTeam, guildConfig);
    }

    return updatedSub;
  }

  /**
   * Refuse une déclaration de production par le Staff.
   */
  async rejectSubmission(submissionId, validatorId, reason) {
    const submission = await this.repo.getSubmissionById(submissionId);
    if (!submission) throw new Error("Déclaration introuvable.");
    if (submission.status !== "pending") throw new Error("Cette déclaration a déjà été traitée.");

    const updatedSub = await this.repo.updateSubmissionStatus(submissionId, "rejected", validatorId, reason);
    await this.repo.incrementMemberStats(submission.guild_id, submission.user_id, 0, false);

    const team = await this.repo.getTeamById(submission.team_id);

    await this.repo.logAction(submission.guild_id, submission.team_id, submission.user_id, validatorId, "PRODUCTION_REJECT", null, {
      reason,
    });

    // DM Notification
    const guildConfig = await this.repo.getGuildConfig(submission.guild_id);
    if (guildConfig?.dm_notifications) {
      const user = await this.client.users.fetch(submission.user_id).catch(() => null);
      if (user) {
        await user.send(
          `❌ **Déclaration refusée.** Votre déclaration de production pour l'équipe **${team?.name || "inconnue"}** a été refusée par le staff.\n**Raison:** ${reason}`
        ).catch(() => {});
      }
    }

    return updatedSub;
  }

  /**
   * Gère la réalisation d'un objectif d'équipe.
   */
  async handleGoalReached(team, guildConfig) {
    if (team.channel_id) {
      const channel = await this.client.channels.fetch(team.channel_id).catch(() => null);
      if (channel && channel.isTextBased()) {
        const mascot = this.client.mascot ? this.client.mascot("🏆") : "🏆";
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle(`${mascot} OBJECTIF ATTEINT !`)
          .setDescription(`Félicitations à toute l'équipe **${team.name}** ! L'objectif de **${Number(team.goal_target).toLocaleString("fr-FR")} ${team.goal_item}** est officiellement complété !`)
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => null);
      }
    }

    if (guildConfig?.auto_next_objective) {
      await this.repo.resetTeamGoal(team.id);
      await this.refreshTeamDashboard(team.id);
    }
  }

  /**
   * Met à jour le message de tableau de bord dans le salon Discord de l'équipe.
   */
  async refreshTeamDashboard(teamId) {
    const team = await this.repo.getTeamById(teamId);
    if (!team || !team.channel_id) return;

    const channel = await this.client.channels.fetch(team.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const members = await this.repo.getTeamMembers(team.id);
    const lastSubmissions = await this.repo.knex("progression_submissions")
      .where({ team_id: team.id, status: "approved" })
      .orderBy("validated_at", "desc")
      .first();

    const dashboardPayload = ProgressionDashboardManager.buildTeamDashboardEmbed(
      this.client,
      team,
      members,
      lastSubmissions
    );

    if (team.dashboard_message_id) {
      const existingMsg = await channel.messages.fetch(team.dashboard_message_id).catch(() => null);
      if (existingMsg) {
        await existingMsg.edit(dashboardPayload).catch(() => null);
        return;
      }
    }

    // Otherwise send new message and record message ID
    const newMsg = await channel.send(dashboardPayload).catch(() => null);
    if (newMsg) {
      await this.repo.updateTeam(team.id, { dashboard_message_id: newMsg.id });
    }
  }
}

module.exports = ProgressionService;
