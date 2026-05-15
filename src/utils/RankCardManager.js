const { createCanvas, loadImage } = require("canvas");
const path = require("path");
const fs = require("fs");
const { RANKS_CONFIG } = require("./RankConfig");

/**
 * RankCardManager generates the profile image (rank card) using Canvas.
 */
class RankCardManager {
    constructor(client) {
        this.client = client;
        // Paths relative to src/utils
        this.assetsPath = path.join(__dirname, "../assets");
        this.backgroundPath = path.join(this.assetsPath, "rl_card_bg.png");
    }

    async generateCard(targetUser, data, rankInfo) {
        const canvas = createCanvas(1200, 700);
        const ctx = canvas.getContext("2d");

        // 1. Background
        try {
            if (fs.existsSync(this.backgroundPath)) {
                this.client.getLogger().send(`RankCard: Loading background...`, "DEBUG");
                const background = await loadImage(this.backgroundPath);
                ctx.drawImage(background, 0, 0, 1200, 700);
                
                // Add a sleek glassmorphism overlay
                ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
                ctx.fillRect(0, 0, 1200, 700);
            } else {
                this.client.getLogger().send(`RankCard: Background missing, using gradient`, "DEBUG");
                const grad = ctx.createLinearGradient(0, 0, 1200, 700);
                grad.addColorStop(0, "#0f2027");
                grad.addColorStop(0.5, "#203a43");
                grad.addColorStop(1, "#2c5364");
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 1200, 700);
            }
        } catch (e) {
            this.client.getLogger().send(`RankCard: Background error: ${e.message}`, "ERROR");
            ctx.fillStyle = "#05161a";
            ctx.fillRect(0, 0, 1200, 700);
        }

        // 2. Header (Avatar + Name + Icons)
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.arc(80, 80, 50, 0, Math.PI * 2);
        ctx.clip();
        try {
            const avatar = await loadImage(targetUser.displayAvatarURL({ extension: "png", size: 256 }));
            ctx.drawImage(avatar, 30, 30, 100, 100);
        } catch (e) {}
        ctx.restore();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 42px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(targetUser.username, 160, 75);
        
        // Icônes Flamme, Bouclier et Karma
        try {
            const flameImg = await loadImage(path.join(this.assetsPath, "flame.png"));
            const shieldImg = await loadImage(path.join(this.assetsPath, "shield.png"));
            
            // Dessin Flammes
            ctx.drawImage(flameImg, 140, 100, 25, 25);
            ctx.font = "bold 20px sans-serif";
            ctx.fillStyle = "#ff9f43";
            ctx.fillText(data.streak_count || "0", 175, 120);
            
            // Dessin Boucliers
            ctx.drawImage(shieldImg, 220, 100, 25, 25);
            ctx.fillStyle = "#54a0ff";
            ctx.fillText(data.streak_shields || "0", 255, 120);

            // Dessin Karma (Points)
            ctx.font = "bold 20px sans-serif";
            ctx.fillStyle = (data.karma >= 8) ? "#ff4757" : "#7bed9f";
            ctx.fillText(`KARMA: ${data.karma || 0}/10`, 310, 120);
        } catch (e) {
            // Fallback si icônes absentes
            ctx.font = "20px sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.fillText(`🔥 ${data.streak_count || 0}  🛡️ ${data.streak_shields || 0}  ⚖️ ${data.karma || 0}/10`, 140, 110);
        }

        // 3. Badges (Dynamic from API)
        if (data.badges && data.badges.length > 0) {
            const badgeSize = 60;
            const badgeSpacing = 15;
            const maxVisibleBadges = 6;
            const visibleBadges = data.badges.slice(0, maxVisibleBadges);
            const totalWidth = (visibleBadges.length * badgeSize) + ((visibleBadges.length - 1) * badgeSpacing);
            let startX = 600 - (totalWidth / 2);
            const badgeY = 165;

            for (const b of visibleBadges) {
                try {
                    // Assuming badge image URL is available or mapped
                    const imgUrl = b.image || b.icon;
                    if (imgUrl) {
                        const bImg = await loadImage(imgUrl);
                        ctx.save();
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = "rgba(255,255,255,0.4)";
                        ctx.drawImage(bImg, startX, badgeY, badgeSize, badgeSize);
                        ctx.restore();
                    }
                } catch (e) {}
                startX += badgeSize + badgeSpacing;
            }
        }

        // 4. Rank and Badges
        const rp = data.rp || 0;
        const currentRank = rankInfo;
        
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 72px sans-serif";
        ctx.shadowBlur = 25;
        ctx.shadowColor = "rgba(0,0,0,1)";
        ctx.fillText(currentRank.fullName.toUpperCase(), 600, 140);
        ctx.shadowBlur = 0;

        // Main Badge Calibration
        await this.drawBadge(ctx, 600, 360, 420, currentRank, currentRank.color); // Agrandi de 380 à 420
        
        if (currentRank.prevTier) {
            ctx.globalAlpha = 0.4;
            await this.drawBadge(ctx, 220, 350, 200, currentRank.prevTier, "#7f8c8d");
            ctx.font = "bold 24px sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.fillText("PRÉCÉDENT", 220, 210);
            ctx.globalAlpha = 1.0;
        }

        if (currentRank.nextTier) {
            ctx.globalAlpha = 0.4;
            await this.drawBadge(ctx, 980, 350, 200, currentRank.nextTier, "#ffffff");
            ctx.font = "bold 24px sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.fillText("SUIVANT", 980, 210);
            ctx.globalAlpha = 1.0;
        }

        // 4. RP and Progress Bar
        const nextRp = currentRank.nextRp;
        const currentTierMin = currentRank.currentTierMin;
        const targetInTier = (nextRp === Infinity || nextRp === currentTierMin) ? 5000 : nextRp - currentTierMin;
        const progressInTier = Math.max(0, rp - currentTierMin);
        const percentage = Math.min(Math.max(progressInTier / targetInTier, 0), 1);

        ctx.font = "bold 55px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${rp.toLocaleString()} RP`, 600, 580);

        const barX = 200;
        const barY = 620;
        const barW = 800;
        const barH = 35;

        // Background of the bar
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 20);
        else ctx.rect(barX, barY, barW, barH);
        ctx.fill();

        // Fill of the bar
        const barGradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        barGradient.addColorStop(0, "#00d2ff");
        barGradient.addColorStop(1, "#3a7bd5");
        
        const safePercentage = isNaN(percentage) ? 0 : percentage;
        const fillWidth = Math.max(barH, barW * safePercentage); 

        ctx.save();
        // N'appliquer l'ombre que si la barre est un peu remplie pour éviter l'effet "rond"
        if (safePercentage > 0.05) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#00d2ff";
        }
        
        ctx.fillStyle = barGradient;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(barX, barY, fillWidth, barH, 20);
        else ctx.rect(barX, barY, fillWidth, barH);
        ctx.fill();
        ctx.restore();

        ctx.font = "bold 32px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${Math.round(percentage * 100)} %`, 600, 680);

        return canvas.toBuffer();
    }

    async drawBadge(ctx, x, y, size, rankInfo, fallbackColor) {
        let division = "";
        if (rankInfo.fullName.includes(" III")) division = "_III";
        else if (rankInfo.fullName.includes(" II")) division = "_II";
        else if (rankInfo.fullName.includes(" I")) division = "_I";

        const assetKey = rankInfo.assetKey;
        const badgePath = path.join(this.assetsPath, `ranks/${assetKey}${division}.png`);
        
        ctx.save();
        ctx.translate(x, y);

        let imgToLoad = null;
        if (fs.existsSync(badgePath)) {
            imgToLoad = badgePath;
        } else {
            const genericPath = path.join(this.assetsPath, `ranks/${assetKey}.png`);
            if (fs.existsSync(genericPath)) imgToLoad = genericPath;
        }

        if (imgToLoad) {
            try {
                const badgeImg = await loadImage(imgToLoad);
                
                // Calibration logic: Center and contain while maintaining aspect ratio
                const ratio = Math.min(size / badgeImg.width, size / badgeImg.height);
                const drawW = badgeImg.width * ratio;
                const drawH = badgeImg.height * ratio;

                // Multi-layered shadow for intense glow
                ctx.shadowBlur = 60;
                ctx.shadowColor = fallbackColor || "#ffffff";
                ctx.drawImage(badgeImg, -drawW / 2, -drawH / 2, drawW, drawH);
                
                ctx.shadowBlur = 45;
                ctx.shadowColor = fallbackColor || "#ffffff";
                ctx.drawImage(badgeImg, -drawW / 2, -drawH / 2, drawW, drawH);
            } catch (e) {
                this.drawFallbackBadge(ctx, size, fallbackColor);
            }
        } else {
            this.drawFallbackBadge(ctx, size, fallbackColor);
        }
        
        ctx.restore();
    }

    drawFallbackBadge(ctx, size, color) {
        const drawColor = color || "#ffffff";
        ctx.shadowBlur = 30;
        ctx.shadowColor = drawColor;
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.moveTo(0, -size/2);
        ctx.lineTo(size/2, 0);
        ctx.lineTo(0, size/2);
        ctx.lineTo(-size/2, 0);
        ctx.closePath();
        ctx.fill();
    }
}

module.exports = RankCardManager;

