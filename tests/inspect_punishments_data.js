require("dotenv").config();
const KobralostAPI = require("../src/utils/KobralostAPI");

async function test() {
    const mockClient = {
        getLogger: () => ({
            send: (msg, type) => console.log(`[${type}] ${msg}`)
        })
    };
    const api = new KobralostAPI(mockClient);
    
    // Set the working guild ID for this test
    api.guildId = "836244875720523807";
    api.baseURL = `https://dashboard.kobralost-rp.com/api/v2/1/${api.guildId}`;

    const uuid = "76561198107512648"; // Yannis Nemmour
    console.log(`Fetching punishments for UUID: ${uuid}...`);
    const result = await api.getAllPunishments(uuid);
    
    if (result.success) {
        console.log("Success! Count:", result.data.length);
        result.data.forEach(p => {
            console.log(`- Type: ${p.type} | Category: ${p.category} | Reason: ${p.reason}`);
        });
    } else {
        console.error("Failed:", result.status, result.error);
    }
}

test();
