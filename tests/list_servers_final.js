require("dotenv").config();
const axios = require("axios");

async function test() {
    const token = process.env.API_TOKEN;
    const url = "https://dashboard.kobralost-rp.com/api/v2/servers";
    
    console.log(`Fetching servers from: ${url}`);
    
    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json"
            }
        });
        console.log("Success! Status:", response.status);
        const servers = response.data.data || response.data;
        console.log("Servers count:", servers.length);
        servers.forEach(s => {
            console.log(`- ${s.name} (ID: ${s.id}) | Guild: ${s.guildId}`);
        });
    } catch (error) {
        console.error("Failed:", error.response ? error.response.status : error.message);
    }
}

test();
