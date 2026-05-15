require("dotenv").config();
const KobralostAPI = require("../src/utils/KobralostAPI");

async function scan() {
    const mockClient = {
        getLogger: () => ({
            send: (msg, type) => console.log(`[${type}] ${msg}`)
        })
    };
    const api = new KobralostAPI(mockClient);
    
    console.log("Scanning first 50 players to find a Discord link...");
    const list = await api.getPlayersList({ perpage: 50 });
    
    if (list.success) {
        for (const p of list.data) {
            const full = await api.getPlayerByUuid(p.uuid);
            if (full.success) {
                // Look for anything that looks like a Discord ID (17-19 digits)
                const dataStr = JSON.stringify(full.data);
                const match = dataStr.match(/\d{17,19}/);
                if (match) {
                    console.log(`\nPossible Discord ID found for ${p.name} (UUID: ${p.uuid}): ${match[0]}`);
                    console.log(`  Data fragment: ${dataStr.substring(dataStr.indexOf(match[0]) - 20, dataStr.indexOf(match[0]) + 40)}`);
                    
                    // Now try to see WHICH endpoint works for this ID
                    const id = match[0];
                    const members = await api.getMember(id);
                    console.log(`  getMember (/members/${id}): ${members.success ? "✅ OK" : "❌ " + members.status}`);
                    
                    const player = await api.getPlayer(id);
                    console.log(`  getPlayer (/player/${id}): ${player.success ? "✅ OK" : "❌ " + player.status}`);
                    
                    // Try different guild IDs if we have any
                    const guildIds = ["836244875720523807", "1438996721198825604"];
                    for (const gid of guildIds) {
                        const url = `https://dashboard.kobralost-rp.com/api/v2/1/${gid}/members/${id}`;
                        try {
                            const res = await require("axios").get(url, { headers: { Authorization: `Bearer ${process.env.API_TOKEN}` } });
                            console.log(`  URL SUCCESS! ${url}`);
                        } catch (e) {}
                    }
                }
            }
        }
    }
}

scan();
