const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("streak")
        .setDescription("Affiche tes statistiques d'activité journalière (flammes)."),

    async executeCommand(client, interaction) {
        const db = interaction.client.database?.getDatabase();
        if (!db) return interaction.reply("❌ Base de données indisponible.");

        try {
            const data = await db("user_progression").where({ user_id: interaction.user.id }).first();
            if (!data) return interaction.reply("❌ Aucune progression trouvée.");

            const msgRequired = 10; // Devrait correspondre à ProgressionManager.STREAK_MSG_REQUIRED
            const msgProgress = Math.min(data.daily_msg_count || 0, msgRequired);
            
            const voiceRequiredMin = 30; // 30 minutes
            const voiceProgressMin = Math.floor((data.daily_voice_ms || 0) / 60000);
            const voiceProgress = Math.min(voiceProgressMin, voiceRequiredMin);

            const embed = new EmbedBuilder()
                .setTitle("🔥 État de ta Streak")
                .setColor(data.is_frozen ? 0x3498db : 0xff9f43)
                .addFields(
                    { name: "Série actuelle", value: `**${data.streak_count || 0} jours**`, inline: true },
                    { name: "Boucliers", value: `🛡️ **${data.streak_shields || 0}/3**`, inline: true },
                    { name: "État", value: data.is_frozen ? "❄️ Gelé (Inactif hier)" : "🔥 Actif", inline: true }
                )
                .addFields(
                    { name: "Objectifs du jour", value: 
                        `💬 Messages: \`${msgProgress}/${msgRequired}\` ${msgProgress >= msgRequired ? "✅" : "⏳"}\n` +
                        `🎙️ Vocal: \`${voiceProgress}/${voiceRequiredMin} min\` ${voiceProgress >= voiceRequiredMin ? "✅" : "⏳"}`
                    }
                )
                .setFooter({ text: "Complète un des deux objectifs pour maintenir ta flamme !" })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error("Error in streak command:", error);
            await interaction.reply("❌ Une erreur est survenue.");
        }
    }
};
