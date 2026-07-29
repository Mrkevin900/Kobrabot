const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { createProgressBar } = require("../utils/ProgressBar");

class ProgressionDashboardManager {
  /**
   * Construit l'embed du tableau de bord dynamique d'une équipe.
   */
  static buildTeamDashboardEmbed(client, team, members = [], lastSubmission = null) {
    const embedColor = team.color && /^#[0-9A-F]{6}$/i.test(team.color) ? team.color : "#5865F2";
    const mascot = client.mascot ? client.mascot("📦") : "📦";

    const { displayText, percentage } = createProgressBar(
      team.goal_current,
      team.goal_target,
      12
    );

    const leaderMention = team.leader_id ? `<@${team.leader_id}>` : "Non assigné";
    const coLeaderMention = team.co_leader_id ? `<@${team.co_leader_id}>` : "Non assigné";

    const statusBadge =
      team.status === "open"
        ? "🟢 Ouvert"
        : team.status === "closed"
        ? "🔴 Fermé"
        : "🟡 Suspendu";

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${team.emoji || mascot} Tableau de Bord — ${team.name}`)
      .setDescription(team.description || "*Aucune description configurée pour cette équipe.*")
      .addFields(
        {
          name: "🎯 Objectif de Production",
          value: `Item: **${team.goal_item}**\n${displayText}`,
          inline: false,
        },
        {
          name: "👑 Direction",
          value: `**Chef:** ${leaderMention}\n**Sous-chef:** ${coLeaderMention}`,
          inline: true,
        },
        {
          name: "👥 Effectif & Statut",
          value: `**Membres:** ${members.length}\n**Statut:** ${statusBadge}`,
          inline: true,
        }
      )
      .setTimestamp();

    if (team.icon) {
      embed.setThumbnail(team.icon);
    }

    if (lastSubmission) {
      const lastUser = lastSubmission.user_id ? `<@${lastSubmission.user_id}>` : "Inconnu";
      const lastTime = lastSubmission.validated_at
        ? `<t:${Math.floor(new Date(lastSubmission.validated_at).getTime() / 1000)}:R>`
        : "Récemment";

      embed.addFields({
        name: "⏱️ Dernière Activité Validée",
        value: `**Producteur:** ${lastUser}\n**Quantité:** +${Number(lastSubmission.quantity).toLocaleString("fr-FR")} ${team.goal_item}\n**Date:** ${lastTime}`,
        inline: false,
      });
    }

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`progression_declare_${team.id}`)
        .setLabel("Déclarer une production")
        .setEmoji("📦")
        .setStyle(team.status === "open" ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(team.status !== "open")
    );

    return { embeds: [embed], components: [actionRow] };
  }

  /**
   * Construit la demande de validation pour le salon Staff.
   */
  static buildValidationTicket(client, submission, user, team) {
    const mascot = client.mascot ? client.mascot("📋") : "📋";
    const currentGoal = Number(team.goal_current) || 0;
    const addedQty = Number(submission.quantity) || 0;
    const targetGoal = Number(team.goal_target) || 1;
    const newGoal = currentGoal + addedQty;

    const oldBar = createProgressBar(currentGoal, targetGoal, 10).displayText;
    const newBar = createProgressBar(newGoal, targetGoal, 10).displayText;

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C) // Yellow for pending
      .setTitle(`${mascot} Déclaration de Production #${submission.id}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "👤 Joueur", value: `${user} (${user.id})`, inline: true },
        { name: "🚩 Équipe", value: `${team.emoji || "📦"} ${team.name}`, inline: true },
        { name: "📦 Quantité déclarée", value: `**+${addedQty.toLocaleString("fr-FR")}** ${team.goal_item}`, inline: true },
        { name: "📊 Progression Actuelle", value: oldBar, inline: false },
        { name: "📈 Progression Après Validation", value: newBar, inline: false },
        { name: "💬 Commentaire", value: submission.comment || "*Aucun commentaire*", inline: false }
      )
      .setTimestamp();

    if (submission.proof_url) {
      embed.setImage(submission.proof_url);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`progression_accept_${submission.id}`)
        .setLabel("Accepter")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`progression_refuse_${submission.id}`)
        .setLabel("Refuser")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row] };
  }

  /**
   * Construit le profil de membre.
   */
  static buildProfileEmbed(client, user, member, team, achievements = [], gmodPlayer = null) {
    const mascot = client.mascot ? client.mascot("👤") : "👤";
    const totalQty = Number(member?.total_produced || 0).toLocaleString("fr-FR");
    const validations = Number(member?.validations_count || 0);
    const refusals = Number(member?.refusals_count || 0);
    const totalRequests = validations + refusals;
    const successRate = totalRequests > 0 ? ((validations / totalRequests) * 100).toFixed(1) : "100";

    const teamName = team ? `${team.emoji || "📦"} ${team.name}` : "Aucune équipe";
    const roleInTeam = member?.role_in_team === "leader" ? "👑 Chef" : member?.role_in_team === "coleader" ? "⭐ Sous-chef" : "🔹 Membre";

    const badgeList = achievements.length > 0
      ? achievements.map(a => `🎖️ **${a.badge_key}**`).join("\n")
      : "*Aucun badge débloqué.*";

    const embed = new EmbedBuilder()
      .setColor(team?.color || 0x5865F2)
      .setTitle(`${mascot} Profil de Production — ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "👥 Équipe & Rôle", value: `**Équipe:** ${teamName}\n**Rôle:** ${roleInTeam}`, inline: true },
        { name: "📦 Total Produit", value: `**${totalQty}** unités`, inline: true },
        { name: "📊 Taux de Validation", value: `**${validations}** validées / **${refusals}** refusées (${successRate}%)`, inline: true },
        { name: "🏆 Badges & Succès", value: badgeList, inline: false }
      )
      .setTimestamp();

    if (gmodPlayer) {
      const hours = Math.floor((gmodPlayer.playtime || 0) / 3600);
      embed.addFields({
        name: "🎮 In-Game RP",
        value: `**Nom RP:** ${gmodPlayer.rpname || "N/A"}\n**Métier:** ${gmodPlayer.job || "N/A"}\n**Temps de jeu:** ${hours}h`,
        inline: false,
      });
    }

    return embed;
  }
}

module.exports = ProgressionDashboardManager;
