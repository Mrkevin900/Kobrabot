const axios = require("axios");

class ApiDiagnostics {
    constructor(api) {
        this.api = api;
        this.logger = api.logger;
    }

    async runAll() {
        this.logger?.send("🚀 [DIAGNOSTICS] Démarrage des tests API complets...", "INFO");
        
        const results = {
            connection: false,
            players: false,
            members: false,
            punishments: false
        };

        // 1. Connection Test
        results.connection = await this.api.testConnection();

        // 2. Players List Test
        const players = await this.api.getPlayersList({ perpage: 5 });
        results.players = players.success;
        if (players.success) {
            this.logger?.send(`✅ [DIAGNOSTICS] Players API OK (${players.data.length} joueurs)`, "READY");
        }

        // 3. Members Sync Test (Requires correct guild path)
        const members = await this.api.getMember("test"); // Should return 404 but success=true in terms of connectivity
        results.members = (members.status === 404 || members.status === 200);
        if (results.members) {
            this.logger?.send("✅ [DIAGNOSTICS] Members Sync Path OK", "READY");
        }

        // 4. Punishments Test (Requires a valid UUID if possible)
        if (players.success && players.data.length > 0) {
            const uuid = players.data[0].uuid;
            const punishments = await this.api.getAllPunishments(uuid);
            results.punishments = punishments.success || punishments.status === 403;
            if (punishments.status === 403) {
                this.logger?.send("⚠️ [DIAGNOSTICS] Punishments: Accès restreint (403)", "WARN");
            } else if (punishments.success) {
                this.logger?.send("✅ [DIAGNOSTICS] Punishments API OK", "READY");
            }
        }

        this.logger?.send("🏁 [DIAGNOSTICS] Tests terminés.", "INFO");
        return results;
    }
}

module.exports = ApiDiagnostics;
