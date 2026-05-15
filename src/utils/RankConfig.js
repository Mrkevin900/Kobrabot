const RANKS_CONFIG = [
    { name: "Transcendant", assetKey: "transcendant", roleKey: "ROLE_TRANSCENDANT", minRp: 50000, color: 0xffffff, emoji: "✨", divisions: [] },
    { name: "Légende", assetKey: "legende", roleKey: "ROLE_LEGENDE", minRp: 45000, color: 0xffd700, emoji: "🏆", divisions: [] },
    { name: "Grand Champion", assetKey: "grand_champion", roleKey: "ROLE_GRAND_CHAMPION", minRp: 40000, color: 0xff4757, emoji: "👑", divisions: [] },
    
    { name: "Champion", assetKey: "champion", roleKey: "ROLE_CHAMPION", minRp: 34000, color: 0x3498db, emoji: "🔱", divisions: [
        { name: "Champion III", minRp: 38000 },
        { name: "Champion II", minRp: 36000 },
        { name: "Champion I", minRp: 34000 }
    ]},
    
    { name: "Élite", assetKey: "elite", roleKey: "ROLE_ELITE", minRp: 28000, color: 0x2ecc71, emoji: "🔰", divisions: [
        { name: "Élite III", minRp: 32000 },
        { name: "Élite II", minRp: 30000 },
        { name: "Élite I", minRp: 28000 }
    ]},
    
    { name: "Hors Classé", assetKey: "hors_classe", roleKey: "ROLE_HORS_CLASSE", minRp: 22000, color: 0xe67e22, emoji: "🚀", divisions: [
        { name: "Hors Classé III", minRp: 26000 },
        { name: "Hors Classé II", minRp: 24000 },
        { name: "Hors Classé I", minRp: 22000 }
    ]},
    
    { name: "Maître", assetKey: "maitre", roleKey: "ROLE_MAITRE", minRp: 17000, color: 0x9b59b6, emoji: "🎭", divisions: [
        { name: "Maître III", minRp: 20000 },
        { name: "Maître II", minRp: 18500 },
        { name: "Maître I", minRp: 17000 }
    ]},
    
    { name: "Diamant", assetKey: "diamant", roleKey: "ROLE_DIAMOND", minRp: 12500, color: 0x00d2d3, emoji: "🔹", divisions: [
        { name: "Diamant III", minRp: 15500 },
        { name: "Diamant II", minRp: 14000 },
        { name: "Diamant I", minRp: 12500 }
    ]},
    
    { name: "Platine", assetKey: "platine", roleKey: "ROLE_PLATINUM", minRp: 8500, color: 0x48dbfb, emoji: "💠", divisions: [
        { name: "Platine III", minRp: 11000 },
        { name: "Platine II", minRp: 9500 },
        { name: "Platine I", minRp: 8500 }
    ]},
    
    { name: "Or", assetKey: "or", roleKey: "ROLE_GOLD", minRp: 5000, color: 0xfeca57, emoji: "🟡", divisions: [
        { name: "Or III", minRp: 7500 },
        { name: "Or II", minRp: 6200 },
        { name: "Or I", minRp: 5000 }
    ]},
    
    { name: "Argent", assetKey: "argent", roleKey: "ROLE_SILVER", minRp: 2000, color: 0xc8d6e5, emoji: "⚪", divisions: [
        { name: "Argent III", minRp: 4000 },
        { name: "Argent II", minRp: 3000 },
        { name: "Argent I", minRp: 2000 }
    ]},
    
    { name: "Bronze", assetKey: "bronze", roleKey: "ROLE_BRONZE", minRp: 500, color: 0xcd7f32, emoji: "🟤", divisions: [
        { name: "Bronze III", minRp: 1500 },
        { name: "Bronze II", minRp: 1000 },
        { name: "Bronze I", minRp: 500 }
    ]},
    
    { name: "Non classé", assetKey: "unranked", roleKey: null, minRp: 0, color: 0x2f3640, emoji: "⚫", divisions: [] }
];

function getAllTiers() {
    const tiers = [];
    for (const rank of RANKS_CONFIG) {
        if (rank.divisions && rank.divisions.length > 0) {
            for (const div of rank.divisions) {
                tiers.push({
                    ...rank,
                    fullName: div.name,
                    minRp: div.minRp,
                    isDivision: true
                });
            }
        } else {
            tiers.push({
                ...rank,
                fullName: rank.name,
                minRp: rank.minRp,
                isDivision: false
            });
        }
    }
    return tiers.sort((a, b) => b.minRp - a.minRp);
}

function getCurrentRankInfo(rp) {
    const val = Number(rp) || 0;
    const allTiers = getAllTiers();
    
    const tierIndex = allTiers.findIndex(t => val >= t.minRp);
    const currentTier = tierIndex !== -1 ? allTiers[tierIndex] : allTiers[allTiers.length - 1];
    
    const nextTier = tierIndex > 0 ? allTiers[tierIndex - 1] : null;
    const prevTier = tierIndex < allTiers.length - 1 ? allTiers[tierIndex + 1] : null;

    return {
        ...currentTier,
        nextRp: nextTier ? nextTier.minRp : Infinity,
        currentTierMin: currentTier.minRp,
        nextTier,
        prevTier
    };
}

module.exports = { RANKS_CONFIG, getCurrentRankInfo, getAllTiers };
