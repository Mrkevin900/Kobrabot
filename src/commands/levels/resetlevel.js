const {
  SlashCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
} = require("discord.js");
const { getDatabase } = require("../../database/database");
const { TABLE, getProfile } = require("../../utils/levelSystem");

const resetlevel = {
  data: new SlashCommandBuilder()
    .setName("resetlevel")
    .setDescription("Remet a zero les niveaux (proprietaire du serveur uniquement)")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) =>
      option.setName("utilisateur").setDescription("Membre a reset").setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("tout")
        .setDescription("Reset tous les niveaux du serveur")
        .setRequired(false),
    ),

  async executeCommand(client, interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Commande disponible uniquement sur un serveur.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({
        content: "Seul le proprietaire du serveur peut utiliser cette commande.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const db = getDatabase();
    if (!db) {
      return interaction.reply({
        content: "Base de donnees indisponible.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const resetAll = interaction.options.getBoolean("tout") === true;
    const targetUser = interaction.options.getUser("utilisateur");

    if (resetAll && targetUser) {
      return interaction.editReply({
        content: "Choisis soit `tout=true`, soit un `utilisateur`, pas les deux.",
      });
    }

    if (resetAll) {
      const affected = await db(TABLE)
        .where({ guild_id: interaction.guild.id })
        .update({
          xp: 0,
          level: 1,
          last_message_at: 0,
          updated_at: db.fn.now(),
        });

      client
        .getLogger?.()
        ?.send(
          `[LEVEL] Reset global effectue par ${interaction.user.tag} sur ${interaction.guild.name} (${affected} profils)`,
          "ALERT",
        );

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("Reset niveaux global")
        .setDescription(`${affected} profil(s) ont ete remis au niveau 1 (XP 0).`)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    const user = targetUser || interaction.user;
    await getProfile(db, interaction.guild.id, user.id);
    await db(TABLE)
      .where({ guild_id: interaction.guild.id, user_id: user.id })
      .update({
        xp: 0,
        level: 1,
        last_message_at: 0,
        updated_at: db.fn.now(),
      });

    client
      .getLogger?.()
      ?.send(
        `[LEVEL] Reset profil ${user.tag} par ${interaction.user.tag} sur ${interaction.guild.name}`,
        "ALERT",
      );

    const embed = new EmbedBuilder()
      .setColor(0xfaa61a)
      .setTitle("Reset niveau effectue")
      .setDescription(`${user} est maintenant niveau **1** avec **0 XP**.`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },

  settings: {
    module: "admin",
    enabled: false,
  },
};

module.exports = { default: resetlevel };


