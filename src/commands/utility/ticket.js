const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const {
  buildTicketActionRows,
  isTicketStaff,
  parseTicketOwnerId,
  updateTicketTopicField,
} = require("../../utils/TicketUtils");

function ensureStore(client) {
  if (!client.cache) {
    const CacheManager = require("../../utils/CacheManager");
    client.cache = new CacheManager();
  }
  return client.cache;
}

const ticket = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Gestion du systeme de tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("panel")
        .setDescription("Envoie le panneau de creation de ticket")
        .addChannelOption((option) =>
          option
            .setName("salon")
            .setDescription("Salon ou envoyer le panneau")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configure la categorie et le role staff")
        .addChannelOption((option) =>
          option
            .setName("categorie")
            .setDescription("Categorie des tickets")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        )
        .addRoleOption((option) =>
          option
            .setName("role_staff")
            .setDescription("Role ayant acces aux tickets")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reopen")
        .setDescription("Rouvre un ticket ferme")
        .addChannelOption((option) =>
          option
            .setName("salon")
            .setDescription("Ticket a rouvrir")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        ),
    ),

  async executeCommand(client, interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "panel") return this.handlePanel(interaction);
    if (subcommand === "setup") return this.handleSetup(client, interaction);
    if (subcommand === "reopen") return this.handleReopen(client, interaction);

    return interaction.reply({
      content: "Sous-commande inconnue.",
      flags: MessageFlags.Ephemeral,
    });
  },

  async handlePanel(interaction) {
    const panelEmoji = interaction.client.emoji("constructor", "\u{1F477}");
    const qEmoji = interaction.client.emoji("magnifying_glass_112", "\u{1F50D}");
    const recruitEmoji = interaction.client.emoji("briefcase~1", "\u{1F4BC}");
    const plainteEmoji = interaction.client.emoji("police", "\u{1F46E}");
    const bugEmoji = interaction.client.emoji("kb_edit", "\u{1F527}");
    const autresEmoji = interaction.client.emoji("sweat~1", "\u{1F613}");
    const targetChannel = interaction.options.getChannel("salon") || interaction.channel;

    const helperImage =
      process.env.TICKET_PANEL_IMAGE_URL ||
      "https://github.com/KB-RolePlay/assets/blob/main/discord-stickers/wumpus--co-daily-routine/working/sticker.gif?raw=true";

    const embed = new EmbedBuilder()
      .setColor(0xff9500)
      .setTitle(`${panelEmoji} Comment creer un ticket ?`)
      .setDescription(
        "Pour ouvrir un ticket\n" +
          "Veuillez selectionner le motif parmis la liste ci-dessous\n\n" +
          "Cordialement,\n" +
          "L'equipe de moderation",
      )
      .setThumbnail(helperImage)
      .setFooter({
        text: interaction.guild?.name || interaction.client.user.username,
        iconURL: interaction.client.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_type_select")
      .setPlaceholder("Selectionner le type de ticket que vous voulez !")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Questions")
          .setDescription("Questions generales")
          .setValue("questions")
          .setEmoji(qEmoji),
        new StringSelectMenuOptionBuilder()
          .setLabel("Recrutements")
          .setDescription("Candidature staff")
          .setValue("recrutements")
          .setEmoji(recruitEmoji),
        new StringSelectMenuOptionBuilder()
          .setLabel("Plainte")
          .setDescription("Signaler un probleme")
          .setValue("plainte")
          .setEmoji(plainteEmoji),
        new StringSelectMenuOptionBuilder()
          .setLabel("Bug")
          .setDescription("Signaler un bug")
          .setValue("bug")
          .setEmoji(bugEmoji),
        new StringSelectMenuOptionBuilder()
          .setLabel("Autres")
          .setDescription("Autre demande")
          .setValue("autres")
          .setEmoji(autresEmoji),
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await targetChannel.send({ embeds: [embed], components: [row] });
    return interaction.reply({
      content: `Panneau ticket envoye dans ${targetChannel}.`,
      flags: MessageFlags.Ephemeral,
    });
  },

  async handleSetup(client, interaction) {
    const mascot = client.mascot("\u{1F497}");
    const store = ensureStore(client);
    const category = interaction.options.getChannel("categorie");
    const staffRole = interaction.options.getRole("role_staff");

    const allConfigs = store.has("ticketConfig") ? store.get("ticketConfig") : {};
    allConfigs[interaction.guild.id] = {
      categoryId: category.id,
      staffRoleId: staffRole.id,
      updatedAt: Date.now(),
    };
    store.set("ticketConfig", allConfigs);

    process.env.TICKET_CATEGORY_ID = category.id;
    process.env.TICKET_STAFF_ROLE_ID = staffRole.id;

    const embed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle(`${mascot} Configuration ticket enregistree`)
      .addFields(
        { name: "Categorie", value: `${category}`, inline: true },
        { name: "Role staff", value: `${staffRole}`, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async handleReopen(client, interaction) {
    const channel = interaction.options.getChannel("salon") || interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      return interaction.reply({
        content: "Le salon cible doit etre un ticket texte.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!channel.topic || !channel.topic.includes("User:")) {
      return interaction.reply({
        content: "Ce salon ne ressemble pas a un ticket.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const ownerId = parseTicketOwnerId(channel);
    const canReopen = isTicketStaff(interaction.member) || interaction.user.id === ownerId;
    if (!canReopen) {
      return interaction.reply({
        content: "Tu n'as pas la permission de rouvrir ce ticket.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const isClosed =
      /Status:\s*closed/i.test(channel.topic || "") ||
      String(channel.name || "").endsWith("-closed");

    if (!isClosed) {
      return interaction.editReply("Ce ticket est deja ouvert.");
    }

    const newName = String(channel.name || "").replace(/-closed$/i, "").slice(0, 100);
    if (newName && newName !== channel.name) {
      await channel.setName(newName).catch(() => {});
    }

    await updateTicketTopicField(channel, "Status", "open");

    const staffRoleId = process.env.TICKET_STAFF_ROLE_ID;
    if (staffRoleId) {
      await channel.permissionOverwrites
        .edit(staffRoleId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        })
        .catch(() => {});
    }

    if (ownerId) {
      await channel.permissionOverwrites
        .edit(ownerId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        })
        .catch(() => {});
    }

    await channel
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle("Ticket rouvert")
            .setDescription(`Ce ticket a ete rouvert par ${interaction.user}.`)
            .setTimestamp(),
        ],
        components: buildTicketActionRows(client),
      })
      .catch(() => {});

    return interaction.editReply(`Ticket rouvert: ${channel}`);
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: ticket };

