const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { join } = require("path");
const { version } = require(join(__dirname, "../../../package.json"));

function getModuleLabel(moduleName) {
  const raw = String(moduleName || "autre").toLowerCase();
  if (raw === "admin") return "Admin";
  if (raw === "moderation") return "Moderation";
  if (raw === "info") return "Informations";
  if (raw === "fun") return "Fun";
  if (raw === "fan") return "Fan";
  if (raw === "general") return "General";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function slugifyCategory(label) {
  return String(label || "all")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildCommandLine(command) {
  const name = command?.data?.name || "unknown";
  const description = command?.data?.description || "Aucune description";
  return `\`/${name}\` - ${description}`;
}

function splitFieldLines(lines, maxLen = 1024) {
  const chunks = [];
  let current = "";

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > maxLen) {
      if (current) chunks.push(current);
      current = line.length > maxLen ? `${line.slice(0, maxLen - 3)}...` : line;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function chunkArray(list, size) {
  const chunks = [];
  for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size));
  return chunks;
}

function buildCategoryIndex(commands) {
  const groupedByModule = new Map();
  for (const cmd of commands) {
    const moduleName = getModuleLabel(cmd?.settings?.module);
    const existing = groupedByModule.get(moduleName) || [];
    existing.push(cmd);
    groupedByModule.set(moduleName, existing);
  }

  const sorted = Array.from(groupedByModule.entries()).sort((a, b) => a[0].localeCompare(b[0], "fr"));

  const categories = [{ slug: "all", label: "Tout" }];
  for (const [label] of sorted) categories.push({ slug: slugifyCategory(label), label });

  const slugToLabel = new Map(categories.map((c) => [c.slug, c.label]));
  const labelToCommands = new Map(sorted.map(([label, list]) => [label, list]));

  return { categories, slugToLabel, labelToCommands };
}

function buildFieldList(commands) {
  const groupedByModule = new Map();

  for (const cmd of commands) {
    const moduleName = getModuleLabel(cmd?.settings?.module);
    const existing = groupedByModule.get(moduleName) || [];
    existing.push(buildCommandLine(cmd));
    groupedByModule.set(moduleName, existing);
  }

  const sortedModules = Array.from(groupedByModule.entries()).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  const fields = [];

  for (const [moduleName, lines] of sortedModules) {
    const sortedLines = lines.sort((a, b) => a.localeCompare(b, "fr"));
    const lineChunks = splitFieldLines(sortedLines);
    lineChunks.forEach((chunk, index) => {
      fields.push({
        name: index === 0 ? `Categorie: ${moduleName}` : `Categorie: ${moduleName} (suite)`,
        value: chunk,
        inline: false,
      });
    });
  }

  return fields;
}

function buildHelpEmbed(client, commands, pageIndex, totalPages, pageFields, selectedLabel, selectedSlug) {
  const mascot = client.emoji("kbrp_emojis", "\u{1F497}");

  const embed = new EmbedBuilder()
    .setColor(client.getConfig().embed.readyColor)
    .setTitle(`${mascot} Aide - KobraBot`)
    .setDescription(
      "Liste complete des commandes disponibles.\n" +
        "Tape `/` puis commence a ecrire une commande pour l'utiliser.",
    )
    .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
    .setFooter({
      text: `KobraBot v${version} | ${commands.length} commande(s) | CatSlug ${selectedSlug} | Categorie ${selectedLabel} | Page ${pageIndex + 1}/${totalPages}`,
    })
    .setTimestamp();

  if (pageFields.length === 0) {
    embed.addFields({ name: "Categorie: Aucun module", value: "Aucune commande chargee.", inline: false });
  } else {
    embed.addFields(pageFields);
  }

  return embed;
}

function buildCategoryRows(categories, selectedSlug) {
  const limited = categories.slice(0, 10);
  const groups = chunkArray(limited, 5);

  return groups.map((group) => {
    const row = new ActionRowBuilder();
    for (const category of group) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`help.cat_${category.slug}`)
          .setLabel(category.label)
          .setStyle(category.slug === selectedSlug ? ButtonStyle.Primary : ButtonStyle.Secondary),
      );
    }
    return row;
  });
}

function buildNavRow(client, pageIndex, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("help.prev")
      .setLabel("Precedent")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(client.emoji("blacklist", "◀️"))
      .setDisabled(pageIndex <= 0),
    new ButtonBuilder()
      .setCustomId("help.next")
      .setLabel("Suivant")
      .setStyle(ButtonStyle.Primary)
      .setEmoji(client.emoji("public", "▶️"))
      .setDisabled(pageIndex >= totalPages - 1),
  );
}

function parseCurrentPageFromMessage(interaction) {
  const footerText = interaction?.message?.embeds?.[0]?.footer?.text || "";
  const match = String(footerText).match(/Page\s+(\d+)\/(\d+)/i);
  if (!match) return 0;
  const current = Number(match[1]) - 1;
  return Number.isFinite(current) && current >= 0 ? current : 0;
}

function parseCurrentCategorySlugFromMessage(interaction) {
  const footerText = interaction?.message?.embeds?.[0]?.footer?.text || "";
  const match = String(footerText).match(/CatSlug\s+([a-z0-9_]+)/i);
  if (!match) return "all";
  return match[1] || "all";
}

function buildHelpPayload(client, allCommands, requestedPage, requestedSlug = "all") {
  const index = buildCategoryIndex(allCommands);
  const selectedSlug = index.slugToLabel.has(requestedSlug) ? requestedSlug : "all";
  const selectedLabel = index.slugToLabel.get(selectedSlug) || "Tout";

  let commandsForView = allCommands;
  if (selectedSlug !== "all") {
    const label = index.slugToLabel.get(selectedSlug);
    commandsForView = index.labelToCommands.get(label) || [];
  }

  const fields = buildFieldList(commandsForView);
  const perPage = 5;
  const pages = chunkArray(fields, perPage);
  const safePages = pages.length > 0 ? pages : [[]];
  const totalPages = safePages.length;
  const pageIndex = Math.min(Math.max(requestedPage, 0), totalPages - 1);

  const embed = buildHelpEmbed(
    client,
    commandsForView,
    pageIndex,
    totalPages,
    safePages[pageIndex],
    selectedLabel,
    selectedSlug,
  );

  const components = [...buildCategoryRows(index.categories, selectedSlug), buildNavRow(client, pageIndex, totalPages)];

  return { embeds: [embed], components };
}

const help = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Affiche toutes les commandes disponibles")
    .setContexts(InteractionContextType.Guild),

  async executeCommand(client, interaction) {
    const loadedCommands = client.getCommands().filter((cmd) => cmd?.settings?.enabled !== false);
    const payload = buildHelpPayload(client, loadedCommands, 0, "all");
    await interaction.reply(payload);
  },

  async execButtons(client, interaction, buttonId) {
    if (!interaction.isButton()) return;

    const loadedCommands = client.getCommands().filter((cmd) => cmd?.settings?.enabled !== false);
    const currentPage = parseCurrentPageFromMessage(interaction);
    const currentSlug = parseCurrentCategorySlugFromMessage(interaction);

    let nextPage = currentPage;
    let nextSlug = currentSlug;

    if (buttonId === "prev") nextPage = currentPage - 1;
    if (buttonId === "next") nextPage = currentPage + 1;
    if (buttonId.startsWith("cat_")) {
      nextSlug = buttonId.replace("cat_", "") || "all";
      nextPage = 0;
    }

    const payload = buildHelpPayload(client, loadedCommands, nextPage, nextSlug);

    if (interaction.deferred || interaction.replied) {
      await interaction
        .followUp({
          content: "Panneau d'aide deja traite. Relance /help.",
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
      return;
    }

    await interaction.update(payload);
  },

  settings: {
    module: "general",
    enabled: true,
  },
};

module.exports = { default: help };
