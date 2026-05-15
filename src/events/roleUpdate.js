const roleUpdate = {
  async executeHandler(client, oldRole, newRole) {
    if (!newRole?.guild) return;

    const changes = [];
    if ((oldRole?.name || "") !== (newRole?.name || "")) {
      changes.push(`nom: "${oldRole?.name || "?"}" -> "${newRole?.name || "?"}"`);
    }
    if ((oldRole?.hexColor || "") !== (newRole?.hexColor || "")) {
      changes.push(`couleur: ${oldRole?.hexColor || "none"} -> ${newRole?.hexColor || "none"}`);
    }
    if (changes.length === 0) return;

    client
      .getLogger?.()
      ?.send(
        `[SERVER] Role modifie | ${newRole.name || newRole.id} (${newRole.id}) | ${changes.join(" | ")}`,
        "SERVER",
      );
  },
  settings: { enabled: true },
};

module.exports = { default: roleUpdate };

