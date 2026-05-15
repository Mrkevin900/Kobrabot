const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} = require("discord.js");

class PermissionManager {
    /**
     * Sends a DM to the target user to request permission for data access.
     * @param {Object} client Discord client
     * @param {Object} requester The user requesting access
     * @param {Object} target The user whose data is being accessed
     * @param {String} type Type of data (e.g., "Casier judiciaire", "Profil RP")
     * @returns {Promise<Boolean>} True if approved, false otherwise
     */
    static async requestApproval(client, requester, target, type = "Profil RP", pollCallback = null) {
        // If target and requester are the same, we still ask for permission as requested
        const isSelf = requester.id === target.id;
        
        // Try to get a proper guild name
        let guildName = "Kobralost RP";
        const syncGuildId = process.env.SYNC_GUILD_ID;
        if (syncGuildId) {
            const guild = client.guilds.cache.get(syncGuildId);
            if (guild) guildName = guild.name;
        } else if (client.guilds.cache.size > 0) {
            // Fallback to the first guild but avoid "Serveur Support" if possible
            const guild = client.guilds.cache.find(g => !g.name.toLowerCase().includes("support")) || client.guilds.cache.first();
            if (guild) guildName = guild.name;
        }

        const embed = new EmbedBuilder()
            .setTitle("🛡️ Demande d'accès aux données")
            .setDescription(
                isSelf 
                ? `Vous avez demandé à accéder à votre **${type}** sur le serveur **${guildName}**.\n\nVeuillez autoriser l'accès ci-dessous. Le processus se validera tout seul.`
                : `L'utilisateur **${requester.username}** souhaite accéder à votre **${type}** sur le serveur **${guildName}**.\n\nVeuillez autoriser l'accès. Le statut s'actualisera automatiquement.`
            )
            .setColor(0x5865F2)
            .setThumbnail(requester.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: "KobraBot Security • Cette demande expire dans 2 minutes" });

        let scopes = "player.read";
        if (type === "Casier judiciaire") {
            scopes = "punishments-moderation.read,punishments-team.read";
        } else if (type === "Profil RP") {
            scopes = "player.read";
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("🔗 Autoriser (Dashboard)")
                .setURL(`https://dashboard.kobralost-rp.com/tokens/${process.env.KOBRALOST_ACCOUNT_ID || "74745"}/${process.env.KOBRALOST_TOKEN_ID || "201"}/authorize?scopes=${scopes}`)
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setCustomId("deny_access")
                .setLabel("❌ Refuser")
                .setStyle(ButtonStyle.Danger)
        );

        try {
            const dmChannel = await target.createDM();
            const message = await dmChannel.send({ embeds: [embed], components: [row] });

            return new Promise((resolve) => {
                let isResolved = false;
                let pollInterval = null;

                const cleanup = () => {
                    isResolved = true;
                    if (pollInterval) clearInterval(pollInterval);
                    collector.stop();
                };

                const collector = message.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 120000, // 2 minutes
                });

                // Set up polling if a callback is provided
                if (pollCallback) {
                    pollInterval = setInterval(async () => {
                        if (isResolved) return;
                        try {
                            const isAuthorized = await pollCallback();
                            if (isAuthorized && !isResolved) {
                                cleanup();
                                message.edit({ 
                                    content: "✅ Accès autorisé avec succès ! Les données chargent...", 
                                    embeds: [], 
                                    components: [] 
                                }).catch(() => {});
                                resolve(true);
                            }
                        } catch (err) {
                            console.error("[PermissionManager] Polling error:", err.message);
                        }
                    }, 5000); // Check every 5 seconds
                }

                collector.on("collect", async (interaction) => {
                    try {
                        if (interaction.customId === "deny_access") {
                            cleanup();
                            if (!interaction.replied && !interaction.deferred) {
                                await interaction.update({ 
                                    content: "❌ Accès refusé.", 
                                    embeds: [], 
                                    components: [] 
                                });
                            }
                            resolve(false);
                        }
                    } catch (err) {
                        console.error("[PermissionManager] Interaction error:", err.message);
                        cleanup();
                        resolve(false);
                    }
                });

                collector.on("end", (collected, reason) => {
                    if (reason === "time" && !isResolved) {
                        cleanup();
                        message.edit({ 
                            content: "⌛ Demande expirée.", 
                            embeds: [], 
                            components: [] 
                        }).catch(() => {});
                        resolve(false);
                    }
                });
            });
        } catch (error) {
            console.error(`[PermissionManager] Error sending DM to ${target.tag}:`, error.message);
            return false; // Cannot send DM, assume refused for security
        }
    }
}

module.exports = PermissionManager;
