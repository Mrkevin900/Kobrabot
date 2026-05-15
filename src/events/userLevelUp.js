const LevelEmbedBuilder = require("../utils/LevelEmbedBuilder");

module.exports = {
    name: "userLevelUp",
    async executeHandler(client, member, newLevel) {
        if (!member || !member.guild) return;

        const { embed } = LevelEmbedBuilder.buildLevelUp(member, newLevel);

        // Prioritize LEVEL_CHANNEL_ID from .env
        const channelId = process.env.LEVEL_CHANNEL_ID || process.env.RANK_UP_CHANNEL_ID;
        let channel = channelId ? member.guild.channels.cache.get(channelId) : null;

        if (!channel) {
            channel = member.guild.channels.cache.find(c => 
                c.type === 0 && (c.name.includes("progression") || c.name.includes("chat") || c.name.includes("level"))
            ) || member.guild.systemChannel;
        }

        if (channel) {
            await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
        }
    }
};
