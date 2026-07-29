const { GatewayIntentBits, Partials } = require("discord.js");
const { HEX_COLORS } = require("../utils/theme");

/**
 * @typedef {Object} EmbedConfig
 * @property {string} footer
 * @property {string} classColor
 * @property {string} errorColor
 * @property {string} alertColor
 * @property {string} readyColor
 * @property {string} notifColor
 */

/**
 * @typedef {Object} Config
 * @property {number[]} intents
 * @property {number[]} partials
 * @property {string} guildId
 * @property {EmbedConfig} embed
 */

const config = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
    Partials.ThreadMember,
    Partials.User,
  ],
  guildId: "704412119847796856",

  embed: {
    footer: "🤖 KobraBot | Mode : Prod | mrkevin",
    classColor: HEX_COLORS.PRIMARY,
    errorColor: HEX_COLORS.ERROR,
    alertColor: HEX_COLORS.GOLD,
    readyColor: HEX_COLORS.SUCCESS,
    notifColor: HEX_COLORS.INFO,
  },
};

module.exports = config;
