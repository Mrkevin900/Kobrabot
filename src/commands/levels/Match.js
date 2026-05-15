const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("match")
        .setDescription("Enregistre le résultat d'un match pour un joueur (Admin).")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(option => option.setName("joueur").setDescription("Le joueur concerné").setRequired(true))
        .addStringOption(option => 
            option.setName("resultat")
                .setDescription("Résultat du match")
                .setRequired(true)
                .addChoices(
                    { name: "Victoire", value: "win" },
                    { name: "Défaite", value: "loss" }
                )),

    async executeCommand(client, interaction) {
        const target = interaction.options.getUser("joueur");
        const result = interaction.options.getString("resultat");
        const isWin = result === "win";

        if (!interaction.client.progressionManager) {
            return interaction.reply("❌ Le gestionnaire de progression n'est pas initialisé.");
        }

        await interaction.deferReply();

        const stats = await interaction.client.progressionManager.addMatchResult(target.id, isWin);

        if (!stats) {
            return interaction.editReply("❌ Impossible de mettre à jour les statistiques de ce joueur.");
        }

        const embed = new EmbedBuilder()
            .setTitle(isWin ? "🎮 MATCH REMPORTÉ !" : "🎮 MATCH TERMINÉ")
            .setColor(isWin ? 0x2ecc71 : 0xe74c3c)
            .setDescription(`Résultat enregistré pour **${target.username}**.\n\n` +
                `📈 **RP:** \`${stats.rpGain > 0 ? "+" : ""}${stats.rpGain}\` (Total: \`${stats.newRp}\`)\n` +
                `✨ **XP:** \`+${stats.xpGain}\` (Total: \`${stats.newXp}\`)`)
            .setThumbnail(target.displayAvatarURL())
            .setTimestamp();

        if (stats.rankUp) {
            embed.addFields({ name: "🚀 NOUVEAU RANG", value: `**${stats.oldRank.fullName}** ➔ **${stats.newRank.fullName}**` });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
