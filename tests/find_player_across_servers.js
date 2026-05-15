require("dotenv").config();
const axios = require("axios");

async function find() {
    const token = process.env.API_TOKEN;
    const discordId = "1185242224770953427"; // Example ID from previous session
    
    console.log(`Searching for Discord ID ${discordId} across servers...`);
    
    for (let s = 1; s <= 5; s++) {
        // Try server-level players search
        const url = `https://dashboard.kobralost-rp.com/api/v2/${s}/players/${discordId}`;
        try {
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log(`FOUND! Server ${s}: ${url}`);
            return;
        } catch (e) {
            // ignore
        }
    }
    console.log("Not found in any server-level players endpoint.");
}

find();
