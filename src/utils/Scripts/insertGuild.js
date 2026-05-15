const { getDatabase } = require("../../database/database");

async function insertGuild(guild) {
  if (!guild) return;
  const db = getDatabase();
  if (!db) return;

  try {
    await db("servers_table").insert({ server_id: guild.id }).catch(() => {});
    await db("modules_table").insert({ server_id: guild.id }).catch(() => {});
    await db("channels_table").insert({ server_id: guild.id }).catch(() => {});

    const members = await guild.members.fetch().catch(() => new Map());
    
    // Pour ne pas bloquer le démarrage / l'événement
    const promises = members.map(async (member) => {
      await db("users_table").insert({
        member_id: member.user.id,
        server_id: guild.id,
      }).catch(() => {});
      
      await db("moderation_table").insert({
        member_id: member.user.id,
        server_id: guild.id,
      }).catch(() => {});
    });

    await Promise.all(promises);
  } catch (err) {
    console.error("[insertGuild] Erreur :", err.message);
  }
}

module.exports = insertGuild;
