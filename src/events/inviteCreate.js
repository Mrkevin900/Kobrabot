const {
  fetchAuditExecutor,
  isFeatureEnabled,
  logSecurity,
  punishExecutor,
} = require("../utils/SecurityUtils");

const inviteCreate = {
  async executeHandler(client, invite) {
    const guild = invite?.guild;
    if (!guild || !isFeatureEnabled("anticreainvite", guild.id)) return;

    const executor = await fetchAuditExecutor(guild, "inviteCreate", invite.code ? null : undefined);
    await invite.delete("Anti-invite active").catch(() => null);
    logSecurity(client, `Invitation supprimee: ${invite.code || "inconnue"}`);
    await punishExecutor(client, guild, executor || invite.inviter, "Anti-invite active");
  },

  settings: { enabled: true },
};

module.exports = { default: inviteCreate };

