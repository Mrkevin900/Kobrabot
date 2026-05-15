const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { getCurrentRankInfo } = require("../../utils/RankConfig");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Affiche ta carte de rang ou celle d'un autre membre.")
        .addUserOption(option => 
            option.setName("membre")
                .setDescription("Le membre dont tu veux voir le rang")
                .setRequired(false)),

    async executeCommand(client, interaction) {
        await interaction.deferReply();
        
        const targetUser = interaction.options.getUser("membre") || interaction.user;
        const db = interaction.client.database?.getDatabase();
        
        if (!db) {
            return interaction.editReply("❌ Base de données indisponible.");
        }

        try {
            let data = await db("user_progression").where({ user_id: targetUser.id }).first();
            
            if (!data) {
                // Initialisation automatique du profil si inexistant
                await interaction.client.progressionManager.initializeUser(targetUser.id);
                data = await db("user_progression").where({ user_id: targetUser.id }).first();
            }

            if (!data) {
                return interaction.editReply("❌ Impossible de récupérer ou d'initialiser ton profil.");
            }

            const rankInfo = getCurrentRankInfo(data.rp || 0);
            
            // On récupère le Karma (nombre de sanctions) depuis l'API
            let karma = 0;
            const api = interaction.client.kobralostAPI;
            if (api) {
                const playerRes = await api.getPlayer(targetUser.id);
                const uuid = playerRes.success ? playerRes.data.uuid : null;
                if (uuid) {
                    const punRes = await api.getAllPunishments(uuid);
                    if (punRes.success && Array.isArray(punRes.data)) {
                        karma = punRes.data.length;
                    }
                }
            }
            // Fetch Badges
            let badges = [];
            const badgeRes = await api.getPlayerBadges(uuid);
            if (badgeRes.success && Array.isArray(badgeRes.data)) {
                badges = badgeRes.data;
            }
            data.badges = badges;

            // On utilise le RankCardManager du client (à initialiser dans le bot)
            if (!interaction.client.rankCardManager) {
                return interaction.editReply("❌ Le système de cartes n'est pas initialisé.");
            }

            const buffer = await interaction.client.rankCardManager.generateCard(targetUser, data, rankInfo);
            const attachment = new AttachmentBuilder(buffer, { name: `rank-${targetUser.id}.png` });

            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            client.getLogger().send(`Error in rank command: ${error.message}`, "ERROR");
            if (error.stack) client.getLogger().send(error.stack, "DEBUG");
            await interaction.editReply("❌ Une erreur est survenue lors de la génération de la carte.");
        }
    }
};
