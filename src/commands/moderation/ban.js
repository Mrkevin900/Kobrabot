const {
  EmbedBuilder,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");
const { getDatabase } = require("../../database/database");
const ModerationDb = require("../../utils/ModerationDb");
const dayjs = require("dayjs");

const ban = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannir une personne du serveur")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option
        .setName("membre")
        .setDescription("La personne a bannir")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("raison")
        .setDescription("Raison du bannissement")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("supprimer_messages_jours")
        .setDescription("Supprime les messages recents (0-7 jours)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    ),

  async executeCommand(client, interaction) {
    const guild = interaction.guild;
    const member = interaction.options.getMember("membre");
    const reason = interaction.options.getString("raison") || "Aucune raison fournie";
    const deleteMessagesDays = interaction.options.getInteger("supprimer_messages_jours") ?? 0;
    const executorTopRole = interaction.member?.roles?.highest?.position ?? 0;

    if (!member) {
      return interaction.reply({ content: "Membre introuvable.", ephemeral: true });
    }

    if (member.user.id === interaction.user.id) {
      return interaction.reply({ content: "Vous ne pouvez pas vous bannir vous-meme.", ephemeral: true });
    }

    if (member.user.id === client.user.id) {
      return interaction.reply({ content: "Je ne peux pas me bannir moi-meme.", ephemeral: true });
    }

    if (member.user.id === guild.ownerId) {
      return interaction.reply({ content: "Impossible de bannir le proprietaire du serveur.", ephemeral: true });
    }

    if (!member.bannable) {
      return interaction.reply({ content: "Je ne peux pas bannir cet utilisateur.", ephemeral: true });
    }

    if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: "Je n'ai pas la permission Ban Members.", ephemeral: true });
    }

    if (member.roles.highest.position >= executorTopRole && interaction.user.id !== guild.ownerId) {
      return interaction.reply({
        content: "Vous ne pouvez pas bannir un membre avec un role egal ou superieur au votre.",
        ephemeral: true,
      });
    }

    try {
      await member.send({
        content: `Tu as ete banni de ${guild.name} par <@${interaction.user.id}>\n\nRaison : ${reason}`,
      }).catch(() => {});
    } catch (e) {}

    try {
      await member.ban({ reason, deleteMessageSeconds: deleteMessagesDays * 86400 });

      try {
        await ModerationDb.logBan(client, guild.id, interaction.user.id, member.user.id, reason);
        client.getLogger().send(`Ban enregistré pour ${member.user.tag}`, "NOTIF");
      } catch (dbError) {
        client.getLogger().send("Erreur Database : " + dbError, "ERROR");
      }

      const banEmbed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle("Utilisateur banni")
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "Utilisateur", value: member.user.tag, inline: true },
          { name: "ID", value: `\`${member.user.id}\``, inline: true },
          { name: "Raison", value: reason, inline: false },
          { name: "Messages supprimes", value: `${deleteMessagesDays} jour(s)`, inline: true },
          { name: "Date", value: dayjs().format("DD/MM/YYYY a HH:mm:ss"), inline: false },
          { name: "Moderateur", value: interaction.user.toString(), inline: true }
        )
        .setFooter({ text: "KobraBot - Moderation" })
        .setTimestamp();

      await interaction.reply({ embeds: [banEmbed] });
    } catch (error) {
      client.getLogger().send("Erreur lors du ban : " + error, "ERROR");
      return interaction.reply({
        content: "Une erreur est survenue lors du bannissement.",
        ephemeral: true,
      });
    }
  },

  settings: {
    module: "module_mo",
    enabled: true,
  },
};

module.exports = { default: ban };


