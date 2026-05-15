const { getDatabase, ensureDatabaseConnection, describeDbError } = require("../database/database");

/**
 * ModerationDb handles persistent logging of all moderation actions.
 * It uses the 'action_logs' table from the main schema.
 */
class ModerationDb {
    static async logAction(client, { 
        guildId, 
        moderatorId, 
        targetId, 
        actionType, 
        reason, 
        details = {} 
    }) {
        const db = await ensureDatabaseConnection(client) || getDatabase();
        if (!db) {
            client.getLogger()?.send("[MOD-DB] Database connection unavailable for logging.", "WARN");
            return null;
        }

        try {
            // Ensure targetId is a string
            const target = targetId ? String(targetId) : null;
            
            const payload = {
                user_id: moderatorId, // Actor
                action_type: actionType,
                target_id: target,
                details: JSON.stringify({
                    reason: reason || "Aucune raison fournie",
                    guild_id: guildId,
                    ...details
                }),
                created_at: new Date()
            };

            const [id] = await db("action_logs").insert(payload);
            
            client.getLogger()?.send(`[MOD-DB] Action ${actionType} logged for target ${target} (Log ID: ${id})`, "DEBUG");
            return id;
        } catch (error) {
            client.getLogger()?.send(`[MOD-DB] Error logging action: ${describeDbError(error)}`, "ERROR");
            return null;
        }
    }

    /**
     * Helper for Warn action
     */
    static async logWarn(client, guildId, moderatorId, targetId, reason) {
        return this.logAction(client, {
            guildId,
            moderatorId,
            targetId,
            actionType: "WARN",
            reason
        });
    }

    /**
     * Helper for Ban action
     */
    static async logBan(client, guildId, moderatorId, targetId, reason, duration = null) {
        return this.logAction(client, {
            guildId,
            moderatorId,
            targetId,
            actionType: duration ? "TEMPBAN" : "BAN",
            reason,
            details: { duration }
        });
    }

    /**
     * Helper for Kick action
     */
    static async logKick(client, guildId, moderatorId, targetId, reason) {
        return this.logAction(client, {
            guildId,
            moderatorId,
            targetId,
            actionType: "KICK",
            reason
        });
    }

    /**
     * Helper for Mute action
     */
    static async logMute(client, guildId, moderatorId, targetId, reason, duration = null) {
        return this.logAction(client, {
            guildId,
            moderatorId,
            targetId,
            actionType: "MUTE",
            reason,
            details: { duration }
        });
    }
    
    /**
     * Helper for Clear action
     */
    static async logClear(client, guildId, moderatorId, channelId, amount) {
        return this.logAction(client, {
            guildId,
            moderatorId,
            targetId: channelId,
            actionType: "CLEAR",
            reason: `${amount} messages supprimés`,
            details: { amount }
        });
    }

    /**
     * Fetch all punishments for a target from the database
     */
    static async getPunishments(client, targetId) {
        const db = await ensureDatabaseConnection(client) || getDatabase();
        if (!db) return [];

        try {
            const rows = await db("action_logs")
                .where({ target_id: String(targetId) })
                .orderBy("created_at", "desc");
            
            return rows.map(row => ({
                id: row.id,
                type: row.action_type.toLowerCase(),
                reason: JSON.parse(row.details || "{}").reason || "Aucune raison",
                date: row.created_at,
                moderator: row.user_id,
                details: JSON.parse(row.details || "{}")
            }));
        } catch (error) {
            client.getLogger()?.send(`[MOD-DB] Error fetching punishments: ${describeDbError(error)}`, "ERROR");
            return [];
        }
    }
}

module.exports = ModerationDb;
