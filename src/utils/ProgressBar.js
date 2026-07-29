/**
 * Générateur de barre de progression visuelle pour Discord.
 */
function createProgressBar(current, target, length = 10, options = {}) {
  const filledChar = options.filledChar || "█";
  const emptyChar = options.emptyChar || "░";

  const numCurrent = Math.max(0, Number(current) || 0);
  const numTarget = Math.max(1, Number(target) || 1);

  const percentage = Math.min(100, Math.max(0, (numCurrent / numTarget) * 100));
  const filledLength = Math.round((percentage / 100) * length);
  const emptyLength = Math.max(0, length - filledLength);

  const bar = filledChar.repeat(filledLength) + emptyChar.repeat(emptyLength);
  const formattedPercent = percentage.toFixed(1).replace(".0", "");

  return {
    bar,
    percentage,
    formattedPercent: `${formattedPercent}%`,
    displayText: `${bar} ${formattedPercent}% (${numCurrent.toLocaleString("fr-FR")} / ${numTarget.toLocaleString("fr-FR")})`,
  };
}

module.exports = {
  createProgressBar,
};
