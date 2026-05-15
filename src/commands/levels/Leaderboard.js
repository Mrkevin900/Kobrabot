const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getCurrentRankInfo } = require("../../utils/RankConfig");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Affiche le classement des meilleurs joueurs.")
        .addStringOption(option =>
            option.setName("type")
                .setDescription("Type de classement")
                .setRequired(false)
                .addChoices(
                    { name: "XP (Niveaux)", value: "xp" },
                    { name: "RP (Grades)", value: "rp" },
                    { name: "Streak (Flammes)", value: "streak_count" }
                )),

    async executeCommand(client, interaction) {
        const db = interaction.client.database?.getDatabase();
        if (!db) return interaction.reply("❌ Base de données indisponible.");

        const type = interaction.options.getString("type") || "rp";
        const label = type === "xp" ? "XP" : (type === "rp" ? "RP" : "Flammes");

        try {
            const topUsers = await db("user_progression")
                .orderBy(type, "desc")
                .limit(10);

            if (topUsers.length === 0) {
                return interaction.reply("❌ Aucun joueur dans le classement pour le moment.");
            }

            const embed = new EmbedBuilder()
                .setTitle(`🏆 Classement - Top 10 (${label})`)
                .setColor(0xffd700)
                .setTimestamp();

            let description = "";
            for (let i = 0; i < topUsers.length; i++) {
                const user = topUsers[i];
                const member = interaction.guild.members.cache.get(user.user_id);
                const name = member ? member.displayName : `Utilisateur Inconnu (${user.user_id})`;
                const rankInfo = getCurrentRankInfo(user.rp || 0);
                
                const medal = i === 0 ? "🥇" : (i === 1 ? "🥈" : (i === 2 ? "🥉" : `${i + 1}.`));
                const value = user[type];
                
                description += `${medal} **${name}**\n╰ ${value} ${label} • *${rankInfo.fullName}*\n\n`;
            }

            embed.setDescription(description);
            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error("Error in leaderboard command:", error);
            await interaction.reply("❌ Une erreur est survenue lors de la récupération du classement.");
        }
    }
};
