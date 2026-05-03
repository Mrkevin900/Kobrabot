const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");
const { addWarning, getWarningsForMember } = require("../../utils/warnings");

const warn = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Ajoute un avertissement a un membre")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("membre")
        .setDescription("Membre a avertir")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("raison")
        .setDescription("Raison de l'avertissement")
        .setRequired(true)
        .setMaxLength(500),
    ),

  async executeCommand(client, interaction) {
    const target = interaction.options.getMember("membre");
    const reason = interaction.options.getString("raison", true).trim();
    const guild = interaction.guild;

    if (!target) {
      return interaction.reply({
        content: "Membre introuvable.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: "Tu ne peux pas t'avertir toi-meme.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (target.id === guild.ownerId) {
      return interaction.reply({
        content: "Impossible d'avertir le proprietaire du serveur.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const executorTopRole = interaction.member?.roles?.highest?.position ?? 0;
    const targetTopRole = target.roles?.highest?.position ?? 0;
    if (targetTopRole >= executorTopRole && interaction.user.id !== guild.ownerId) {
      return interaction.reply({
        content: "Tu ne peux pas avertir un membre avec un role egal ou superieur au tien.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const record = await addWarning(client, {
      guildId: guild.id,
      userId: target.id,
      moderatorId: interaction.user.id,
      reason,
      createdAt: Date.now(),
    });
    const allWarnings = await getWarningsForMember(client, guild.id, target.id, 100);

    await target
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xfaa61a)
            .setTitle("Avertissement recu")
            .setDescription(`Serveur: **${guild.name}**\nRaison: **${reason}**`)
            .setFooter({ text: `Moderateur: ${interaction.user.tag}` })
            .setTimestamp(),
        ],
      })
      .catch(() => {});

    const embed = new EmbedBuilder()
      .setColor(0xfaa61a)
      .setTitle("Avertissement ajoute")
      .addFields(
        { name: "Membre", value: `${target}`, inline: true },
        { name: "Moderateur", value: `${interaction.user}`, inline: true },
        { name: "ID avertissement", value: `#${record.id}`, inline: true },
        { name: "Raison", value: reason, inline: false },
        { name: "Total", value: `${allWarnings.length} avertissement(s)`, inline: true },
      )
      .setTimestamp();

    client
      .getLogger()
      ?.send(`[WARN] ${interaction.user.tag} -> ${target.user.tag} | ${reason}`, "INFO");

    if (client.loggerManager) {
      await client.loggerManager.logPunishment(guild, "Warn", target.user, interaction.user, reason);
    }

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  settings: {
    module: "moderation",
    enabled: true,
  },
};

module.exports = { default: warn };

