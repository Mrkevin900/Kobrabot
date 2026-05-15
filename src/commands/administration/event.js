const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");
const { addEventRecord } = require("../../utils/events");

function attachmentIsImage(attachment) {
  const type = String(attachment?.contentType || "").toLowerCase();
  const name = String(attachment?.name || "").toLowerCase();
  return type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(name);
}

const event = {
  data: new SlashCommandBuilder()
    .setName("event")
    .setDescription("Publie une annonce d'evenement")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Cree une annonce d'evenement")
        .addStringOption((option) =>
          option
            .setName("titre")
            .setDescription("Titre de l'evenement")
            .setRequired(true)
            .setMaxLength(120),
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Description de l'evenement")
            .setRequired(true)
            .setMaxLength(4000),
        )
        .addStringOption((option) =>
          option
            .setName("quand")
            .setDescription("Date / heure / indication de l'evenement")
            .setRequired(true)
            .setMaxLength(120),
        )
        .addChannelOption((option) =>
          option
            .setName("salon")
            .setDescription("Salon de destination")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName("ping_role")
            .setDescription("Role a mentionner")
            .setRequired(false),
        )
        .addAttachmentOption((option) =>
          option
            .setName("image")
            .setDescription("Image de l'evenement")
            .setRequired(false),
        ),
    ),

  async executeCommand(client, interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== "create") {
      return interaction.reply({
        content: "Sous-commande inconnue.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetChannel = interaction.options.getChannel("salon") || interaction.channel;
    const title = interaction.options.getString("titre", true);
    const description = interaction.options.getString("description", true);
    const when = interaction.options.getString("quand", true);
    const pingRole = interaction.options.getRole("ping_role");
    const image = interaction.options.getAttachment("image");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Evenement - ${title}`)
      .setDescription(description)
      .addFields(
        { name: "Quand", value: when, inline: false },
        { name: "Organise par", value: `${interaction.user}`, inline: true },
        { name: "Salon", value: `${targetChannel}`, inline: true },
      )
      .setFooter({ text: interaction.guild.name })
      .setTimestamp();

    if (image && attachmentIsImage(image)) {
      embed.setImage(image.url);
    }

    const sent = await targetChannel.send({
      content: pingRole ? `${pingRole}` : undefined,
      embeds: [embed],
      allowedMentions: { roles: pingRole ? [pingRole.id] : [] },
    });
    await sent.react("✅").catch(() => {});
    await sent.react("❌").catch(() => {});
    await addEventRecord(client, {
      guildId: interaction.guild.id,
      channelId: targetChannel.id,
      messageId: sent.id,
      authorId: interaction.user.id,
      title,
      description,
      whenText: when,
      createdAt: Date.now(),
    });

    return interaction.reply({
      content: `Evenement publie dans ${targetChannel}.`,
      flags: MessageFlags.Ephemeral,
    });
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: event };

