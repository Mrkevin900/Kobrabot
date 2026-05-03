const roleDelete = {
  async executeHandler(client, role) {
    if (!role?.guild) return;
    client
      .getLogger?.()
      ?.send(
        `[SERVER] Role supprime | ${role.name || role.id} (${role.id})`,
        "SERVER",
      );
  },
  settings: { enabled: true },
};

module.exports = { default: roleDelete };

