const { getDatabase } = require("../database/database");

async function insertGuild(guild) {
  if (guild) {
    await getDatabase()("Servers").insert({ serverId: guild.id });
    await getDatabase()("Modules").insert({ serverId: guild.id });
    await getDatabase()("Channels").insert({ serverId: guild.id });

    const members = await guild.members.fetch();

    guild.members.cache.clear();

    await Promise.all(
      members.map(async (member) => {
        await getDatabase()("Users").insert({
          serverId: guild.id,
          memberId: member.user.id,
        });
        await getDatabase()("Moderation").insert({
          serverId: guild.id,
          memberId: member.user.id,
        });
        await getDatabase()("Economy").insert({ memberId: member.user.id });
        await getDatabase()("Leveling").insert({ memberId: member.user.id });
      }),
    );
  }
}

module.exports = insertGuild;

