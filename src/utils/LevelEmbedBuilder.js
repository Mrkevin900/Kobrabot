const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const path = require("path");
const fs = require("fs");

class LevelEmbedBuilder {
    static buildRankUp(member, oldRank, newRank) {
        const isPromotion = newRank.minRp >= oldRank.minRp;
        const color = newRank.color || 0x3498db;
        
        let division = "";
        if (newRank.fullName.includes(" III")) division = "_III";
        else if (newRank.fullName.includes(" II")) division = "_II";
        else if (newRank.fullName.includes(" I")) division = "_I";

        const assetKey = newRank.assetKey; 
        const badgePath = path.join(__dirname, "../assets/ranks", `${assetKey}${division}.png`);
        
        let attachment = null;
        if (fs.existsSync(badgePath)) {
            attachment = new AttachmentBuilder(badgePath, { name: "rank_badge.png" });
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ 
                name: "SYSTÈME DE PROGRESSION", 
                iconURL: member.guild.iconURL() 
            })
            .setTitle(isPromotion ? "🚀 PROMOTION DE RANG !" : "📉 CHANGEMENT DE RANG")
            .setDescription(
                `🏁 **Félicitations ${member} !**\n\n` +
                `Tu as gravi les échelons et tu es désormais :\n` +
                `**${oldRank.fullName}** ➔ **${newRank.fullName}**`
            )
            .addFields(
                { name: "📈 Nouveau Rang", value: `**${newRank.fullName}**`, inline: true },
                { name: "💎 RP Total", value: `\`${newRank.minRp} RP\``, inline: true }
            )
            .setFooter({ text: "Continue ton ascension vers le sommet !" })
            .setTimestamp();

        if (attachment) {
            embed.setThumbnail("attachment://rank_badge.png");
        }

        return { embed, attachment };
    }

    static buildLevelUp(member, newLevel) {
        const isSpecialLevel = newLevel % 5 === 0;
        const color = isSpecialLevel ? 0xffd700 : 0x00ff00;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ 
                name: "PROGRESSION DE NIVEAU", 
                iconURL: member.guild.iconURL() 
            })
            .setTitle(isSpecialLevel ? "🎊 PALIER ATTEINT !" : "✨ NIVEAU SUPÉRIEUR !")
            .setDescription(
                `🔥 **Incroyable ${member} !**\n\n` +
                `Ton activité sur le serveur porte ses fruits.\n` +
                `Tu viens de passer **Niveau ${newLevel}** !`
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "📊 Nouveau Niveau", value: `\`Niveau ${newLevel}\``, inline: true },
                { name: "✨ Bonus", value: isSpecialLevel ? "Récompense de palier !" : "XP doublé ?", inline: true }
            )
            .setFooter({ text: "Plus tu parles, plus tu montes !" })
            .setTimestamp();

        return { embed };
    }
}

module.exports = LevelEmbedBuilder;
