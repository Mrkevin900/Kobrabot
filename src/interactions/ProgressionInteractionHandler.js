const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const ProgressionService = require("../services/ProgressionService");
const ProgressionRepository = require("../database/repositories/ProgressionRepository");

class ProgressionInteractionHandler {
  /**
   * Reçoit les clics sur les boutons.
   */
  static async handleButton(client, interaction) {
    const customId = interaction.customId || "";
    const service = new ProgressionService(client);
    const repo = new ProgressionRepository(() => client.database?.getDatabase());

    // 1. Bouton Acceptation Staff
    if (customId.startsWith("progression_accept_")) {
      const submissionId = parseInt(customId.replace("progression_accept_", ""), 10);
      try {
        await interaction.deferUpdate();
        const updatedSub = await service.approveSubmission(submissionId, interaction.user.id);

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x57F287)
          .setTitle(`✅ Déclaration #${submissionId} — VALIDÉE`)
          .addFields({
            name: "🛡️ Traitement Staff",
            value: `Validé par ${interaction.user} à <t:${Math.floor(Date.now() / 1000)}:R>`,
            inline: false,
          });

        await interaction.editReply({ embeds: [embed], components: [] });
      } catch (error) {
        return interaction.followUp({
          content: `❌ Erreur: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
      return;
    }

    // 2. Bouton Refus Staff (Affiche Modal de motif)
    if (customId.startsWith("progression_refuse_")) {
      const submissionId = parseInt(customId.replace("progression_refuse_", ""), 10);

      const modal = new ModalBuilder()
        .setCustomId(`progression_refuse_modal_${submissionId}`)
        .setTitle("Motif du Refus de Production");

      const reasonInput = new TextInputBuilder()
        .setCustomId("refusal_reason")
        .setLabel("Raison précise du refus")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Ex: Preuve illisible / Quantité incorrecte / Pas de screenshot valide")
        .setRequired(true)
        .setMaxLength(500);

      const row = new ActionRowBuilder().addComponents(reasonInput);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }

    // 3. Bouton Déclaration sur le Tableau de Bord
    if (customId.startsWith("progression_declare_")) {
      const teamId = parseInt(customId.replace("progression_declare_", ""), 10);
      const team = await repo.getTeamById(teamId);

      if (!team || team.status !== "open") {
        return interaction.reply({
          content: "❌ Cette équipe est actuellement fermée ou indisponible.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`progression_declare_modal_${teamId}`)
        .setTitle(`Déclarer — ${team.name}`);

      const qtyInput = new TextInputBuilder()
        .setCustomId("declare_quantity")
        .setLabel(`Quantité (${team.goal_item})`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 150")
        .setRequired(true);

      const proofInput = new TextInputBuilder()
        .setCustomId("declare_proof_url")
        .setLabel("URL de la capture de preuve (ou lien Imgur/Discord)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("https://cdn.discordapp.com/attachments/...")
        .setRequired(true);

      const commentInput = new TextInputBuilder()
        .setCustomId("declare_comment")
        .setLabel("Commentaire (optionnel)")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Informations complémentaires...")
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(qtyInput),
        new ActionRowBuilder().addComponents(proofInput),
        new ActionRowBuilder().addComponents(commentInput)
      );

      return interaction.showModal(modal);
    }
  }

  /**
   * Reçoit les soumissions de Modals.
   */
  static async handleModal(client, interaction) {
    const customId = interaction.customId || "";
    const service = new ProgressionService(client);

    // 1. Soumission du Modal de Refus
    if (customId.startsWith("progression_refuse_modal_")) {
      const submissionId = parseInt(customId.replace("progression_refuse_modal_", ""), 10);
      const reason = interaction.fields.getTextInputValue("refusal_reason");

      try {
        await interaction.deferUpdate();
        await service.rejectSubmission(submissionId, interaction.user.id, reason);

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0xED4245)
          .setTitle(`❌ Déclaration #${submissionId} — REFUSÉE`)
          .addFields(
            { name: "🛡️ Traitement Staff", value: `Refusé par ${interaction.user} à <t:${Math.floor(Date.now() / 1000)}:R>`, inline: false },
            { name: "📝 Raison", value: reason, inline: false }
          );

        await interaction.editReply({ embeds: [embed], components: [] });
      } catch (error) {
        return interaction.followUp({
          content: `❌ Erreur: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
      return;
    }

    // 2. Soumission du Modal de Déclaration par Bouton
    if (customId.startsWith("progression_declare_modal_")) {
      const teamId = parseInt(customId.replace("progression_declare_modal_", ""), 10);
      const qtyStr = interaction.fields.getTextInputValue("declare_quantity");
      const proofUrl = interaction.fields.getTextInputValue("declare_proof_url");
      const comment = interaction.fields.getTextInputValue("declare_comment");

      const quantity = parseInt(qtyStr, 10);
      if (isNaN(quantity) || quantity <= 0) {
        return interaction.reply({
          content: "❌ Quantité invalide. Veuillez entrer un nombre entier positif.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!proofUrl || (!proofUrl.startsWith("http://") && !proofUrl.startsWith("https://"))) {
        return interaction.reply({
          content: "❌ URL de preuve invalide. Vous devez fournir un lien d'image valide (ex: https://...)",
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await service.submitProduction(
          interaction.guildId,
          interaction.user.id,
          teamId,
          quantity,
          proofUrl,
          comment
        );

        return interaction.editReply({
          content: "✅ **Déclaration envoyée !** Votre production a été transmise à l'équipe Staff pour validation.",
        });
      } catch (error) {
        return interaction.editReply({
          content: `❌ Erreur lors de la déclaration: ${error.message}`,
        });
      }
    }
  }
}

module.exports = ProgressionInteractionHandler;
