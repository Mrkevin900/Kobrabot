/**
 * @typedef {Object} TinyInt
 * @typedef {1 | 0 | boolean} TinyInt
 */

/**
 * @typedef {Object} ServersTable
 * @property {string} serverId
 */

/**
 * @typedef {Object} ModulesTable
 * @property {string} serverId
 * @property {TinyInt} moduleAr
 * @property {TinyInt} moduleMo
 * @property {TinyInt} moduleLv
 * @property {TinyInt} moduleEc
 * @property {TinyInt} moduleTk
 * @property {TinyInt} moduleWc
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
 * @typedef {Object} AntiRaidTable
 * @property {string} serverId
 * @property {number} join_times
 * @property {number} join_timeout
 */

/**
 * @typedef {Object} UsersTable
 * @property {string} memberId
 * @property {string} serverId
 * @property {string} description
 * @property {number} join_counter
 */

/**
 * @typedef {Object} EconomyTable
 * @property {string} memberId
 * @property {number} money
 * @property {number} bank
 * @property {number} casino
 */

/**
 * @typedef {Object} LevelingTable
 * @property {string} memberId
 * @property {number} level
 * @property {string} booster
 * @property {number} xp_farmed
 * @property {number} xp_needed
 */

/**
 * @typedef {Object} ModerationTable
 * @property {string} memberId
 * @property {string} serverId
 */

/**
 * @typedef {Object} BansTable
 * @property {string} memberId
 * @property {string} date
 * @property {string} reason
 * @property {string} moderator
 */

/**
 * @typedef {Object} KickTable
 * @property {string} memberId
 * @property {string} date
 * @property {string} reason
 * @property {string} moderator
 */

/**
 * @typedef {Object} MuteTable
 * @property {string} memberId
 * @property {string} date
 * @property {string} reason
 * @property {string} moderator
 */

/**
 * @typedef {Object} WarnTable
 * @property {string} memberId
 * @property {string} date
 * @property {string} reason
 * @property {string} moderator
 */

/**
 * @typedef {Object} Tables
 * @property {ServersTable} Servers
 * @property {ModulesTable} Modules
 * @property {ChannelsTable} Channels
 * @property {AntiRaidTable} AntiRaid
 * @property {UsersTable} Users
 * @property {EconomyTable} Economy
 * @property {LevelingTable} Leveling
 * @property {ModerationTable} Moderation
 * @property {BansTable} Bans
 * @property {KickTable} Kick
 * @property {MuteTable} Mute
 * @property {WarnTable} Warn
 */

module.exports = {};
