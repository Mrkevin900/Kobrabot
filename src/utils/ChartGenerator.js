/**
 * Utility for rendering text-based statistics summaries and ASCII charts.
 */

function generateActivityChart(dailyData = []) {
  if (!dailyData || dailyData.length === 0) {
    return "Aucune donnée récente d'activité.";
  }

  const maxVal = Math.max(...dailyData.map((d) => d.count || 0), 1);
  const chartLines = dailyData.map((item) => {
    const barLength = Math.round(((item.count || 0) / maxVal) * 12);
    const bar = "█".repeat(barLength).padEnd(12, "░");
    return `\`${item.date}\` ${bar} **${item.count || 0}** units`;
  });

  return chartLines.join("\n");
}

function formatLeaderboardTable(entries, title, unit = "units") {
  if (!entries || entries.length === 0) {
    return "*Aucune donnée de classement disponible.*";
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = entries.map((entry, index) => {
    const rankPrefix = medals[index] || `**#${index + 1}**`;
    const name = entry.name || entry.username || `<@${entry.id}>`;
    const score = Number(entry.score || entry.total || 0).toLocaleString("fr-FR");
    return `${rankPrefix} ${name} — **${score}** ${unit}`;
  });

  return lines.join("\n");
}

module.exports = {
  generateActivityChart,
  formatLeaderboardTable,
};
