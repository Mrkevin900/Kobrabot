require("dotenv").config();
const KobralostAPI = require("../src/utils/KobralostAPI");

async function diagnose() {
    const mockClient = {
        getLogger: () => ({
            send: (msg, type) => console.log(`[${type}] ${msg}`)
        })
    };
    const api = new KobralostAPI(mockClient);
    
    // 1. Get a player from the list to have a valid UUID and maybe Discord ID
    console.log("--- Step 1: Fetching players list ---");
    const list = await api.getPlayersList({ perpage: 5 });
    if (!list.success) {
        console.error("List fetch failed:", list.error);
        return;
    }

    for (const player of list.data) {
        console.log(`\nDiagnosing player: ${player.name} (UUID: ${player.uuid})`);
        
        // Try getPlayerStatus (New)
        const status = await api.getPlayerStatus(player.uuid);
        console.log(`  getPlayerStatus: ${status.success ? "✅ OK" : "❌ 404"}`);
        
        // Try getPlayerByUuid (New)
        const byUuid = await api.getPlayerByUuid(player.uuid);
        console.log(`  getPlayerByUuid: ${byUuid.success ? "✅ OK" : "❌ 404"}`);
        
        // Try legacy getPlayer (hits /player/:userId)
        // If 'id' is Discord ID, let's try it
        if (player.id) {
            const legacy = await api.getPlayer(player.id);
            console.log(`  getPlayer (/player/${player.id}): ${legacy.success ? "✅ OK" : "❌ 404"}`);
            
            const members = await api.getMember(player.id);
            console.log(`  getMember (/members/${player.id}): ${members.success ? "✅ OK" : "❌ 404"}`);
            
            // Try new /players/:userId if it supports Discord ID
            const serverLevelId = await api._request("GET", `/players/${player.id}`, null, 1, true);
            console.log(`  /players/${player.id} (Server Level): ${serverLevelId.success ? "✅ OK" : "❌ 404"}`);
        }
    }
}

diagnose();
