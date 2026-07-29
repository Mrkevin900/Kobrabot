/**
 * Repository layer for Progression Manager module database operations.
 */
class ProgressionRepository {
  constructor(databaseConnector) {
    this.dbConnector = databaseConnector;
  }

  get knex() {
    const db = typeof this.dbConnector === "function" ? this.dbConnector() : this.dbConnector;
    if (!db) {
      throw new Error("Base de données indisponible");
    }
    return db;
  }

  // ================= GUILD CONFIG =================
  async getGuildConfig(guildId) {
    let config = await this.knex("progression_guild_config").where({ guild_id: guildId }).first();
    if (!config) {
      await this.knex("progression_guild_config").insert({
        guild_id: guildId,
        staff_channel_id: null,
        log_channel_id: null,
        auto_next_objective: false,
        dm_notifications: true,
        language: "fr",
      }).onConflict("guild_id").ignore();
      config = await this.knex("progression_guild_config").where({ guild_id: guildId }).first();
    }
    return config;
  }

  async updateGuildConfig(guildId, data) {
    await this.getGuildConfig(guildId);
    await this.knex("progression_guild_config").where({ guild_id: guildId }).update({
      ...data,
      updated_at: this.knex.fn.now(),
    });
    return this.getGuildConfig(guildId);
  }

  // ================= TEAMS =================
  async getTeams(guildId) {
    return this.knex("progression_teams").where({ guild_id: guildId }).orderBy("id", "asc");
  }

  async getTeamById(teamId) {
    return this.knex("progression_teams").where({ id: teamId }).first();
  }

  async getTeamByName(guildId, name) {
    return this.knex("progression_teams")
      .where({ guild_id: guildId })
      .whereRaw("LOWER(name) = ?", [String(name).toLowerCase()])
      .first();
  }

  async createTeam(data) {
    const [id] = await this.knex("progression_teams").insert({
      guild_id: data.guild_id,
      name: data.name,
      icon: data.icon || null,
      emoji: data.emoji || "📦",
      color: data.color || "#5865F2",
      description: data.description || null,
      goal_item: data.goal_item,
      goal_target: data.goal_target,
      goal_current: data.goal_current || 0,
      role_id: data.role_id || null,
      channel_id: data.channel_id || null,
      category_id: data.category_id || null,
      leader_id: data.leader_id || null,
      co_leader_id: data.co_leader_id || null,
      status: data.status || "open",
      dashboard_message_id: null,
      created_at: this.knex.fn.now(),
      updated_at: this.knex.fn.now(),
    });

    // Auto add leader as member if specified
    if (data.leader_id) {
      await this.addMember(data.guild_id, id, data.leader_id, "leader");
    }
    if (data.co_leader_id) {
      await this.addMember(data.guild_id, id, data.co_leader_id, "coleader");
    }

    return this.getTeamById(id);
  }

  async updateTeam(teamId, data) {
    await this.knex("progression_teams").where({ id: teamId }).update({
      ...data,
      updated_at: this.knex.fn.now(),
    });
    return this.getTeamById(teamId);
  }

  async deleteTeam(teamId) {
    await this.knex("progression_members").where({ team_id: teamId }).del();
    return this.knex("progression_teams").where({ id: teamId }).del();
  }

  async resetTeamGoal(teamId, newTarget = null, newItem = null) {
    const team = await this.getTeamById(teamId);
    if (!team) return null;

    const updateData = {
      goal_current: 0,
      updated_at: this.knex.fn.now(),
    };

    if (newTarget) updateData.goal_target = newTarget;
    if (newItem) updateData.goal_item = newItem;

    await this.knex("progression_teams").where({ id: teamId }).update(updateData);
    return this.getTeamById(teamId);
  }

  // ================= MEMBERS =================
  async getTeamMembers(teamId) {
    return this.knex("progression_members").where({ team_id: teamId }).orderBy("total_produced", "desc");
  }

  async getMember(guildId, userId) {
    return this.knex("progression_members")
      .where({ guild_id: guildId, user_id: userId })
      .first();
  }

  async addMember(guildId, teamId, userId, roleInTeam = "member") {
    const existing = await this.knex("progression_members")
      .where({ guild_id: guildId, user_id: userId })
      .first();

    if (existing) {
      await this.knex("progression_members").where({ id: existing.id }).update({
        team_id: teamId,
        role_in_team: roleInTeam,
      });
      return this.knex("progression_members").where({ id: existing.id }).first();
    }

    const [id] = await this.knex("progression_members").insert({
      guild_id: guildId,
      team_id: teamId,
      user_id: userId,
      role_in_team: roleInTeam,
      total_produced: 0,
      validations_count: 0,
      refusals_count: 0,
      joined_at: this.knex.fn.now(),
    });

    return this.knex("progression_members").where({ id }).first();
  }

  async removeMember(guildId, userId) {
    return this.knex("progression_members").where({ guild_id: guildId, user_id: userId }).del();
  }

  async incrementMemberStats(guildId, userId, quantity, isApproved) {
    const member = await this.getMember(guildId, userId);
    if (!member) return null;

    if (isApproved) {
      await this.knex("progression_members")
        .where({ id: member.id })
        .increment("total_produced", quantity)
        .increment("validations_count", 1);
    } else {
      await this.knex("progression_members")
        .where({ id: member.id })
        .increment("refusals_count", 1);
    }

    return this.getMember(guildId, userId);
  }

  // ================= SUBMISSIONS =================
  async createSubmission(data) {
    const [id] = await this.knex("progression_submissions").insert({
      guild_id: data.guild_id,
      team_id: data.team_id,
      user_id: data.user_id,
      quantity: data.quantity,
      proof_url: data.proof_url,
      comment: data.comment || null,
      status: "pending",
      created_at: this.knex.fn.now(),
    });

    return this.getSubmissionById(id);
  }

  async getSubmissionById(id) {
    return this.knex("progression_submissions").where({ id }).first();
  }

  async updateSubmissionStatus(id, status, validatorId, rejectionReason = null, messageId = null) {
    const updateData = {
      status,
      validator_id: validatorId,
      validated_at: this.knex.fn.now(),
    };
    if (rejectionReason) updateData.rejection_reason = rejectionReason;
    if (messageId) updateData.validation_message_id = messageId;

    await this.knex("progression_submissions").where({ id }).update(updateData);
    return this.getSubmissionById(id);
  }

  // ================= HISTORY / AUDIT =================
  async logAction(guildId, teamId, userId, actorId, action, oldValue = null, newValue = null) {
    await this.knex("progression_history").insert({
      guild_id: guildId,
      team_id: teamId || null,
      user_id: userId || null,
      actor_id: actorId,
      action: action,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      ip_address: "127.0.0.1",
      created_at: this.knex.fn.now(),
    });
  }

  // ================= ACHIEVEMENTS =================
  async getUserAchievements(guildId, userId) {
    return this.knex("progression_achievements").where({ guild_id: guildId, user_id: userId });
  }

  async unlockAchievement(guildId, userId, badgeKey) {
    const existing = await this.knex("progression_achievements")
      .where({ guild_id: guildId, user_id: userId, badge_key: badgeKey })
      .first();

    if (!existing) {
      await this.knex("progression_achievements").insert({
        guild_id: guildId,
        user_id: userId,
        badge_key: badgeKey,
        unlocked_at: this.knex.fn.now(),
      });
      return true;
    }
    return false;
  }

  // ================= LEADERBOARDS & STATS =================
  async getTopProducers(guildId, limit = 10) {
    return this.knex("progression_members")
      .where({ guild_id: guildId })
      .orderBy("total_produced", "desc")
      .limit(limit);
  }

  async getTopTeams(guildId, limit = 10) {
    return this.knex("progression_teams")
      .where({ guild_id: guildId })
      .orderBy("goal_current", "desc")
      .limit(limit);
  }

  async getTopValidators(guildId, limit = 10) {
    return this.knex("progression_submissions")
      .select("validator_id")
      .count("id as count")
      .where({ guild_id: guildId, status: "approved" })
      .whereNotNull("validator_id")
      .groupBy("validator_id")
      .orderBy("count", "desc")
      .limit(limit);
  }
}

module.exports = ProgressionRepository;
