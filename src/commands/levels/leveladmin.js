const {
  SlashCommandBuilder,
  InteractionContextType,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require("discord.js");
const { getDatabase } = require("../../database/database");
const { TABLE, getProfile, xpForLevel } = require("../../utils/levelSystem");
const { grantMultiplier, addPoints } = require("../../utils/levelRewards");

const leveladmin = {
  data: new SlashCommandBuilder()
    .setName("leveladmin")
    .setDescription("Administration des niveaux et boosts XP")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("give_x2")
        .setDescription("Donner un boost XP a un membre")
        .addUserOption((opt) =>
          opt.setName("utilisateur").setDescription("Membre cible").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("minutes")
            .setDescription("Duree du boost")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(43200),
        )
        .addNumberOption((opt) =>
          opt
            .setName("multiplicateur")
            .setDescription("Multiplicateur XP (defaut: 2)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("set_level")
        .setDescription("Definir le niveau exact d'un membre")
        .addUserOption((opt) =>
          opt.setName("utilisateur").setDescription("Membre cible").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("niveau")
            .setDescription("Niveau cible")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add_levels")
        .setDescription("Ajouter des niveaux a un membre")
        .addUserOption((opt) =>
          opt.setName("utilisateur").setDescription("Membre cible").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("niveaux")
            .setDescription("Nombre de niveaux a ajouter")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("give_points")
        .setDescription("Donner des points boutique")
        .addUserOption((opt) =>
          opt.setName("utilisateur").setDescription("Membre cible").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("points")
            .setDescription("Nombre de points")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000000),
        ),
    ),

  async executeCommand(client, interaction) {
    const db = getDatabase();
    if (!db) {
      return interaction.reply({
        content: "Base de donnees indisponible.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser("utilisateur", true);

    if (user.bot) {
      return interaction.reply({
        content: "Cette commande ne s'applique pas aux bots.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "give_x2") {
      const minutes = interaction.options.getInteger("minutes", true);
      const multiplier = interaction.options.getNumber("multiplicateur") ?? 2;
      const wallet = await grantMultiplier(db, guildId, user.id, multiplier, minutes);

      const embed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("Boost attribue")
        .setDescription(`Boost x${multiplier} donne a ${user}.`)
        .addFields(
          { name: "Duree", value: `${minutes} minute(s)`, inline: true },
          { name: "Fin", value: `<t:${Math.floor(wallet.multiplierUntil / 1000)}:F>`, inline: true },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === "set_level") {
      const targetLevel = interaction.options.getInteger("niveau", true);
      const targetXp = xpForLevel(targetLevel);

      await getProfile(db, guildId, user.id);
      await db(TABLE)
        .where({ guild_id: guildId, user_id: user.id })
        .update({
          level: targetLevel,
          xp: targetXp,
          updated_at: db.fn.now(),
        });

      return interaction.reply({
        content: `${user} est maintenant niveau ${targetLevel} (${targetXp} XP).`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "add_levels") {
      const add = interaction.options.getInteger("niveaux", true);
      const profile = await getProfile(db, guildId, user.id);
      const targetLevel = profile.level + add;
      const targetXp = xpForLevel(targetLevel);

      await db(TABLE)
        .where({ guild_id: guildId, user_id: user.id })
        .update({
          level: targetLevel,
          xp: targetXp,
          updated_at: db.fn.now(),
        });

      return interaction.reply({
        content: `${user} gagne ${add} niveau(x) et passe niveau ${targetLevel}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === "give_points") {
      const points = interaction.options.getInteger("points", true);
      const wallet = await addPoints(db, guildId, user.id, points);

      return interaction.reply({
        content: `${points} point(s) donnes a ${user}. Nouveau solde: ${wallet.points}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      content: "Sous-commande inconnue.",
      flags: MessageFlags.Ephemeral,
    });
  },

  settings: {
    module: "admin",
    enabled: false,
  },
};

module.exports = { default: leveladmin };




