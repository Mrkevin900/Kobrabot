const { AutoModerationRuleEventType, AutoModerationRuleTriggerType, AutoModerationActionType, AutoModerationRuleKeywordPresetType } = require("discord.js");

class AutoModManager {
  constructor(client) {
    this.client = client;
  }

  async syncGuildRules(guild) {
    try {
      if (!guild.members.me.permissions.has("ManageGuild")) return;

      const existingRules = await guild.autoModerationRules.fetch().catch(() => new Map());

      // 1. Anti-Spam (Native)
      if (!existingRules.find(r => r.triggerType === AutoModerationRuleTriggerType.Spam)) {
        await guild.autoModerationRules.create({
          name: "[AutoMod] Anti-Spam",
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Spam,
          actions: [
            { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "Le spam est interdit sur ce serveur." } },
            { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: process.env.LOGS_CHANNEL_ID || undefined } }
          ],
          enabled: true,
          reason: "Configuration initiale AutoMod"
        }).catch(() => null);
      }

      // 2. Anti-Insultes (Native Presets)
      if (!existingRules.find(r => r.triggerType === AutoModerationRuleTriggerType.KeywordPreset)) {
        await guild.autoModerationRules.create({
          name: "[AutoMod] Filtre de langage",
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.KeywordPreset,
          triggerMetadata: {
            presets: [
              AutoModerationRuleKeywordPresetType.Profanity,
              AutoModerationRuleKeywordPresetType.SexualContent,
              AutoModerationRuleKeywordPresetType.Slurs
            ]
          },
          actions: [
            { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "Votre message contient un langage inapproprié." } },
            { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: process.env.LOGS_CHANNEL_ID || undefined } }
          ],
          enabled: true,
          reason: "Configuration initiale AutoMod"
        }).catch(() => null);
      }

      // 3. Anti-Mass-Mention
      if (!existingRules.find(r => r.triggerType === AutoModerationRuleTriggerType.MentionSpam)) {
        await guild.autoModerationRules.create({
          name: "[AutoMod] Anti-Mass-Mention",
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.MentionSpam,
          triggerMetadata: { mentionTotalLimit: 5 },
          actions: [
            { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "Trop de mentions dans un seul message." } },
            { type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 600 } }, // 10 minutes timeout
            { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: process.env.LOGS_CHANNEL_ID || undefined } }
          ],
          enabled: true,
          reason: "Configuration initiale AutoMod"
        }).catch(() => null);
      }

      // 4. Anti-Liens (Custom Keyword)
      if (!existingRules.find(r => r.name === "[AutoMod] Anti-Liens")) {
        await guild.autoModerationRules.create({
          name: "[AutoMod] Anti-Liens",
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Keyword,
          triggerMetadata: {
            keywordFilter: ["*http://*", "*https://*", "*discord.gg/*", "*discord.com/invite/*"],
            regexPatterns: ["(?:https?:\\/\\/)?(?:www\\.)?(?:discord\\.(?:gg|io|me|li)|discord(?:app)?\\.com\\/invite)\\/[a-zA-Z0-9]+"]
          },
          actions: [
            { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "Les liens sont interdits ou surveillés sur ce serveur." } },
            { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: process.env.LOGS_CHANNEL_ID || undefined } }
          ],
          enabled: false, // Default to false so it doesn't block legitimate links until configured by admins
          reason: "Configuration initiale AutoMod"
        }).catch(() => null);
      }

    } catch (error) {
      console.error(`Erreur sync AutoMod pour la guilde ${guild.id}:`, error);
    }
  }

  async syncAllGuilds() {
    for (const guild of this.client.guilds.cache.values()) {
      await this.syncGuildRules(guild);
    }
  }
}

module.exports = AutoModManager;
