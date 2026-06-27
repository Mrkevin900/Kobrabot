const axios = require("axios");

let cachedStatus = null;
let lastFetched = 0;
const CACHE_TTL = 60000; // 60 seconds cache

/**
 * Fetches the Garry's Mod server status from the BattleMetrics API.
 * Uses cache if the last fetch was less than 60 seconds ago.
 */
async function fetchGmodStatus() {
  const now = Date.now();
  if (cachedStatus && now - lastFetched < CACHE_TTL) {
    return cachedStatus;
  }

  const serverId = process.env.GMOD_BATTLEMETRICS_ID || "13412950";
  const url = `https://api.battlemetrics.com/servers/${serverId}`;

  try {
    const response = await axios.get(url, { timeout: 5000 });
    const serverData = response.data?.data;
    if (!serverData) {
      throw new Error("Invalid response format from BattleMetrics");
    }

    const attrs = serverData.attributes;
    const nameOverride = process.env.GMOD_SERVER_NAME_OVERRIDE;

    cachedStatus = {
      success: true,
      name: nameOverride || attrs.name || "Serveur GMod",
      status: attrs.status || "offline",
      players: attrs.players || 0,
      maxPlayers: attrs.maxPlayers || 0,
      map: attrs.details?.map || "Inconnue",
      ip: attrs.ip || "play.kobralost-rp.fr",
      port: attrs.port || 27015,
      fetchedAt: now,
    };
    lastFetched = now;
    return cachedStatus;
  } catch (error) {
    // If we have cached data, return it even if the fetch fails
    if (cachedStatus) {
      return { ...cachedStatus, fromCacheOnError: true };
    }

    return {
      success: false,
      name: process.env.GMOD_SERVER_NAME_OVERRIDE || "Serveur GMod",
      status: "offline",
      players: 0,
      maxPlayers: 0,
      map: "Inconnue",
      ip: process.env.GMOD_SERVER_IP || "play.kobralost-rp.fr",
      port: 27015,
      error: error.message,
    };
  }
}

module.exports = {
  fetchGmodStatus,
};
