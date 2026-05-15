const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { getDatabase } = require("../../database/database");
const {
  getGuildTriggers: getGuildTriggersFromDb,
  addTrigger,
  removeTrigger,
} = require("../../utils/vocalTriggers");

function ensureStore(client) {
  if (!client.cache) {
    const CacheManager = require("../../utils/CacheManager");
    client.cache = new CacheManager();
  }
  return client.cache;
}

function getGuildTriggers(store, guildId) {
  const all = store.has("vocalTriggers") ? store.get("vocalTriggers") : [];
  return Array.isArray(all) ? all.filter((t) => t.guildId === guildId) : [];
}

const vocalsetup = {
  data: new SlashCommandBuilder()
    .setName("vocalsetup")
    .setDescription("\u2728 Configuration des salons vocaux temporaires")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("\u2728 Cree un salon vocal declencheur")
        .addStringOption((option) =>
          option
            .setName("nom")
            .setDescription("\u2728 Nom du salon declencheur")
            .setRequired(false),
        )
        .addChannelOption((option) =>
          option
            .setName("categorie")
            .setDescription("\u2728 Categorie ou creer le salon")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false),
        )
        .addIntegerOption((option) =>
          option
            .setName("limite")
            .setDescription("\u2728 Limite utilisateur (0 = illimite)")
            .setMinValue(0)
            .setMaxValue(99)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("\u2728 Liste les declencheurs"))
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("\u2728 Retire un declencheur")
        .addChannelOption((option) =>
          option
            .setName("salon")
            .setDescription("\u2728 Salon declencheur")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("panel").setDescription("\u2728 Affiche un resume d'utilisation"),
    ),

  async executeCommand(client, interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") return this.handleCreate(client, interaction);
    if (subcommand === "list") return this.handleList(client, interaction);
    if (subcommand === "remove") return this.handleRemove(client, interaction);
    if (subcommand === "panel") return this.handlePanel(interaction);

    return interaction.reply({
      content: "Sous-commande inconnue.",
      flags: MessageFlags.Ephemeral,
    });
  },

  async handleCreate(client, interaction) {
    const guild = interaction.guild;
    const name = interaction.options.getString("nom") || "Create Room";
    const category = interaction.options.getChannel("categorie");
    const userLimit = interaction.options.getInteger("limite") ?? 0;
    const store = ensureStore(client);

    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: category ? category.id : null,
      userLimit,
      permissionOverwrites: [
        {
          id: guild.id,
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.ViewChannel,
          ],
        },
      ],
    });

    const sqlDb = getDatabase();
    if (sqlDb) {
      await addTrigger(sqlDb, guild.id, channel.id);
    } else {
      const all = store.has("vocalTriggers") ? store.get("vocalTriggers") : [];
      const deduped = Array.isArray(all) ? all.filter((t) => t.channelId !== channel.id) : [];
      deduped.push({
        channelId: channel.id,
        guildId: guild.id,
        createdAt: Date.now(),
      });
      store.set("vocalTriggers", deduped);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle("Declencheur vocal cree")
      .setDescription(`Le salon ${channel} a ete ajoute comme declencheur.`)
      .addFields(
        { name: "Nom", value: channel.name, inline: true },
        { name: "Limite", value: userLimit === 0 ? "Illimite" : `${userLimit}`, inline: true },
        { name: "Categorie", value: category ? category.name : "Aucune", inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async handleList(client, interaction) {
    const store = ensureStore(client);
    const guild = interaction.guild;
    const sqlDb = getDatabase();
    const triggers = sqlDb ? await getGuildTriggersFromDb(sqlDb, guild.id) : getGuildTriggers(store, guild.id);

    if (triggers.length === 0) {
      return interaction.reply({
        content: "Aucun declencheur vocal configure.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const lines = [];
    for (const trigger of triggers) {
      const channel = guild.channels.cache.get(trigger.channelId);
      const label = channel ? `${channel}` : `Salon supprime (${trigger.channelId})`;
      lines.push(`- ${label}`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x2196f3)
      .setTitle("Liste des declencheurs vocaux")
      .setDescription(lines.join("\n").slice(0, 4000))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async handleRemove(client, interaction) {
    const store = ensureStore(client);
    const guild = interaction.guild;
    const channel = interaction.options.getChannel("salon", true);
    const sqlDb = getDatabase();
    if (sqlDb) {
      const removed = await removeTrigger(sqlDb, guild.id, channel.id);
      if (removed === 0) {
        return interaction.reply({
          content: "Ce salon n'est pas un declencheur configure.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } else {
      const all = store.has("vocalTriggers") ? store.get("vocalTriggers") : [];
      const before = Array.isArray(all) ? all.length : 0;
      const filtered = (Array.isArray(all) ? all : []).filter((t) => t.channelId !== channel.id);

      if (filtered.length === before) {
        return interaction.reply({
          content: "Ce salon n'est pas un declencheur configure.",
          flags: MessageFlags.Ephemeral,
        });
      }

      store.set("vocalTriggers", filtered);
    }

    return interaction.reply({
      content: `Declencheur retire: ${channel}`,
      flags: MessageFlags.Ephemeral,
    });
  },

  async handlePanel(interaction) {
    const mascot = interaction.client.mascot("\u{1F497}");
    const embed = new EmbedBuilder()
      .setColor(0x9c27b0)
      .setTitle(`${mascot} Aide vocalsetup`)
      .setDescription(
        "/vocalsetup create : cree un declencheur\n" +
          "/vocalsetup list : liste les declencheurs\n" +
          "/vocalsetup remove : retire un declencheur\n\n" +
          "Quand un membre rejoint un declencheur, un vocal temporaire est cree.",
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};

module.exports = { default: vocalsetup };




