/**
 * @typedef {Object} CommandSettings
 * @property {string} module
 * @property {boolean} enabled
 */

/**
 * @typedef {Object} Command
 * @property {any} data
 * @property {Function} executeCommand - Execute command with interaction
 * @property {Function} [execButtons] - Execute buttons (optional)
 * @property {CommandSettings} settings
 */

module.exports = {};
