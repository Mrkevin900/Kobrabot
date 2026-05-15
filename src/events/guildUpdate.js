const { isFeatureEnabled, logSecurity } = require("../utils/SecurityUtils");

const guildUpdate = {
  async executeHandler(client, oldGuild, newGuild) {
    if (!newGuild || !isFeatureEnabled("antiguildupdate", newGuild.id)) return;

    if (oldGuild.name && oldGuild.name !== newGuild.name) {
      await newGuild.setName(oldGuild.name, "Anti-guild-update active").catch(() => null);
      logSecurity(client, `Nom du serveur restaure: ${newGuild.name} -> ${oldGuild.name}`);
    }

    const oldIcon = oldGuild.iconURL?.({ extension: "png", size: 1024 }) || null;
    const newIcon = newGuild.iconURL?.({ extension: "png", size: 1024 }) || null;
    if (oldIcon !== newIcon) {
      await newGuild.setIcon(oldIcon, "Anti-guild-update active").catch(() => null);
      logSecurity(client, "Icone du serveur restauree");
    }
  },

  settings: { enabled: true },
};

module.exports = { default: guildUpdate };

