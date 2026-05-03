const roleCreate = {
  async executeHandler(client, role) {
    if (!role?.guild) return;
    client
      .getLogger?.()
      ?.send(
        `[SERVER] Role cree | ${role.name || role.id} (${role.id})`,
        "SERVER",
      );
  },
  settings: { enabled: true },
};

module.exports = { default: roleCreate };

