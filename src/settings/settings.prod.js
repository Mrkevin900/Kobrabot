const { GatewayIntentBits, Partials } = require("discord.js");

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
    footer: "🤖 KobraBot | Mode : Prod | SquadFinder FR",
    classColor: "#847bee",
    errorColor: "#ff5733",
    alertColor: "#ffca33",
    readyColor: "#a8da68",
    notifColor: "#7bc6ee",
  },
};

module.exports = config;
