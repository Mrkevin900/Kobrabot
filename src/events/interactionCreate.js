const {
  MessageFlags,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const {
  getDatabase,
  ensureDatabaseConnection,
  describeDbError,
} = require("../database/database");
const { getPanel, upsertPanel } = require("../utils/vocalPanels");
const {
  buildInteractionContext,
  formatDuration,
  serializeError,
} = require("../utils/CommandUtils");
const { handleSuggestionVote } = require("../utils/suggestions");
const {
  SECURITY_FEATURES,
  isFeatureEnabled,
  setFeatureStatus,
} = require("../utils/SecurityUtils");

const TicketManager = require("../interactions/TicketManager");
const VocalManager = require("../interactions/VocalManager");
const CacheManager = require("../utils/CacheManager");

const commandRateLimits = new CacheManager(3000);

const parsedSlowThresholdMs = Number(process.env.COMMAND_SLOW_THRESHOLD_MS);
const COMMAND_SLOW_THRESHOLD_MS = Number.isFinite(parsedSlowThresholdMs)
  ? parsedSlowThresholdMs
  : 2500;

const interactionCreate = {
  async executeHandler(client, interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        return await handleSlashCommand(client, interaction);
      }

      if (interaction.isStringSelectMenu()) {
        return await handleSelectMenu(client, interaction);
      }

      if (interaction.isUserSelectMenu()) {
        if (interaction.customId?.startsWith("vocal_pick_")) {
          return await VocalManager.handleVocalUserSelectMenu(client, interaction);
        }
      }

      if (interaction.isButton()) {
        return await handleButton(client, interaction);
      }

      if (interaction.isModalSubmit()) {
        return await handleModal(client, interaction);
      }
    } catch (error) {
      logInteractionError(client, "Erreur globale interactionCreate", error, {
        interactionType: interaction?.type,
        customId: interaction?.customId || null,
        commandName: interaction?.commandName || null,
        userId: interaction?.user?.id || null,
        guildId: interaction?.guildId || null,
      });
    }
  },

  settings: {
    enabled: true,
  },
};

function resolveCommand(client, commandName) {
  return client.getCommand?.(commandName) || client.getCommands().find((cmd) => cmd?.data?.name === commandName);
}

function buildComponentContext(interaction, extra = {}) {
  return {
    customId: interaction?.customId || "unknown",
    guild: interaction?.guild?.name || "DM",
    guildId: interaction?.guildId || "DM",
    channel: interaction?.channel?.name || interaction?.channelId || "unknown",
    channelId: interaction?.channelId || "unknown",
    user: interaction?.user?.tag || interaction?.user?.username || "unknown",
    userId: interaction?.user?.id || "unknown",
    ...extra,
  };
}

function recordCommandExecution(client, commandName, execution) {
  client.recordCommandExecution?.(commandName, {
    ...execution,
    slowThresholdMs: COMMAND_SLOW_THRESHOLD_MS,
  });
}

function logInteractionError(client, message, error, context = {}) {
  const details = serializeError(error);
  client.getLogger()?.send(`${message}: ${details.message}`, "ERROR", context);
  if (details.stack) {
    client.getLogger()?.send(details.stack, "DEBUG", context);
  }
}

async function replyInteractionError(interaction, content) {
  const errorResponse = {
    content,
    flags: MessageFlags.Ephemeral,
  };

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(errorResponse).catch(() => {});
  } else {
    await interaction.reply(errorResponse).catch(() => {});
  }
}

async function handleSlashCommand(client, interaction) {
  const commandName = interaction.commandName;
  const command = resolveCommand(client, commandName);
  const startedAt = Date.now();

  const rateLimitKey = `${interaction.user.id}:${commandName}`;
  if (commandRateLimits.has(rateLimitKey)) {
    return replyInteractionError(
      interaction,
      "⏱️ Vous allez trop vite ! Veuillez patienter quelques secondes avant de réutiliser cette commande."
    );
  }
  commandRateLimits.set(rateLimitKey, true, 3000); // 3 secondes de cooldown

  if (!command) {
    const missingContext = buildInteractionContext(interaction, {
      type: "slash",
      source: "registry",
    });
    client.getLogger()?.send(`Commande introuvable: /${commandName}`, "WARN", missingContext);
    await replyInteractionError(
      interaction,
      "Cette commande n'est plus disponible. Reessaie dans quelques secondes.",
    );
    return;
  }

  const context = buildInteractionContext(interaction, {
    type: "slash",
    module: command.__meta?.moduleName || command.settings?.module || "unknown",
    source: command.__meta?.source || "unknown",
  });

  client.getLogger()?.send(`Execution de /${context.route}`, "CMD", context);

  try {
    await command.executeCommand(client, interaction);
    const durationMs = Date.now() - startedAt;
    const level = durationMs >= COMMAND_SLOW_THRESHOLD_MS ? "WARN" : "CMD";
    recordCommandExecution(client, commandName, {
      success: true,
      durationMs,
      actorId: interaction.user?.id,
      type: "slash",
    });
    
    if (client.loggerManager) {
      await client.loggerManager.logCommand(interaction).catch(() => null);
    }
    
    client
      .getLogger()
      ?.send(`Commande terminee: /${context.route} en ${formatDuration(durationMs)}`, level, {
        ...context,
        durationMs,
      });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    recordCommandExecution(client, commandName, {
      success: false,
      durationMs,
      actorId: interaction.user?.id,
      type: "slash",
    });
    
    logInteractionError(client, `Erreur commande /${commandName}`, error, {
      ...context,
      durationMs,
    });

    // Empecher le bot de crasher si l'interaction est expiree
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Une erreur est survenue lors de l'exécution de cette commande.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      } else {
        await interaction.followUp({
          content: "❌ Une erreur est survenue lors du traitement final de la commande.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    } catch (e) {
      // Ignorer l'erreur de reponse si l'interaction est deja fermee
    }
  }
}

function getRuntimeStore(client) {
  if (!client.cache) {
    const CacheManager = require("../utils/CacheManager");
    client.cache = new CacheManager();
  }
  return client.cache;
}

async function handleSelectMenu(client, interaction) {
  const customId = interaction.customId || "";

  if (customId === "ticket_type_select") {
    return TicketManager.handleTicketTypeSelect(client, interaction);
  }

  if (customId === "level_cmd_panel_select") {
    return handleLevelCmdPanelSelect(client, interaction);
  }

  if (customId.startsWith("vocal_lists_") || customId.startsWith("vocal_manage_")) {
    return VocalManager.handleVocalSelectMenu(client, interaction);
  }
}

function buildLevelCommandDetailEmbed(client, selected) {
  const mascot = client.emoji("kbrp_emojis", "\u{1F497}");
  const embed = new EmbedBuilder().setColor(0x5865f2).setTimestamp();

  if (selected === "leveladmin") {
    return embed
      .setTitle(`${mascot} /leveladmin`)
      .setDescription(
        "Administration des niveaux et boosts XP.\n\n" +
          "Sous-commandes:\n" +
          "- `/leveladmin give_x2 utilisateur:<membre> minutes:<1-43200> multiplicateur:<1-10?>`\n" +
          "- `/leveladmin set_level utilisateur:<membre> niveau:<1-1000>`\n" +
          "- `/leveladmin add_levels utilisateur:<membre> niveaux:<1-1000>`\n" +
          "- `/leveladmin give_points utilisateur:<membre> points:<1-1000000>`",
      );
  }

  if (selected === "levelpanel") {
    return embed
      .setTitle(`${mascot} /levelpanel`)
      .setDescription(
        "Configuration du systeme de niveaux.\n\n" +
          "Sous-commandes:\n" +
          "- `/levelpanel voir`\n" +
          "- `/levelpanel cmd_panel`\n" +
          "- `/levelpanel boutique active:<true|false>`\n" +
          "- `/levelpanel recompense_niveau points:<0-1000>`\n" +
          "- `/levelpanel prix_x2 points:<1-1000000>`\n" +
          "- `/levelpanel duree_x2 minutes:<1-43200>`",
      );
  }

  if (selected === "resetlevel") {
    return embed
      .setTitle(`${mascot} /resetlevel`)
      .setDescription(
        "Reset des niveaux (proprietaire du serveur uniquement).\n\n" +
          "Exemples:\n" +
          "- `/resetlevel utilisateur:<membre>`\n" +
          "- `/resetlevel tout:true`\n\n" +
          "Tu dois choisir soit `utilisateur`, soit `tout:true`.",
      );
  }

  return embed
    .setTitle(`${mascot} Commande inconnue`)
    .setDescription("Selection invalide.");
}

async function handleLevelCmdPanelSelect(client, interaction) {
  const selected = interaction.values?.[0] || "";
  const embed = buildLevelCommandDetailEmbed(client, selected);
  return interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleButton(client, interaction) {
  if (interaction.customId === "suggest_upvote") {
    return handleSuggestionVote(client, interaction, "up");
  }
  if (interaction.customId === "suggest_downvote") {
    return handleSuggestionVote(client, interaction, "down");
  }
  if (interaction.customId.startsWith("vocalbtn_")) return VocalManager.handleVocalButton(client, interaction);
  if (interaction.customId === "create_ticket") return TicketManager.handleTicketButton(client, interaction);
  if (interaction.customId === "close_ticket") return TicketManager.handleCloseTicket(client, interaction);
  if (interaction.customId === "ticket_transcript") return TicketManager.handleTranscriptTicket(client, interaction);
  if (interaction.customId === "ticket_claim") return TicketManager.handleClaimTicket(interaction);
  if (interaction.customId === "ticket_unclaim") return TicketManager.handleUnclaimTicket(interaction);
  if (interaction.customId === "ticket_add_user") return TicketManager.showTicketUserModal(interaction, "add");
  if (interaction.customId === "ticket_remove_user") return TicketManager.showTicketUserModal(interaction, "remove");
  if (interaction.customId === "ticket_toggle_dm") return TicketManager.handleToggleTicketDm(interaction);
  if (interaction.customId === "sync_button") return handleSyncButton(client, interaction);
  if (interaction.customId.startsWith("security_toggle_")) return handleSecurityToggle(client, interaction);
  if (
      interaction.customId === "approve_access" || 
      interaction.customId === "deny_access" ||
      ["page_prev", "page_next", "cat_admin", "cat_metier"].includes(interaction.customId)
  ) return; // Handled by local collector

  const interactionData = interaction.customId.split(".");
  const commandName = interactionData[0];
  const buttonId = interactionData[1];
  const command = resolveCommand(client, commandName);
  if (!command?.execButtons) {
    client.getLogger()?.send("Bouton sans handler de commande", "DEBUG", buildComponentContext(interaction));
    await replyInteractionError(interaction, "Ce bouton n'est plus disponible. Relance la commande.");
    return;
  }

  const startedAt = Date.now();
  const context = buildComponentContext(interaction, {
    type: "button",
    route: commandName,
    buttonId: buttonId || "unknown",
    module: command.__meta?.moduleName || command.settings?.module || "unknown",
    source: command.__meta?.source || "unknown",
  });

  client.getLogger()?.send(`Execution bouton ${commandName}/${buttonId}`, "CMD", context);

  try {
    await command.execButtons(client, interaction, buttonId);
    const durationMs = Date.now() - startedAt;
    client
      .getLogger()
      ?.send(`Bouton termine ${commandName}/${buttonId} en ${formatDuration(durationMs)}`, "CMD", {
        ...context,
        durationMs,
      });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logInteractionError(client, `Erreur bouton ${commandName}/${buttonId}`, error, {
      ...context,
      durationMs,
    });
    await replyInteractionError(interaction, "Erreur lors du traitement du bouton.");
  }
}

async function handleModal(client, interaction) {
  if (interaction.customId.startsWith("name_modal_")) {
    if (client.syncAPI) await client.syncAPI.handleNameModalSubmit(interaction);
    return;
  }

  if (interaction.customId.startsWith("ticket_open_modal_")) {
    return TicketManager.handleTicketOpenModal(client, interaction);
  }

  if (interaction.customId === "ticket_user_add_modal") {
    return TicketManager.handleTicketUserModal(interaction, "add");
  }

  if (interaction.customId === "ticket_user_remove_modal") {
    return TicketManager.handleTicketUserModal(interaction, "remove");
  }
}

async function handleSyncButton(client, interaction) {
  if (!client.syncAPI) {
    return interaction.reply({
      content: "Le systeme de synchronisation n'est pas initialise.",
      flags: MessageFlags.Ephemeral,
    });
  }
  return client.syncAPI.handleSyncButton(interaction);
}

async function handleSecurityToggle(client, interaction) {
  const feature = interaction.customId.replace("security_toggle_", "");
  const guildId = interaction.guildId;

  const def = SECURITY_FEATURES[feature];
  if (!def) return interaction.reply({ content: "Sécurité inconnue.", ephemeral: true });

  const current = isFeatureEnabled(feature, guildId);
  const newStatus = !current;
  setFeatureStatus(feature, guildId, newStatus);

  // Update the button
  const embed = EmbedBuilder.from(interaction.message.embeds[0]);
  const rows = interaction.message.components.map(row => ActionRowBuilder.from(row));

  for (const row of rows) {
    for (const component of row.components) {
      if (component.customId === interaction.customId) {
        const baseLabel = String(component.data?.label || def.label)
          .replace(/\s+(ON|OFF|✅|❌|Activee|Desactivee)$/i, "")
          .trim();
        component.setLabel(`${baseLabel || def.label} ${newStatus ? "ON" : "OFF"}`);
        component.setStyle(newStatus ? ButtonStyle.Primary : ButtonStyle.Secondary);
      }
    }
  }

  await interaction.update({ embeds: [embed], components: rows });
}

module.exports = { default: interactionCreate };


