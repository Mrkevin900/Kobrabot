const LevelEmbedBuilder = require("../utils/LevelEmbedBuilder");

module.exports = {
    name: "userRankUp",
    async executeHandler(client, member, oldRank, newRank) {
        if (!member || !member.guild) return;

        const { embed, attachment } = LevelEmbedBuilder.buildRankUp(member, oldRank, newRank);

        // Prioritize LEVEL_CHANNEL_ID from .env
        const channelId = process.env.LEVEL_CHANNEL_ID || process.env.RANK_UP_CHANNEL_ID;
        let channel = channelId ? member.guild.channels.cache.get(channelId) : null;

        if (!channel) {
            channel = member.guild.channels.cache.find(c => 
                c.type === 0 && (c.name.includes("rank") || c.name.includes("progression"))
            ) || member.guild.systemChannel;
        }

        if (channel) {
            const options = { content: `${member}`, embeds: [embed] };
            if (attachment) options.files = [attachment];
            await channel.send(options).catch((err) => console.error("[RANK_UP] Erreur envoi:", err));
        }

        // Auto Role management
        try {
            const newRoleHandle = newRank.roleKey ? process.env[newRank.roleKey] : null;
            const { RANKS_CONFIG } = require("../utils/RankConfig");
            
            const allRankRoleIds = RANKS_CONFIG
                .map(r => r.roleKey ? process.env[r.roleKey] : null)
                .filter(id => id && id.length > 5); 

            // Remove old rank roles
            const rolesToRemove = member.roles.cache.filter(role => allRankRoleIds.includes(role.id));
            if (rolesToRemove.size > 0) {
                await member.roles.remove(rolesToRemove).catch(() => null);
            }

            // Add new role
            if (newRoleHandle) {
                const role = member.guild.roles.cache.get(newRoleHandle);
                if (role) {
                    await member.roles.add(role).catch(() => null);
                }
            }
        } catch (error) {
            console.error("[RANK_UP] Erreur gestion rôles:", error);
        }
    }
};
