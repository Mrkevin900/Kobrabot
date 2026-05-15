/**
 * @typedef {Object} ServersTable
 * @property {string} serverId
 */

/**
 * @typedef {Object} ModulesTable
 * @property {string} serverId
 * @property {number} moduleAr
 * @property {number} moduleMo
 * @property {number} moduleLv
 * @property {number} moduleEc
 * @property {number} moduleTk
 * @property {number} moduleWc
 */

/**
 * @typedef {Object} ChannelsTable
 * @property {string} serverId
 * @property {string} welcome_channel
 * @property {string} goodbye_channel
 * @property {string} rankups_channel
 * @property {string} skipped_channel_1
 * @property {string} skipped_channel_2
 * @property {string} skipped_channel_3
 */

/**
 * @typedef {Object} Tables
 * @property {ServersTable} Servers
 * @property {ModulesTable} Modules
 * @property {ChannelsTable} Channels
 */

module.exports = {};
