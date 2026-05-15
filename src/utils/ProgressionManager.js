const { getCurrentRankInfo } = require("./RankConfig");

/**
 * ProgressionManager handles XP, Level, RP (Ranks), and Streaks.
 * It requires a database connection (Knex) to function.
 */
class ProgressionManager {
    constructor(client) {
        this.client = client;
        this.xpCooldowns = new Map();
        
        // Configuration via .env
        this.XP_BASE = parseInt(process.env.XP_GAIN_BASE) || 18;
        this.XP_RANDOM = parseInt(process.env.XP_GAIN_RANDOM) || 10;
        this.COOLDOWN_MS = parseInt(process.env.XP_COOLDOWN_MS) || 5000;
        this.MSG_MIN_LENGTH = 2;
        
        // Streak conditions
        this.STREAK_MSG_REQUIRED = 10;
        this.STREAK_VOICE_REQUIRED_MS = 30 * 60 * 1000;
        
        this.voiceInterval = null;
    }

    /**
     * Resilient database update with retry logic.
     */
    async safeUpdate(db, userId, payload, retryCount = 3) {
        for (let i = 0; i < retryCount; i++) {
            try {
                await db("user_progression").where({ user_id: userId }).update(payload);
                return true;
            } catch (error) {
                if (i === retryCount - 1) throw error;
                this.client.getLogger().send(`DB Update Retry ${i+1}/${retryCount} for ${userId}: ${error.message}`, "WARN");
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    /**
     * Start the voice tracking loop.
     * Rewards members in voice channels with XP/RP.
     */
    startVoiceTracking() {
        if (this.voiceInterval) clearInterval(this.voiceInterval);
        
        this.voiceInterval = setInterval(() => {
            this.client.guilds.cache.forEach(guild => {
                guild.channels.cache
                    .filter(c => c.type === 2) // GuildVoice
                    .forEach(channel => {
                        if (channel.members.size < 2) return; // Anti-AFK

                        channel.members.forEach(member => {
                            if (member.user.bot) return;
                            if (member.voice.selfDeaf || member.voice.selfMute) return;
                            
                            this.addVoiceTime(member.id, 60000); // +1 minute
                        });
                    });
            });
        }, 60000);
    }

    getXpRequired(level) {
        const base = parseInt(process.env.XP_LEVEL_UP_LIMIT) || 100;
        const exponent = parseFloat(process.env.XP_LEVEL_EXPONENT) || 1.5;
        return Math.floor(base * Math.pow(level, exponent));
    }

    getMultiplier(streak) {
        if (streak >= 101) return 3.0;
        if (streak >= 31) return 2.5;
        if (streak >= 15) return 2.0;
        if (streak >= 8) return 1.5;
        if (streak >= 3) return 1.2;
        return 1.0;
    }

    /**
     * Call this on every message to process XP gain.
     */
    async handleMessage(message) {
        if (message.author.bot || !message.guild) return;
        if (message.content.length < this.MSG_MIN_LENGTH) return;

        const userId = message.author.id;
        const now = Date.now();
        
        const lastGain = this.xpCooldowns.get(userId) || 0;
        if (now - lastGain < this.COOLDOWN_MS) return;
        
        this.xpCooldowns.set(userId, now);

        // Adjust this to your database provider
        const db = this.client.database?.getDatabase();
        if (!db) return;

        try {
            let data = await db("user_progression").where({ user_id: userId }).first();
            
            if (!data) {
                await db("user_progression").insert({
                    user_id: userId,
                    xp: 0,
                    level: 1,
                    streak_count: 0,
                    last_active_date: null
                });
                data = { xp: 0, level: 1, streak_count: 0, daily_msg_count: 0, rp: 0 };
            }

            const multiplier = this.getMultiplier(data.streak_count);
            
            // Server Boost detection (Nitro Boost)
            let serverBoostMultiplier = 1.0;
            if (message.member && message.member.premiumSince) {
                serverBoostMultiplier = 2.0;
            }

            // Temporary Boosts (from items/events)
            let boostMultiplier = 1.0;
            try {
                const boost = await db("user_boosts").where({ user_id: userId }).first();
                if (boost) {
                    if (new Date() < new Date(boost.expires_at)) {
                        boostMultiplier = boost.multiplier;
                    } else {
                        await db("user_boosts").where({ user_id: userId }).delete().catch(() => {});
                    }
                }
            } catch (e) {
                // Silently skip boost check if table missing, but log it
                this.client.getLogger().send(`Boost check error: ${e.message}`, "DEBUG");
            }

            const baseGain = this.XP_BASE + Math.floor(Math.random() * this.XP_RANDOM);
            const finalGain = Math.floor(baseGain * multiplier * boostMultiplier * serverBoostMultiplier);

            const newXp = data.xp + finalGain;
            const newRp = (data.rp || 0) + Math.floor(finalGain * 0.7);
            const nextLevelXp = this.getXpRequired(data.level);
            
            let newLevel = data.level;
            let leveledUp = false;

            if (newXp >= nextLevelXp) {
                newLevel++;
                leveledUp = true;
            }

            const today = new Date().toISOString().split('T')[0];
            const newMsgCount = (data.daily_msg_count || 0) + 1;
            
            let updatePayload = {
                xp: newXp,
                rp: newRp,
                level: newLevel,
                daily_msg_count: newMsgCount
            };

            if (newMsgCount >= this.STREAK_MSG_REQUIRED && data.last_active_date !== today) {
                updatePayload.last_active_date = today;
                updatePayload.is_frozen = false;
                if (data.streak_count === 0) updatePayload.streak_count = 1;
            }

            const oldRank = getCurrentRankInfo(data.rp || 0);
            const newRank = getCurrentRankInfo(newRp);

            await this.safeUpdate(db, userId, updatePayload);

            if (newRank.fullName !== oldRank.fullName) {
                this.client.emit("userRankUp", message.member, oldRank, newRank);
            }

            if (leveledUp) {
                this.client.emit("userLevelUp", message.member, newLevel);
            }

        } catch (error) {
            this.client.getLogger().send(`Error in ProgressionManager.handleMessage: ${error.message}`, "ERROR");
        }
    }

    async addVoiceTime(userId, ms) {
        const db = this.client.database?.getDatabase();
        if (!db) return;

        try {
            let data = await db("user_progression").where({ user_id: userId }).first();
            if (!data) {
                await db("user_progression").insert({ user_id: userId, xp: 0, level: 1, streak_count: 0 });
                data = { xp: 0, level: 1, streak_count: 0, daily_voice_ms: 0, rp: 0 };
            }

            const newVoiceMs = (data.daily_voice_ms || 0) + ms;
            const today = new Date().toISOString().split('T')[0];
            
            const multiplier = this.getMultiplier(data.streak_count);
            
            // Server Boost detection
            let serverBoostMultiplier = 1.0;
            this.client.guilds.cache.forEach(guild => {
                const member = guild.members.cache.get(userId);
                if (member && member.premiumSince) serverBoostMultiplier = 2.0;
            });

            const baseGain = Math.floor(this.XP_BASE / 2);
            const finalGain = Math.floor(baseGain * multiplier * serverBoostMultiplier);

            const newXp = (data.xp || 0) + finalGain;
            const newRp = (data.rp || 0) + Math.floor(finalGain * 0.8);
            const nextLevelXp = this.getXpRequired(data.level);
            
            let newLevel = data.level;
            let leveledUp = false;

            if (newXp >= nextLevelXp) {
                newLevel++;
                leveledUp = true;
            }

            let updatePayload = { 
                daily_voice_ms: newVoiceMs,
                xp: newXp,
                rp: newRp,
                level: newLevel
            };

            if (newVoiceMs >= this.STREAK_VOICE_REQUIRED_MS && data.last_active_date !== today) {
                updatePayload.last_active_date = today;
                updatePayload.is_frozen = false;
                if (data.streak_count === 0) updatePayload.streak_count = 1;
            }

            const oldRank = getCurrentRankInfo(data.rp || 0);
            const newRank = getCurrentRankInfo(newRp);

            await this.safeUpdate(db, userId, updatePayload);

            if (newRank.fullName !== oldRank.fullName) {
                this.client.guilds.cache.forEach(guild => {
                    const member = guild.members.cache.get(userId);
                    if (member) this.client.emit("userRankUp", member, oldRank, newRank);
                });
            }

            if (leveledUp) {
                this.client.guilds.cache.forEach(guild => {
                    const member = guild.members.cache.get(userId);
                    if (member) this.client.emit("userLevelUp", member, newLevel);
                });
            }
        } catch (error) {
            this.client.getLogger().send(`Error in ProgressionManager.addVoiceTime: ${error.message}`, "ERROR");
        }
    }

    async addMatchResult(userId, isWin) {
        const db = this.client.database?.getDatabase();
        if (!db) return null;

        try {
            let data = await db("user_progression").where({ user_id: userId }).first();
            if (!data) {
                await db("user_progression").insert({ user_id: userId, xp: 0, level: 1, streak_count: 0 });
                data = await db("user_progression").where({ user_id: userId }).first();
            }

            const multiplier = this.getMultiplier(data.streak_count);
            
            // Server Boost detection
            let serverBoostMultiplier = 1.0;
            this.client.guilds.cache.forEach(guild => {
                const member = guild.members.cache.get(userId);
                if (member && member.premiumSince) serverBoostMultiplier = 2.0;
            });

            const baseGainXp = isWin ? (40 + Math.floor(Math.random() * 20)) : (15 + Math.floor(Math.random() * 10));
            const baseGainRp = isWin ? (25 + Math.floor(Math.random() * 15)) : (5 + Math.floor(Math.random() * 5));
            
            const xpGain = Math.floor(baseGainXp * multiplier * serverBoostMultiplier);
            const rpGain = Math.floor(baseGainRp * multiplier * serverBoostMultiplier);

            const finalXpGain = xpGain;
            const finalRpGain = rpGain;

            const newXp = data.xp + finalXpGain;
            const newRp = (data.rp || 0) + finalRpGain;
            
            const nextLevelXp = this.getXpRequired(data.level);
            let newLevel = data.level;
            let leveledUp = false;
            if (newXp >= nextLevelXp) {
                newLevel++;
                leveledUp = true;
            }

            const oldRank = getCurrentRankInfo(data.rp || 0);
            const newRank = getCurrentRankInfo(newRp);

            await this.safeUpdate(db, userId, {
                xp: newXp,
                rp: newRp,
                level: newLevel
            });

            const member = await this.client.guilds.cache.first()?.members.fetch(userId).catch(() => null);

            if (newRank.fullName !== oldRank.fullName && member) {
                this.client.emit("userRankUp", member, oldRank, newRank);
            }

            if (leveledUp && member) {
                this.client.emit("userLevelUp", member, newLevel);
            }

            return {
                xpGain: finalXpGain,
                rpGain: finalRpGain,
                newXp,
                newRp,
                rankUp: newRank.fullName !== oldRank.fullName,
                oldRank,
                newRank
            };

        } catch (error) {
            this.client.getLogger().send(`Error in addMatchResult: ${error.message}`, "ERROR");
            return null;
        }
    }

    async initializeUser(userId) {
        const db = this.client.database?.getDatabase();
        if (!db) return null;

        try {
            const data = await db("user_progression").where({ user_id: userId }).first();
            if (!data) {
                await db("user_progression").insert({
                    user_id: userId,
                    xp: 0,
                    level: 1,
                    streak_count: 0,
                    rp: 0
                });
                return { user_id: userId, xp: 0, level: 1, streak_count: 0, rp: 0 };
            }
            return data;
        } catch (error) {
            this.client.getLogger().send(`Error in ProgressionManager.initializeUser: ${error.message}`, "ERROR");
            return null;
        }
    }

    /**
     * Daily maintenance task. Call this once a day at midnight.
     */
    async processDailyUpdate() {
        const db = this.client.database?.getDatabase();
        if (!db) return;

        const todayStr = new Date().toISOString().split('T')[0];

        try {
            // 1. Update streaks for active users
            const activeUsersToday = await db("user_progression").where("last_active_date", todayStr);
            for (const user of activeUsersToday) {
                const newStreak = user.streak_count + 1;
                let newShields = user.streak_shields;
                if (newStreak % 30 === 0 && newShields < 3) newShields++;

                await db("user_progression").where({ user_id: user.user_id }).update({ 
                    streak_count: newStreak,
                    streak_shields: newShields
                });
            }

            // 2. Handle inactive users (Penalties)
            const inactiveUsers = await db("user_progression")
                .whereNot("last_active_date", todayStr)
                .orWhereNull("last_active_date");

            for (const user of inactiveUsers) {
                if (user.streak_count === 0) continue;

                if (user.streak_shields > 0) {
                    await db("user_progression")
                        .where({ user_id: user.user_id })
                        .update({ 
                            streak_shields: user.streak_shields - 1,
                            last_active_date: todayStr
                        });
                } else if (!user.is_frozen) {
                    await db("user_progression").where({ user_id: user.user_id }).update({ is_frozen: true });
                } else {
                    let newStreak = user.streak_count > 10 ? Math.floor(user.streak_count / 2) : 0;
                    await db("user_progression").where({ user_id: user.user_id }).update({ 
                        streak_count: newStreak,
                        is_frozen: false 
                    });
                }
            }

            // 3. Reset daily counters
            await db("user_progression").update({ daily_msg_count: 0, daily_voice_ms: 0 });

        } catch (error) {
            this.client.getLogger().send(`Error in ProgressionManager.processDailyUpdate: ${error.message}`, "ERROR");
        }
    }
}

module.exports = ProgressionManager;
