const {
  MessageFlags,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { getDatabase, ensureDatabaseConnection } = require("../database/database");

const TICKET_TYPE_CONTENT = {
  questions: {
    label: "Questions generales",
    color: 0x3498db,
    image: process.env.TICKET_IMAGE_COMMON || "https://i.imgur.com/ZoOiFus.png",
    intro:
      "Ce ticket est reserve aux demandes d'information, aide d'utilisation et clarifications.",
    checklist: [
      "Explique clairement ta question (contexte + objectif).",
      "Indique ce que tu as deja teste.",
      "Ajoute captures ou erreurs exactes si necessaire.",
    ],
  },
  recrutements: {
    label: "Candidature staff",
    color: 0x2ecc71,
    image: process.env.TICKET_IMAGE_COMMON || "https://i.imgur.com/ZoOiFus.png",
    intro:
      "Ce ticket est dedie aux candidatures staff et aux demandes de role equipe.",
    checklist: [
      "Precis ton experience (Discord, moderation, organisation).",
      "Indique tes disponibilites (jours/heures).",
      "Redige une motivation courte et concrete.",
    ],
  },
  plainte: {
    label: "Signalement / plainte",
    color: 0xe67e22,
    image: process.env.TICKET_IMAGE_COMMON || "https://i.imgur.com/ZoOiFus.png",
    intro:
      "Ce ticket sert a signaler un probleme, un comportement ou un litige necessitant verification.",
    checklist: [
      "Donne les faits avec date et heure approximatives.",
      "Ajoute les identifiants utiles (pseudo, ID, salon).",
      "Joins des preuves (captures, liens, messages).",
    ],
  },
  bug: {
    label: "Signalement de bug",
    color: 0xe74c3c,
    image: process.env.TICKET_IMAGE_COMMON || "https://i.imgur.com/ZoOiFus.png",
    intro:
      "Ce ticket sert au signalement technique (bug, comportement anormal, erreur fonctionnelle).",
    checklist: [
      "Decris les etapes pour reproduire le bug.",
      "Precise ce qui etait attendu et ce qui se passe reellement.",
      "Ajoute logs/captures/messages d'erreur si disponibles.",
    ],
  },
  autres: {
    label: "Autre demande",
    color: 0x9b59b6,
    image: process.env.TICKET_IMAGE_COMMON || "https://i.imgur.com/ZoOiFus.png",
    intro:
      "Ce ticket couvre les demandes diverses qui ne rentrent pas dans les categories precedentes.",
    checklist: [
      "Resume ta demande en une phrase.",
      "Ajoute les details importants pour un traitement rapide.",
      "Indique clairement le resultat attendu.",
    ],
  },
};

function resolveTicketTypeContent(ticketType) {
  return TICKET_TYPE_CONTENT[ticketType] || TICKET_TYPE_CONTENT.autres;
}

const TICKET_MODAL_CONFIG = {
  questions: {
    subjectLabel: "Ta question (objet)",
    contextLabel: "Contexte",
    detailsLabel: "Details utiles",
    priorityDefault: "Normale",
  },
  recrutements: {
    subjectLabel: "Poste vise",
    contextLabel: "Experience / disponibilites",
    detailsLabel: "Motivation",
    priorityDefault: "Normale",
  },
  plainte: {
    subjectLabel: "Objet du signalement",
    contextLabel: "Faits (qui, quand, ou)",
    detailsLabel: "Preuves / details",
    priorityDefault: "Haute",
  },
  bug: {
    subjectLabel: "Nom du bug",
    contextLabel: "Etapes de reproduction",
    detailsLabel: "Resultat attendu vs observe",
    priorityDefault: "Haute",
  },
  autres: {
    subjectLabel: "Objet de la demande",
    contextLabel: "Contexte",
    detailsLabel: "Details complementaires",
    priorityDefault: "Normale",
  },
};

function resolveTicketModalConfig(ticketType) {
  return TICKET_MODAL_CONFIG[ticketType] || TICKET_MODAL_CONFIG.autres;
}

function clampText(value, max = 900) {
  const clean = String(value || "").trim();
  if (!clean) return "Non renseigne.";
  return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
}

function formatTicketCode(ticketNumber) {
  const raw = String(ticketNumber || "").replace(/\D/g, "");
  const six = raw.slice(-6).padStart(6, "0");
  return `TK-${six}`;
}

function resolveTicketLogStyle(ticketType, event) {
  const type = String(ticketType || "autres").toLowerCase();
  const eventName = String(event || "ticket_event").toLowerCase();

  const typeMap = {
    questions: { color: 0x3498db, icon: "magnifying_glass_112" },
    recrutements: { color: 0x2ecc71, icon: "briefcase~1" },
    plainte: { color: 0xe67e22, icon: "police" },
    bug: { color: 0xe74c3c, icon: "kb_edit" },
    autres: { color: 0x9b59b6, icon: "sweat~1" },
  };

  const eventMap = {
    ticket_created: "Ticket cree",
    ticket_claimed: "Ticket pris en charge",
    ticket_unclaimed: "Prise en charge retiree",
    ticket_transcript: "Transcript genere",
    ticket_toggle_dm: "Miroir MP modifie",
    ticket_closed: "Ticket ferme",
  };

  const base = typeMap[type] || typeMap.autres;
  return {
    color: base.color,
    iconKey: base.icon,
    eventLabel: eventMap[eventName] || "Evenement ticket",
  };
}

function buildTicketOpenModal(ticketType) {
  const cfg = resolveTicketModalConfig(ticketType);
  const modal = new ModalBuilder()
    .setCustomId(`ticket_open_modal_${ticketType}`)
    .setTitle(`Nouveau ticket - ${resolveTicketTypeContent(ticketType).label}`);

  const subject = new TextInputBuilder()
    .setCustomId("tk_subject")
    .setLabel(cfg.subjectLabel)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(100)
    .setPlaceholder("Ex: Probleme de role apres synchronisation");

  const context = new TextInputBuilder()
    .setCustomId("tk_context")
    .setLabel(cfg.contextLabel)
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500)
    .setPlaceholder("Explique le contexte principal.");

  const details = new TextInputBuilder()
    .setCustomId("tk_details")
    .setLabel(cfg.detailsLabel)
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(900)
    .setPlaceholder("Ajoute les informations utiles (liens, IDs, captures).");

  modal.addComponents(
    new ActionRowBuilder().addComponents(subject),
    new ActionRowBuilder().addComponents(context),
    new ActionRowBuilder().addComponents(details),
  );
  return modal;
}

function buildTicketWelcomeEmbeds(client, interaction, ticketType, ticketNumber, requestData) {
  const typeContent = resolveTicketTypeContent(ticketType);
  const modalCfg = resolveTicketModalConfig(ticketType);
  const mascot = client.emoji("constructor", "\u{1F477}");
  const ts = Math.floor(Date.now() / 1000);
  const checklistText = typeContent.checklist.map((line, idx) => `${idx + 1}. ${line}`).join("\n");
  const subject = clampText(requestData?.subject, 100);
  const context = clampText(requestData?.context, 700);
  const details = clampText(requestData?.details, 900);
  const priority = clampText(requestData?.priority || modalCfg.priorityDefault, 32);

  const mainEmbed = new EmbedBuilder()
    .setColor(typeContent.color)
    .setTitle(`${mascot} Ticket #${ticketNumber} - ${typeContent.label}`)
    .setDescription(
      `Bienvenue ${interaction.user},\n\n` +
        `${typeContent.intro}\n\n` +
        `Pour accelerer le traitement, envoie un message clair en suivant le format ci-dessous.\n` +
        `Heure d'ouverture: <t:${ts}:F>`,
    )
    .addFields(
      {
        name: "Format recommande",
        value:
          "**Objet:**\n" +
          "**Contexte:**\n" +
          "**Impact:**\n" +
          "**Details/Pieces jointes:**",
      },
      {
        name: "Checklist avant envoi",
        value: checklistText,
      },
      {
        name: "Resume de la demande",
        value:
          `**Objet:** ${subject}\n` +
          `**Priorite:** ${priority}\n` +
          `**Type:** ${typeContent.label}`,
      },
      {
        name: "Contexte fourni",
        value: context,
      },
      {
        name: "Informations complementaires",
        value: details,
      },
    )
    .setImage(typeContent.image)
    .setFooter({ text: `${interaction.guild?.name || "Serveur"} | Support Ticket` })
    .setTimestamp();

  const guideEmbed = new EmbedBuilder()
    .setColor(typeContent.color)
    .setTitle("Procedure de traitement")
    .setDescription(
      "1. Un membre du staff prend en charge le ticket.\n" +
        "2. Une analyse rapide est faite sur les informations fournies.\n" +
        "3. Des questions complementaires peuvent etre demandees.\n" +
        "4. Une reponse claire est apportee, puis le ticket est cloture.\n\n" +
        "Merci de rester precis et courtois pour un traitement optimal.",
    );

  if (process.env.TICKET_IMAGE_CREATED) {
    guideEmbed.setImage(process.env.TICKET_IMAGE_CREATED);
  }

  return [mainEmbed, guideEmbed];
}

async function ensureTicketLogTable(client) {
  if (client.__ticketLogTableReady) return true;
  const db = (await ensureDatabaseConnection(client)) || getDatabase();
  if (!db) return false;
  try {
    const has = await db.schema.hasTable("ticket_logs");
    if (!has) {
      await db.schema.createTable("ticket_logs", (table) => {
        table.increments("id").primary();
        table.string("guild_id", 20).notNullable().index();
        table.string("channel_id", 20).notNullable().index();
        table.string("ticket_number", 20).nullable().index();
        table.string("ticket_type", 32).nullable();
        table.string("event", 40).notNullable().index();
        table.string("actor_id", 20).nullable().index();
        table.string("owner_id", 20).nullable().index();
        table.text("details").nullable();
        table.timestamp("created_at").defaultTo(db.fn.now());
      });
    }
    client.__ticketLogTableReady = true;
    return true;
  } catch (error) {
    client.getLogger()?.send(`Ticket logs table error: ${error.message}`, "WARN");
    return false;
  }
}

async function logTicketEvent(client, guild, payload) {
  const {
    event,
    channelId,
    ticketNumber = null,
    ticketType = null,
    actorId = null,
    ownerId = null,
    details = "",
  } = payload || {};
  const style = resolveTicketLogStyle(ticketType, event);
  const ticketCode = ticketNumber ? formatTicketCode(ticketNumber) : "N/A";

  const channelLogId = process.env.TICKET_LOG_CHANNEL_ID;
  if (channelLogId && guild?.channels?.fetch) {
    const logChannel = await guild.channels.fetch(channelLogId).catch(() => null);
    if (logChannel?.isTextBased?.()) {
      const icon = client?.emoji?.(style.iconKey, "\u{1F4CC}") || "\u{1F4CC}";
      const embed = new EmbedBuilder()
        .setColor(style.color)
        .setTitle(`${icon} ${style.eventLabel}`)
        .addFields(
          { name: "Event", value: String(event || "unknown"), inline: true },
          { name: "Type", value: String(ticketType || "n/a"), inline: true },
          { name: "Ticket", value: ticketCode, inline: true },
          { name: "Channel", value: channelId ? `<#${channelId}>` : "n/a", inline: true },
          { name: "Owner", value: ownerId ? `<@${ownerId}>` : "n/a", inline: true },
          { name: "Actor", value: actorId ? `<@${actorId}>` : "n/a", inline: true },
          { name: "Details", value: clampText(details, 1000), inline: false },
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  const hasTable = await ensureTicketLogTable(client);
  if (!hasTable) return;
  const db = (await ensureDatabaseConnection(client)) || getDatabase();
  if (!db) return;
  await db("ticket_logs")
    .insert({
      guild_id: guild?.id || null,
      channel_id: channelId || null,
      ticket_number: ticketCode,
      ticket_type: ticketType,
      event: String(event || "unknown"),
      actor_id: actorId,
      owner_id: ownerId,
      details: clampText(details, 2000),
    })
    .catch(() => {});
}

async function ensureTicketLogThread(client, guild, ticketChannel, ticketNumber, ticketType, ownerUser) {
  const logChannelId = process.env.TICKET_LOG_CHANNEL_ID;
  if (!logChannelId || !guild?.channels?.fetch) return null;

  const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
  if (!logChannel?.isTextBased?.()) return null;

  const fromTopic = parseTicketLogThreadId(ticketChannel);
  if (fromTopic && logChannel.threads?.fetch) {
    const existingThread = await logChannel.threads.fetch(fromTopic).catch(() => null);
    if (existingThread) return existingThread;
  }

  const code = formatTicketCode(ticketNumber);
  const typeContent = resolveTicketTypeContent(ticketType);
  const startEmbed = new EmbedBuilder()
    .setColor(typeContent.color)
    .setTitle(`Journal ${code}`)
    .setDescription(
      `Nouveau ticket: ${ticketChannel}\n` +
        `Type: **${typeContent.label}**\n` +
        `Auteur: ${ownerUser}\n` +
        `Lien: ${ticketChannel.url || "N/A"}`,
    )
    .setTimestamp();

  const starter = await logChannel.send({ embeds: [startEmbed] }).catch(() => null);
  if (!starter?.startThread) return null;

  const thread = await starter
    .startThread({
      name: `log-${ticketChannel.name}`.slice(0, 100),
      autoArchiveDuration: 1440,
      reason: `Journal ticket ${code}`,
    })
    .catch(() => null);
  if (!thread) return null;

  await updateTicketTopicField(ticketChannel, "LogThread", thread.id);
  return thread;
}

async function handleTicketTypeSelect(client, interaction) {
  const ticketType = interaction.values?.[0] || "autres";
  if (ticketType === "recrutements") {
    const modal = buildTicketOpenModal(ticketType);
    return interaction.showModal(modal);
  }
  return createTicket(client, interaction, ticketType, null);
}

async function handleTicketButton(client, interaction) {
  return createTicket(client, interaction, "autres", null);
}

async function handleTicketOpenModal(client, interaction) {
  const ticketType = String(interaction.customId || "").replace("ticket_open_modal_", "") || "autres";
  const subject = interaction.fields.getTextInputValue("tk_subject");
  const context = interaction.fields.getTextInputValue("tk_context");
  const details = interaction.fields.getTextInputValue("tk_details");
  const requestData = {
    subject,
    context,
    details,
    priority: resolveTicketModalConfig(ticketType).priorityDefault,
  };
  return createTicket(client, interaction, ticketType, requestData);
}

async function createTicket(client, interaction, ticketType, requestData = null) {
  const ticketCategoryId = process.env.TICKET_CATEGORY_ID;
  if (!ticketCategoryId) {
    return interaction.reply({
      content: "La categorie de tickets n'est pas configuree.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guild = interaction.guild;
    const category = await guild.channels.fetch(ticketCategoryId).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return interaction.editReply("Categorie de tickets introuvable.");
    }

    const existingTicket = guild.channels.cache.find(
      (ch) =>
        ch.parentId === ticketCategoryId &&
        ch.topic?.includes(`User: ${interaction.user.id}`) &&
        !ch.name.includes("closed"),
    );
    if (existingTicket) {
      return interaction.editReply(`Tu as deja un ticket ouvert: ${existingTicket}`);
    }

    const ticketNumber = Date.now().toString().slice(-6);
    const shortSubject = clampText(requestData?.subject || ticketType, 24)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const channelSuffix = shortSubject || ticketType;
    const staffRoleId = process.env.TICKET_STAFF_ROLE_ID || null;
    const permissionOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages,
        ],
      },
    ];
    if (staffRoleId) {
      permissionOverwrites.push({
        id: staffRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      });
    }

    const channel = await guild.channels.create({
      name: `ticket-${ticketType}-${channelSuffix}-${ticketNumber}`.slice(0, 100),
      type: ChannelType.GuildText,
      parent: category,
      topic:
        `User: ${interaction.user.id} | Type: ${ticketType} | Created: ${new Date().toLocaleString("fr-FR")} | ` +
        `Priority: ${clampText(requestData?.priority || "Normale", 24)} | Subject: ${clampText(requestData?.subject, 80)} | ` +
        "ClaimedBy: none | DmMirror: on | LogThread: none",
      permissionOverwrites,
    });

    const embeds = buildTicketWelcomeEmbeds(client, interaction, ticketType, ticketNumber, requestData);
    const staffRoleMention = process.env.TICKET_STAFF_ROLE_ID
      ? `<@&${process.env.TICKET_STAFF_ROLE_ID}>`
      : "Staff";

    await channel
      .send({
        content: `${interaction.user} ${staffRoleMention}`,
        embeds,
        components: buildTicketActionRows(client),
      })
      .catch(() => null);

    const logThread = await ensureTicketLogThread(
      client,
      guild,
      channel,
      ticketNumber,
      ticketType,
      interaction.user,
    );

    await logTicketEvent(client, guild, {
      event: "ticket_created",
      channelId: channel.id,
      ticketNumber,
      ticketType,
      actorId: interaction.user.id,
      ownerId: interaction.user.id,
      details:
        `Sujet: ${clampText(requestData?.subject || ticketType, 120)} | ` +
        `Thread log: ${logThread ? `<#${logThread.id}>` : "non cree"}`,
    });

    return interaction.editReply(`Ticket cree: ${channel}`);
  } catch (error) {
    client.getLogger()?.send(`Erreur creation ticket: ${error.message}`, "ERROR");
    return interaction.editReply("Erreur lors de la creation du ticket.");
  }
}

async function handleCloseTicket(client, interaction) {
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.reply({
      content: "Cette action doit etre utilisee dans un ticket texte.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const ownerId = parseTicketOwnerId(channel);
  const canClose = isTicketStaff(interaction.member) || interaction.user.id === ownerId;
  if (!canClose) {
    return interaction.reply({
      content: "Tu n'as pas la permission de fermer ce ticket.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    await channel.setName(`${channel.name}-closed`.slice(0, 100));
    await updateTicketTopicField(channel, "Status", "closed");
    if (interaction.message?.edit) {
      await interaction.message.edit({ components: [] }).catch(() => {});
    }

    const staffRoleId = process.env.TICKET_STAFF_ROLE_ID;
    if (staffRoleId) {
      await channel.permissionOverwrites.edit(staffRoleId, {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true,
      }).catch(() => {});
    }
    if (ownerId) {
      await channel.permissionOverwrites.edit(ownerId, {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true,
      }).catch(() => {});
    }

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("Ticket ferme")
          .setDescription(`Ce ticket a ete ferme par ${interaction.user}.`)
          .setTimestamp(),
      ],
    });

    await logTicketEvent(client, interaction.guild, {
      event: "ticket_closed",
      channelId: channel.id,
      ticketType: parseTicketType(channel),
      actorId: interaction.user.id,
      ownerId,
      details: `Fermeture manuelle par ${interaction.user.tag || interaction.user.id}`,
    });

    return interaction.editReply("Ticket ferme (archive conservee, non supprimee).");
  } catch (error) {
    client.getLogger()?.send(`Erreur fermeture ticket: ${error.message}`, "ERROR");
    return interaction.editReply("Erreur lors de la fermeture du ticket.");
  }
}

async function handleTranscriptTicket(client, interaction) {
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.reply({
      content: "Cette action doit etre utilisee dans un ticket texte.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const ownerId = parseTicketOwnerId(channel);
  const isStaff = interaction.member?.permissions?.has(PermissionFlagsBits.ManageMessages);
  const isOwner = interaction.user.id === ownerId;
  if (!isStaff && !isOwner) {
    return interaction.reply({
      content: "Tu n'as pas la permission de generer le transcript.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const transcriptText = await buildChannelTranscript(channel);
    const file = new AttachmentBuilder(Buffer.from(transcriptText, "utf8"), {
      name: `transcript-${channel.name}-${Date.now()}.txt`,
    });
    await logTicketEvent(client, interaction.guild, {
      event: "ticket_transcript",
      channelId: channel.id,
      ticketType: parseTicketType(channel),
      actorId: interaction.user.id,
      ownerId,
      details: "Transcript genere.",
    });
    return interaction.editReply({ content: "Transcript genere.", files: [file] });
  } catch (error) {
    client.getLogger()?.send(`Erreur transcript ticket: ${error.message}`, "ERROR");
    return interaction.editReply("Erreur lors de la generation du transcript.");
  }
}

async function buildChannelTranscript(channel) {
  let lastId;
  let page = 0;
  const maxPages = 10;
  const all = [];

  while (page < maxPages) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const batch = await channel.messages.fetch(options);
    if (!batch || batch.size === 0) break;
    all.push(...batch.values());
    lastId = batch.last().id;
    page++;
  }

  const sorted = all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = [];
  lines.push(`Transcript du salon: #${channel.name}`);
  lines.push(`Salon ID: ${channel.id}`);
  lines.push(`Genere le: ${new Date().toISOString()}`);
  lines.push("=".repeat(64));

  for (const msg of sorted) {
    const when = new Date(msg.createdTimestamp).toISOString();
    const author = msg.author?.tag || msg.author?.username || "Unknown";
    const content = (msg.content || "").replace(/\r?\n/g, " ");
    let line = `[${when}] ${author}: ${content}`;
    if (msg.attachments?.size > 0) {
      const files = [...msg.attachments.values()].map((a) => a.url).join(", ");
      line += ` | Attachments: ${files}`;
    }
    lines.push(line);
  }

  if (sorted.length === 0) lines.push("Aucun message dans ce ticket.");
  return lines.join("\n");
}

function parseTicketOwnerId(channel) {
  const topic = channel?.topic || "";
  const match = topic.match(/User:\s*(\d{16,20})/i);
  return match ? match[1] : null;
}

function parseTicketClaimedBy(channel) {
  const topic = channel?.topic || "";
  const match = topic.match(/ClaimedBy:\s*([0-9]{16,20}|none)/i);
  return match ? match[1] : "none";
}

function parseTicketType(channel) {
  const topic = channel?.topic || "";
  const match = topic.match(/Type:\s*([a-z_]+)/i);
  return match ? match[1].toLowerCase() : "autres";
}

function parseTopicFieldValue(topic, field) {
  const re = new RegExp(`${field}:\\s*([^|]+)`, "i");
  const match = String(topic || "").match(re);
  return match ? match[1].trim() : null;
}

function parseTicketLogThreadId(channel) {
  const value = parseTopicFieldValue(channel?.topic || "", "LogThread");
  if (!value || value.toLowerCase() === "none") return null;
  return /^\d{16,20}$/.test(value) ? value : null;
}

function parseTicketDmMirror(channel) {
  const topic = channel?.topic || "";
  const match = topic.match(/DmMirror:\s*(on|off)/i);
  if (!match) return true;
  return match[1].toLowerCase() === "on";
}

function isTicketStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.ManageMessages)) return true;
  const staffRoleId = process.env.TICKET_STAFF_ROLE_ID;
  if (!staffRoleId) return false;
  return Boolean(member.roles?.cache?.has(staffRoleId));
}

async function updateTicketTopicField(channel, field, value) {
  let topic = channel.topic || "";
  const pattern = new RegExp(`${field}:\\s*[^|]+`, "i");
  if (pattern.test(topic)) {
    topic = topic.replace(pattern, `${field}: ${value}`);
  } else {
    topic = `${topic} | ${field}: ${value}`;
  }
  return channel.setTopic(topic.slice(0, 1024)).catch(() => null);
}

function buildTicketActionRows(client) {
  const claimEmoji = client.emoji("kb_add", "\u{2705}");
  const unclaimEmoji = client.emoji("kb_no", "\u{274C}");
  const addEmoji = client.emoji("kb_add", "\u2795");
  const removeEmoji = client.emoji("kb_no", "\u2796");
  const transcriptEmoji = client.emoji("kb_edit", "\u{1F4C4}");
  const toggleEmoji = client.emoji("pointred", "\u{1F6A8}");
  const closeEmoji = client.emoji("purge", "\u{1F512}");

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Prendre en charge")
      .setEmoji(claimEmoji)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticket_unclaim")
      .setLabel("Retirer la prise")
      .setEmoji(unclaimEmoji)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket_add_user")
      .setLabel("Ajouter personne")
      .setEmoji(addEmoji)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticket_remove_user")
      .setLabel("Retirer personne")
      .setEmoji(removeEmoji)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket_transcript")
      .setLabel("Transcript")
      .setEmoji(transcriptEmoji)
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_toggle_dm")
      .setLabel("Activer / desactiver MP")
      .setEmoji(toggleEmoji)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Fermer le ticket")
      .setEmoji(closeEmoji)
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2];
}

async function handleClaimTicket(interaction) {
  if (!isTicketStaff(interaction.member)) {
    return interaction.reply({ content: "Seul le staff peut prendre un ticket.", flags: MessageFlags.Ephemeral });
  }

  const current = parseTicketClaimedBy(interaction.channel);
  if (current !== "none" && current !== interaction.user.id) {
    return interaction.reply({
      content: "Ce ticket est deja pris par un autre membre du staff.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await updateTicketTopicField(interaction.channel, "ClaimedBy", interaction.user.id);
  await logTicketEvent(interaction.client, interaction.guild, {
    event: "ticket_claimed",
    channelId: interaction.channel.id,
    ticketType: parseTicketType(interaction.channel),
    actorId: interaction.user.id,
    ownerId: parseTicketOwnerId(interaction.channel),
    details: "Ticket pris en charge par un membre du staff.",
  });
  return interaction.reply({ content: "Ticket pris en charge.", flags: MessageFlags.Ephemeral });
}

async function handleUnclaimTicket(interaction) {
  if (!isTicketStaff(interaction.member)) {
    return interaction.reply({
      content: "Seul le staff peut retirer la prise en charge.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await updateTicketTopicField(interaction.channel, "ClaimedBy", "none");
  await logTicketEvent(interaction.client, interaction.guild, {
    event: "ticket_unclaimed",
    channelId: interaction.channel.id,
    ticketType: parseTicketType(interaction.channel),
    actorId: interaction.user.id,
    ownerId: parseTicketOwnerId(interaction.channel),
    details: "Prise en charge retiree.",
  });
  return interaction.reply({ content: "Prise en charge retiree.", flags: MessageFlags.Ephemeral });
}

async function showTicketUserModal(interaction, mode) {
  if (!isTicketStaff(interaction.member)) {
    return interaction.reply({
      content: "Seul le staff peut modifier les acces du ticket.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(mode === "add" ? "ticket_user_add_modal" : "ticket_user_remove_modal")
    .setTitle(mode === "add" ? "Ajouter une personne" : "Retirer une personne");

  const input = new TextInputBuilder()
    .setCustomId("ticket_user_id_input")
    .setLabel("ID ou mention de la personne")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("123456789012345678 ou @user");

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function handleTicketUserModal(interaction, mode) {
  if (!isTicketStaff(interaction.member)) {
    return interaction.reply({
      content: "Seul le staff peut modifier les acces du ticket.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const raw = interaction.fields.getTextInputValue("ticket_user_id_input");
  const match = String(raw || "").match(/\d{16,20}/);
  if (!match) {
    return interaction.reply({ content: "ID invalide.", flags: MessageFlags.Ephemeral });
  }

  const userId = match[0];
  if (mode === "add") {
    await interaction.channel.permissionOverwrites.create(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    }).catch(() => {});
    return interaction.reply({
      content: `<@${userId}> a ete ajoute au ticket.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.channel.permissionOverwrites.delete(userId).catch(() => {});
  return interaction.reply({
    content: `<@${userId}> a ete retire du ticket.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleToggleTicketDm(interaction) {
  if (!isTicketStaff(interaction.member)) {
    return interaction.reply({
      content: "Seul le staff peut changer ce reglage.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const enabled = parseTicketDmMirror(interaction.channel);
  await updateTicketTopicField(interaction.channel, "DmMirror", enabled ? "off" : "on");
  await logTicketEvent(interaction.client, interaction.guild, {
    event: "ticket_toggle_dm",
    channelId: interaction.channel.id,
    ticketType: parseTicketType(interaction.channel),
    actorId: interaction.user.id,
    ownerId: parseTicketOwnerId(interaction.channel),
    details: enabled ? "Miroir MP desactive." : "Miroir MP active.",
  });
  return interaction.reply({
    content: enabled ? "Envoi MP desactive." : "Envoi MP active.",
    flags: MessageFlags.Ephemeral,
  });
}


module.exports = {
  handleTicketTypeSelect,
  handleTicketButton,
  handleTicketOpenModal,
  handleCloseTicket,
  handleTranscriptTicket,
  handleClaimTicket,
  handleUnclaimTicket,
  showTicketUserModal,
  handleTicketUserModal,
  handleToggleTicketDm
};

