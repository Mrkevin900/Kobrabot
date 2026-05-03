const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require("discord.js");
const { getDatabase, ensureDatabaseConnection } = require("../../database/database");
const { getPanel } = require("../../utils/vocalPanels");
const { getRuntimeStore } = require("../../utils/runtimeStore");

async function resolveTempVocalEntry(client, guildId, channelId) {
  const store = getRuntimeStore(client);
  const tempVocals = store.has("tempVocals") ? store.get("tempVocals") : [];
  const memoryEntry = (Array.isArray(tempVocals) ? tempVocals : []).find(
    (entry) => entry.guildId === guildId && entry.channelId === channelId,
  );
  if (memoryEntry) return memoryEntry;

  const db = (await ensureDatabaseConnection(client)) || getDatabase();
  if (!db) return null;
  return getPanel(db, guildId, channelId);
}

const vocal = {
  data: new SlashCommandBuilder()
    .setName("vocal")
    .setDescription("Actions rapides sur ton vocal temporaire")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName("rename")
        .setDescription("Renomme ton vocal temporaire actuel")
        .addStringOption((option) =>
          option
            .setName("nom")
            .setDescription("Nouveau nom du vocal")
            .setRequired(true)
            .setMinLength(2)
            .setMaxLength(90),
        ),
    ),

  async executeCommand(client, interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== "rename") {
      return interaction.reply({
        content: "Sous-commande inconnue.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const member = interaction.member;
    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: "Tu dois etre dans ton vocal temporaire pour le renommer.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const entry = await resolveTempVocalEntry(client, interaction.guild.id, voiceChannel.id);
    if (!entry) {
      return interaction.reply({
        content: "Ce salon n'est pas reconnu comme vocal temporaire.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (entry.ownerId !== interaction.user.id) {
      return interaction.reply({
        content: "Tu n'es pas le proprietaire de ce vocal.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const newName = interaction.options.getString("nom", true).trim();
    await voiceChannel.setName(newName, `Renommage vocal temporaire par ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("Vocal renomme")
      .setDescription(`Ton vocal temporaire s'appelle maintenant **${newName}**.`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  settings: {
    module: "general",
    enabled: true,
  },
};

module.exports = { default: vocal };


