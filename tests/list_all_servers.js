require("dotenv").config();
const KobralostAPI = require("../src/utils/KobralostAPI");

async function test() {
    const mockClient = {
        getLogger: () => ({
            send: (msg, type) => console.log(`[${type}] ${msg}`)
        })
    };
    const api = new KobralostAPI(mockClient);
    
    console.log("Fetching servers list...");
    const result = await api.getServersList();
    
    if (result.success) {
        console.log("Servers count:", result.data.length);
        result.data.forEach(s => {
            console.log(`- ${s.name} (ID: ${s.id})`);
        });
    } else {
        console.error("Failed:", result.status, result.error);
    }
}

test();
