require("dotenv").config();
const ModerationDb = require("../src/utils/ModerationDb");

async function test() {
    const mockClient = {
        getLogger: () => ({
            send: (msg, type) => console.log(`[${type}] ${msg}`)
        })
    };
    
    console.log("Fetching punishments for 1185242224770953427...");
    const results = await ModerationDb.getPunishments(mockClient, "1185242224770953427");
    
    console.log("Success! Results count:", results.length);
    results.forEach(r => {
        console.log(`- ${r.type}: ${r.reason}`);
    });
    
    process.exit(0);
}

test();
