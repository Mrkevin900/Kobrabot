const { getDatabase } = require("../database");

async function updateModule(module, state, guild) {
  if (guild) {
    await getDatabase()("modules_table")
      .update(module, state)
      .where("server_id", guild.id);
  }
}

module.exports = updateModule;
