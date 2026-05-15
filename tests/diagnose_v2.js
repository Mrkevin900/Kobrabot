require("dotenv").config();
const KobralostAPI = require("../src/utils/KobralostAPI");

async function diagnose() {
    const mockClient = {
        getLogger: () => ({
            send: (msg, type) => console.log(`[${type}] ${msg}`)
        })
    };
    const api = new KobralostAPI(mockClient);
    
    console.log("=========================================");
    console.log("🚀 KOBRALOST API V2 MASTER DIAGNOSTICS");
    console.log("=========================================");
    console.log(`Base URL: ${api.baseURL}`);
    console.log(`Server URL: ${api.serverBaseURL}`);
    console.log(`Server ID: ${api.serverId}`);
    console.log(`Guild ID: ${api.guildId}`);
    console.log("-----------------------------------------");

    // 1. Connection Test
    console.log("\n[STEP 1] Testing Connection...");
    const conn = await api.testConnection();
    if (!conn) {
        console.error("❌ Connection failed. Check your API_TOKEN and API_BASE_URL.");
    } else {
        console.log("✅ Connection OK.");
    }

    // 2. Fetch Players List
    console.log("\n[STEP 2] Fetching Players List...");
    const players = await api.getPlayersList({ perpage: 5 });
    if (players.success) {
        console.log(`✅ Fetched ${players.data.length} players.`);
        if (players.data.length > 0) {
            console.log(`   Sample: ${players.data[0].name} (UUID: ${players.data[0].uuid})`);
        }
    } else {
        console.error(`❌ Players fetch failed: ${players.status} ${players.error}`);
    }

    // 3. Search by Discord ID
    const discordId = "1185242224770953427"; // Michel L Cornel
    console.log(`\n[STEP 3] Searching for Discord ID: ${discordId}...`);
    const search = await api.findPlayerByDiscordId(discordId);
    if (search.success) {
        console.log("✅ Match found!");
        console.log(`   Name: ${search.data.name}`);
        console.log(`   UUID: ${search.data.uuid}`);
        console.log(`   Account ID: ${search.data.accountId}`);
    } else {
        console.error(`❌ Search failed: ${search.status} ${search.error}`);
    }

    // 4. Test Punishments (if match found)
    if (search.success) {
        console.log(`\n[STEP 4] Fetching Punishments for ${search.data.name}...`);
        const pun = await api.getAllPunishments(search.data.uuid);
        if (pun.success) {
            console.log(`✅ Fetched ${pun.data.length} punishments.`);
        } else {
            console.error(`❌ Punishments fetch failed: ${pun.status} ${pun.error}`);
        }
    }

    console.log("\n=========================================");
    console.log("🏁 Diagnostics Complete");
    console.log("=========================================");
}

diagnose();
