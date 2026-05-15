const { existsSync } = require("fs");
const { join } = require("path");
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");

const OPTIMIZATION_CATEGORY_NAME = "\u2699\uFE0F OPTIMISATION";
const OPTIMIZATION_CATEGORY_FALLBACK_NAME = "OPTIMISATION";
const OPTIMIZATION_FOOTER = "KobraBot \u2022 Pack optimisation GMod RP";
const SETUP_REASON = "Installation de l'espace optimisation GMod RP";

const PACKS = {
  full: {
    buttonId: "optimisation.download",
    label: "Pack complet",
    dmLabel: "pack complet",
    emoji: "\u{1F4E5}",
    style: ButtonStyle.Success,
    files: [
      "autoexec.cfg",
      "sortie-armes.cfg",
      "sommations-rockford.cfg",
      "kbrp-reshade-light.ini",
      "guide-installation-gmod.txt",
      "guide-sortie-armes.txt",
      "guide-sommations-rockford.txt",
    ],
  },
  weapons: {
    buttonId: "optimisation.download_weapons",
    label: "Pack armes",
    dmLabel: "pack sorties d'armes",
    emoji: "\u{1F52B}",
    style: ButtonStyle.Primary,
    files: ["sortie-armes.cfg", "guide-sortie-armes.txt"],
  },
  summons: {
    buttonId: "optimisation.download_summons",
    label: "Pack sommations",
    dmLabel: "pack sommations Rockford",
    emoji: "\u{1F6A8}",
    style: ButtonStyle.Danger,
    files: ["sommations-rockford.cfg", "guide-sommations-rockford.txt"],
  },
};

const OPTIMIZATION_CHANNELS = [
  {
    key: "autoexec",
    name: "autoexec",
    topic:
      "Panneau principal et autoexec.cfg pour le pack optimisation GMod RP.",
  },
  {
    key: "reshade",
    name: "reshade",
    topic: "Preset ReShade leger pour GMod RP.",
  },
  {
    key: "fps-config",
    name: "fps-config",
    topic: "Configuration FPS et commandes recommandees pour GMod.",
  },
  {
    key: "binds-rp",
    name: "binds-rp",
    topic: "Index general des binds RP, sorties d'armes et sommations.",
  },
  {
    key: "sortie-armes",
    name: "sortie-armes",
    topic: "Binds de sortie d'armes RP et tutoriel de personnalisation.",
  },
  {
    key: "sommations-rockford",
    name: "sommations-rockford",
    topic: "Bibliotheque de sommations RP Rockford par situation.",
  },
  {
    key: "telechargement",
    name: "t\u00E9l\u00E9chargement",
    fallbackName: "telechargement",
    topic: "Distribution en MP du pack optimisation GMod RP.",
  },
];

const DOWNLOAD_FILE_PATHS = {
  "autoexec.cfg": join(
    __dirname,
    "..",
    "..",
    "data",
    "optimisation-gmod",
    "autoexec.cfg",
  ),
  "sortie-armes.cfg": join(
    __dirname,
    "..",
    "..",
    "data",
    "optimisation-gmod",
    "sortie-armes.cfg",
  ),
  "sommations-rockford.cfg": join(
    __dirname,
    "..",
    "..",
    "data",
    "optimisation-gmod",
    "sommations-rockford.cfg",
  ),
  "kbrp-reshade-light.ini": join(
    __dirname,
    "..",
    "..",
    "data",
    "optimisation-gmod",
    "kbrp-reshade-light.ini",
  ),
  "guide-installation-gmod.txt": join(
    __dirname,
    "..",
    "..",
    "data",
    "optimisation-gmod",
    "guide-installation-gmod.txt",
  ),
  "guide-sortie-armes.txt": join(
    __dirname,
    "..",
    "..",
    "data",
    "optimisation-gmod",
    "guide-sortie-armes.txt",
  ),
  "guide-sommations-rockford.txt": join(
    __dirname,
    "..",
    "..",
    "data",
    "optimisation-gmod",
    "guide-sommations-rockford.txt",
  ),
};

const DEFAULT_KEYS = [
  ["F6", "Arme d'epaule"],
  ["F7", "Arme de poing"],
  ["F8", "Taser"],
  ["F9", "Menottes"],
  ["F10", "Sommation 1 active"],
  ["F11", "Sommation 2 active"],
  ["F12", "Sommation 3 active"],
];

const FPS_LINES = [
  "fps_max 0",
  "mat_queue_mode 2",
  "cl_threaded_bone_setup 1",
  "cl_threaded_client_leaf_system 1",
  "r_threaded_renderables 1",
  "r_threaded_particles 1",
];

const SUMMON_PROFILES = [
  "Interpellation d'un suspect arme",
  "Evacuation d'une zone precise",
  "Sortie immediate d'un batiment",
  "Interception en course-poursuite",
  "Liberation d'un otage",
  "Controle de vehicule au barrage",
  "Dispersion d'un groupe arme",
];

function buildFooterData() {
  return { text: OPTIMIZATION_FOOTER };
}

function formatKeyMap() {
  return DEFAULT_KEYS.map(
    ([key, action]) => `\`${key}\` \u2022 ${action}`,
  ).join("\n");
}

function formatSummonProfiles() {
  return SUMMON_PROFILES.map((line) => `\u2022 ${line}`).join("\n");
}

function getPackDefinition(packKey = "full") {
  return PACKS[packKey] || PACKS.full;
}

function getPackKeyFromButtonId(buttonId = "") {
  if (buttonId === "download" || buttonId === "download_full") return "full";
  if (buttonId === "download_weapons") return "weapons";
  if (buttonId === "download_summons") return "summons";
  return null;
}

function buildPackRow(packKeys) {
  const row = new ActionRowBuilder();

  for (const packKey of packKeys) {
    const pack = getPackDefinition(packKey);
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(pack.buttonId)
        .setLabel(pack.label)
        .setEmoji(pack.emoji)
        .setStyle(pack.style),
    );
  }

  return row;
}

function buildAutoexecEmbed(client) {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Optimisation GMod \u{1F680}")
    .setDescription(
      "Clique sur le bouton ci-dessous pour recevoir le pack complet en message prive.",
    )
    .addFields(
      {
        name: "Contenu principal",
        value:
          "\u2022 `autoexec.cfg`\n" +
          "\u2022 `sortie-armes.cfg`\n" +
          "\u2022 `sommations-rockford.cfg`\n" +
          "\u2022 Guides d'installation",
        inline: false,
      },
      {
        name: "Tutoriel express",
        value:
          "1. Place les fichiers `.cfg` dans `garrysmod/cfg/`\n" +
          "2. Place le preset ReShade dans le dossier du jeu\n" +
          "3. Lance `exec autoexec` en console",
        inline: false,
      },
      {
        name: "Touches par defaut",
        value: formatKeyMap(),
        inline: false,
      },
    )
    .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
    .setFooter(buildFooterData())
    .setTimestamp();
}

function buildReshadeEmbed() {
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("Preset ReShade leger")
    .setDescription(
      "Un preset simple est inclus pour gagner en lisibilite sans transformer GMod en preset lourd.",
    )
    .addFields(
      {
        name: "Ce que le preset apporte",
        value:
          "\u2022 Nettete legere\n" +
          "\u2022 Anti-aliasing discret\n" +
          "\u2022 Lisibilite plus propre en RP",
        inline: true,
      },
      {
        name: "Conseil performances",
        value:
          "Si tu veux uniquement du FPS, garde l'autoexec et laisse ReShade desactive.",
        inline: true,
      },
    )
    .setFooter(buildFooterData())
    .setTimestamp();
}

function buildFpsEmbed() {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("Configuration FPS")
    .setDescription(
      "Ces lignes sont incluses dans `autoexec.cfg` pour garder une base propre et stable.",
    )
    .addFields(
      {
        name: "Lignes integrees",
        value: `\`\`\`cfg\n${FPS_LINES.join("\n")}\n\`\`\``,
        inline: false,
      },
      {
        name: "Structure du pack",
        value:
          "`autoexec.cfg` charge le coeur FPS, puis appelle les fichiers armes et sommations pour garder une config lisible.",
        inline: false,
      },
    )
    .setFooter(buildFooterData())
    .setTimestamp();
}

function buildBindsIndexEmbed() {
  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("Bibliotheque RP")
    .setDescription(
      "L'espace optimisation contient maintenant un index general, puis deux salons specialises avec leurs propres boutons.",
    )
    .addFields(
      {
        name: "Salons specialises",
        value:
          "\u2022 `#sortie-armes` pour les binds de draw RP\n" +
          "\u2022 `#sommations-rockford` pour les sommations par situation",
        inline: false,
      },
      {
        name: "Pourquoi separer",
        value:
          "Les packs sont plus faciles a maintenir, a envoyer en MP et a personnaliser sans melanger toutes les commandes.",
        inline: false,
      },
    )
    .setFooter(buildFooterData())
    .setTimestamp();
}

function buildWeaponsEmbed() {
  return new EmbedBuilder()
    .setColor(0xc0392b)
    .setTitle("Sortie d'armes RP")
    .setDescription(
      "Ce salon est dedie aux binds professionnels pour sortir proprement les armes et outils de service.",
    )
    .addFields(
      {
        name: "Inclus dans le pack",
        value:
          "\u2022 Fusil / arme d'epaule\n" +
          "\u2022 Arme de poing\n" +
          "\u2022 Taser\n" +
          "\u2022 Menottes\n" +
          "\u2022 Guide de personnalisation",
        inline: true,
      },
      {
        name: "Tutoriel rapide",
        value:
          "Modifie la touche dans les lignes `bind`, puis adapte les `use weapon_*` si ton serveur utilise d'autres classnames.",
        inline: true,
      },
      {
        name: "Objectif",
        value:
          "Avoir des sorties d'armes coherentes, lisibles et rapides sans perdre le cote RP.",
        inline: false,
      },
    )
    .setFooter(buildFooterData())
    .setTimestamp();
}

function buildSummonsEmbed() {
  return new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle("Sommations RP Rockford")
    .setDescription(
      "Ce salon regroupe une bibliotheque de sommations Rockford par situation, avec une action identique sur les 3 messages.",
    )
    .addFields(
      {
        name: "Profils inclus",
        value: formatSummonProfiles(),
        inline: false,
      },
      {
        name: "Rappel reglementaire",
        value:
          "\u2022 Arme en main avant engagement\n" +
          "\u2022 3 sommations minimum\n" +
          "\u2022 Meme action sur les 3\n" +
          "\u2022 1 seconde minimum entre chaque",
        inline: false,
      },
      {
        name: "Personnalisation",
        value:
          "Le pack contient des profils prets a l'emploi et des commandes de changement rapide pour basculer F10/F11/F12 selon la scene.",
        inline: false,
      },
    )
    .setFooter(buildFooterData())
    .setTimestamp();
}

function buildDownloadHubEmbed() {
  return new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle("Centre de telechargement")
    .setDescription(
      "Choisis le pack que tu veux recevoir en message prive selon ton besoin.",
    )
    .addFields(
      {
        name: "Packs disponibles",
        value:
          "\u2022 Pack complet optimisation\n" +
          "\u2022 Pack sorties d'armes\n" +
          "\u2022 Pack sommations Rockford",
        inline: false,
      },
      {
        name: "Astuce",
        value:
          "Si tes MP sont fermes, active-les temporairement puis reclique sur le bouton voulu.",
        inline: false,
      },
    )
    .setFooter(buildFooterData())
    .setTimestamp();
}

function buildPackDmEmbed(packKey = "full") {
  if (packKey === "weapons") {
    return new EmbedBuilder()
      .setColor(0xc0392b)
      .setTitle("Pack Sortie d'armes RP")
      .setDescription(
        "Voici le pack dedie aux sorties d'armes avec le fichier `.cfg` et son guide de personnalisation.",
      )
      .addFields(
        {
          name: "Fichiers joints",
          value:
            "\u2022 `sortie-armes.cfg`\n" + "\u2022 `guide-sortie-armes.txt`",
          inline: true,
        },
        {
          name: "Usage",
          value:
            "Place le fichier dans `garrysmod/cfg/`, puis adapte les touches et les classnames si besoin.",
          inline: true,
        },
      )
      .setFooter(buildFooterData())
      .setTimestamp();
  }

  if (packKey === "summons") {
    return new EmbedBuilder()
      .setColor(0x8e44ad)
      .setTitle("Pack Sommations Rockford")
      .setDescription(
        "Voici la bibliotheque de sommations Rockford avec les profils par situation et le guide associe.",
      )
      .addFields(
        {
          name: "Fichiers joints",
          value:
            "\u2022 `sommations-rockford.cfg`\n" +
            "\u2022 `guide-sommations-rockford.txt`",
          inline: true,
        },
        {
          name: "Rappel",
          value:
            "Chaque serie garde une action identique sur les 3 sommations, avec un lieu precis a personnaliser.",
          inline: true,
        },
      )
      .setFooter(buildFooterData())
      .setTimestamp();
  }

  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("Pack Optimisation GMod RP")
    .setDescription(
      "Voici le pack complet avec optimisation FPS, sorties d'armes, sommations Rockford, ReShade et guides.",
    )
    .addFields(
      {
        name: "Fichiers joints",
        value:
          "\u2022 `autoexec.cfg`\n" +
          "\u2022 `sortie-armes.cfg`\n" +
          "\u2022 `sommations-rockford.cfg`\n" +
          "\u2022 `kbrp-reshade-light.ini`\n" +
          "\u2022 3 guides texte",
        inline: true,
      },
      {
        name: "Structure",
        value:
          "`autoexec.cfg` gere les FPS puis appelle les fichiers specialises pour garder une config propre.",
        inline: true,
      },
    )
    .setFooter(buildFooterData())
    .setTimestamp();
}

function buildSetupSummaryEmbed(category, channels) {
  const orderedChannels = OPTIMIZATION_CHANNELS.map(
    (definition) => channels[definition.key],
  )
    .filter(Boolean)
    .map((channel) => `${channel}`)
    .join("\n");

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Espace optimisation installe")
    .setDescription(
      "La categorie, les salons et les panneaux ont ete verifies puis envoyes.",
    )
    .addFields(
      { name: "Categorie", value: `${category}`, inline: false },
      {
        name: "Salons",
        value: orderedChannels || "Aucun salon",
        inline: false,
      },
    )
    .setFooter(buildFooterData())
    .setTimestamp();
}

function getChannelMessages(client) {
  return {
    autoexec: [
      {
        embeds: [buildAutoexecEmbed(client)],
        components: [buildPackRow(["full"])],
      },
    ],
    reshade: [{ embeds: [buildReshadeEmbed()] }],
    "fps-config": [{ embeds: [buildFpsEmbed()] }],
    "binds-rp": [{ embeds: [buildBindsIndexEmbed()] }],
    "sortie-armes": [
      {
        embeds: [buildWeaponsEmbed()],
        components: [buildPackRow(["weapons"])],
      },
    ],
    "sommations-rockford": [
      {
        embeds: [buildSummonsEmbed()],
        components: [buildPackRow(["summons"])],
      },
    ],
    telechargement: [
      {
        embeds: [buildDownloadHubEmbed()],
        components: [buildPackRow(["full", "weapons", "summons"])],
      },
    ],
  };
}

function createOptimizationAttachments(packKey = "full") {
  const pack = getPackDefinition(packKey);

  return pack.files.map((fileName) => {
    const filePath = DOWNLOAD_FILE_PATHS[fileName];
    if (!filePath || !existsSync(filePath)) {
      throw new Error(`Fichier d'optimisation introuvable: ${fileName}`);
    }

    return new AttachmentBuilder(filePath, { name: fileName });
  });
}

async function ensureOptimizationSpace(guild) {
  await guild.channels.fetch();

  let category =
    guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildCategory &&
        (channel.name === OPTIMIZATION_CATEGORY_NAME ||
          channel.name === OPTIMIZATION_CATEGORY_FALLBACK_NAME),
    ) || null;

  if (!category) {
    try {
      category = await guild.channels.create({
        name: OPTIMIZATION_CATEGORY_NAME,
        type: ChannelType.GuildCategory,
        reason: SETUP_REASON,
      });
    } catch (_) {
      category = await guild.channels.create({
        name: OPTIMIZATION_CATEGORY_FALLBACK_NAME,
        type: ChannelType.GuildCategory,
        reason: SETUP_REASON,
      });
    }
  }

  const channels = {};

  for (let index = 0; index < OPTIMIZATION_CHANNELS.length; index++) {
    const definition = OPTIMIZATION_CHANNELS[index];
    const acceptedNames = [definition.name, definition.fallbackName].filter(
      Boolean,
    );

    let channel =
      guild.channels.cache.find(
        (entry) =>
          entry.type === ChannelType.GuildText &&
          acceptedNames.includes(entry.name) &&
          entry.parentId === category.id,
      ) || null;

    if (!channel) {
      channel =
        guild.channels.cache.find(
          (entry) =>
            entry.type === ChannelType.GuildText &&
            acceptedNames.includes(entry.name),
        ) || null;
    }

    if (!channel) {
      try {
        channel = await guild.channels.create({
          name: definition.name,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: definition.topic,
          reason: SETUP_REASON,
        });
      } catch (_) {
        channel = await guild.channels.create({
          name: definition.fallbackName || definition.name,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: definition.topic,
          reason: SETUP_REASON,
        });
      }
    } else {
      if (channel.parentId !== category.id) {
        await channel
          .setParent(category.id, { lockPermissions: false })
          .catch(() => {});
      }

      if (channel.topic !== definition.topic) {
        await channel.setTopic(definition.topic).catch(() => {});
      }
    }

    await channel.setPosition(index).catch(() => {});
    channels[definition.key] = channel;
  }

  return { category, channels };
}

module.exports = {
  buildPackDmEmbed,
  buildSetupSummaryEmbed,
  createOptimizationAttachments,
  ensureOptimizationSpace,
  getChannelMessages,
  getPackDefinition,
  getPackKeyFromButtonId,
};
