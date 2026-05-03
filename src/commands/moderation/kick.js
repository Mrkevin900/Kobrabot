const {
  EmbedBuilder,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");
const { getDatabase } = require("../../database/database");
const dayjs = require("dayjs");

const kick = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("\u2728 Expulse une personne du serveur")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option
        .setName("membre")
        .setDescription("\u2728 La personne à expulser")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("raison")
        .setDescription("\u2728 Raison de l'expulsion")
        .setRequired(false)
    ),

  async executeCommand(client, interaction) {
    const guild = interaction.guild;
    const member = interaction.options.getMember("membre");
    const reason = interaction.options.getString("raison") || "Aucune raison fournie";

    // Vérifications
    if (!member) {
      return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
    }

    if (!member.kickable) {
      return interaction.reply({ content: "❌ Je ne peux pas expulser cet utilisateur !", ephemeral: true });
    }

    if (member.user.id === interaction.user.id) {
      return interaction.reply({ content: "❌ Vous ne pouvez pas vous expulser vous-même !", ephemeral: true });
    }

    if (!guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({ content: "❌ Je n'ai pas la permission Kick Members !", ephemeral: true });
    }

    // DM l'utilisateur avant kick
    try {
      await member.send({
        content: `Tu as été **expulsé** de **${guild.name}** par <@${interaction.user.id}>\n\n**Raison :** ${reason}`,
      }).catch(() => {});
    } catch (e) {}

    try {
      await member.kick(reason);

      // Log en base de données
      try {
        await getDatabase()("kick_table").insert({
          infraction_id: `kick_${member.user.id}_${Date.now()}`,
          server_id: guild.id,
          member_id: member.user.id,
          kick_date: dayjs().format("DD/MM/YYYY à HH:mm:ss"),
          kick_reason: reason,
          moderator: interaction.user.id,
        });
        client.getLogger().send(`Kick enregistré pour ${member.user.tag}`, "NOTIF");
      } catch (dbError) {
        client.getLogger().send("Erreur Database : " + dbError, "ERROR");
      }

      const kickEmbed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle("⚠️ Utilisateur expulsé")
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "👤 Utilisateur", value: member.user.tag, inline: true },
          { name: "🆔 ID", value: `\`${member.user.id}\``, inline: true },
          { name: "📝 Raison", value: reason, inline: false },
          { name: "⏰ Date", value: dayjs().format("DD/MM/YYYY à HH:mm:ss"), inline: false },
          { name: "🔨 Modérateur", value: interaction.user.toString(), inline: true }
        )
        .setFooter({ text: "KobraBot - Modération" })
        .setTimestamp();

      await interaction.reply({ embeds: [kickEmbed] });

      if (client.loggerManager) {
        await client.loggerManager.logPunishment(guild, "Kick", member.user, interaction.user, reason);
      }
    } catch (error) {
      client.getLogger().send("Erreur lors du kick : " + error, "ERROR");
      return interaction.reply({
        content: "❌ Une erreur est survenue lors de l'expulsion.",
        ephemeral: true,
      });
    }
  },

  settings: {
    module: "module_mo",
    enabled: true,
  },
};

module.exports = { default: kick };



