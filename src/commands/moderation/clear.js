const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  MessageFlags,
} = require("discord.js");
const ModerationDb = require("../../utils/ModerationDb");

const clear = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Supprime des messages du salon")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName("nombre")
        .setDescription("Nombre de messages a supprimer (1-1000)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000)
    )
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Filtrer la suppression sur un utilisateur")
        .setRequired(false)
    ),

  async executeCommand(client, interaction) {
    const nombre = interaction.options.getInteger("nombre");
    const targetUser = interaction.options.getUser("utilisateur");

    try {
      let deleted;

      if (!targetUser) {
        deleted = await interaction.channel.bulkDelete(nombre, true);
      } else {
        const fetched = await interaction.channel.messages.fetch({ limit: 100 });
        const selected = fetched
          .filter((msg) => msg.author.id === targetUser.id)
          .first(nombre);

        if (selected.length === 0) {
          return interaction.reply({
            content: "Aucun message recent trouve pour cet utilisateur.",
            flags: MessageFlags.Ephemeral,
          });
        }

        deleted = await interaction.channel.bulkDelete(selected, true);
      }

      const embed = new EmbedBuilder()
        .setColor(client.getConfig().embed.readyColor)
        .setTitle("Messages supprimes")
        .setDescription(
          targetUser
            ? `${deleted.size} message(s) de ${targetUser} ont ete supprimes.`
            : `${deleted.size} message(s) ont ete supprimes.`
        )
        .setTimestamp();

      await ModerationDb.logClear(client, interaction.guild.id, interaction.user.id, interaction.channel.id, deleted.size);

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (error) {
      return interaction.reply({
        content: "Erreur lors de la suppression des messages.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  settings: {
    module: "module_mo",
    enabled: true,
  },
};

module.exports = { default: clear };

