const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

function parseTicketOwnerId(channel) {
  const topic = channel?.topic || "";
  const match = topic.match(/User:\s*(\d{16,20})/i);
  return match ? match[1] : null;
}

function parseTicketClaimedBy(channel) {
  const topic = channel?.topic || "";
  const match = topic.match(/ClaimedBy:\s*([0-9]{16,20}|none)/i);
  return match ? match[1] : "none";
}

function parseTicketType(channel) {
  const topic = channel?.topic || "";
  const match = topic.match(/Type:\s*([a-z_]+)/i);
  return match ? match[1].toLowerCase() : "autres";
}

function parseTopicFieldValue(topic, field) {
  const re = new RegExp(`${field}:\\s*([^|]+)`, "i");
  const match = String(topic || "").match(re);
  return match ? match[1].trim() : null;
}

function parseTicketLogThreadId(channel) {
  const value = parseTopicFieldValue(channel?.topic || "", "LogThread");
  if (!value || value.toLowerCase() === "none") return null;
  return /^\d{16,20}$/.test(value) ? value : null;
}

function parseTicketDmMirror(channel) {
  const topic = channel?.topic || "";
  const match = topic.match(/DmMirror:\s*(on|off)/i);
  if (!match) return true;
  return match[1].toLowerCase() === "on";
}

function isTicketStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.ManageMessages)) return true;
  const staffRoleId = process.env.TICKET_STAFF_ROLE_ID;
  if (!staffRoleId) return false;
  return Boolean(member.roles?.cache?.has(staffRoleId));
}

async function updateTicketTopicField(channel, field, value) {
  let topic = channel.topic || "";
  const pattern = new RegExp(`${field}:\\s*[^|]+`, "i");
  if (pattern.test(topic)) {
    topic = topic.replace(pattern, `${field}: ${value}`);
  } else {
    topic = `${topic} | ${field}: ${value}`;
  }
  return channel.setTopic(topic.slice(0, 1024)).catch(() => null);
}

function buildTicketActionRows(client) {
  const claimEmoji = client.emoji("kb_add", "\u2705");
  const unclaimEmoji = client.emoji("kb_no", "\u274C");
  const addEmoji = client.emoji("kb_add", "\u2795");
  const removeEmoji = client.emoji("kb_no", "\u2796");
  const transcriptEmoji = client.emoji("kb_edit", "\u{1F4C4}");
  const toggleEmoji = client.emoji("pointred", "\u{1F6A8}");
  const closeEmoji = client.emoji("purge", "\u{1F512}");

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Prendre en charge")
      .setEmoji(claimEmoji)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticket_unclaim")
      .setLabel("Retirer la prise")
      .setEmoji(unclaimEmoji)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket_add_user")
      .setLabel("Ajouter personne")
      .setEmoji(addEmoji)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticket_remove_user")
      .setLabel("Retirer personne")
      .setEmoji(removeEmoji)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket_transcript")
      .setLabel("Transcript")
      .setEmoji(transcriptEmoji)
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_toggle_dm")
      .setLabel("Activer / desactiver MP")
      .setEmoji(toggleEmoji)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Fermer le ticket")
      .setEmoji(closeEmoji)
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2];
}

module.exports = {
  buildTicketActionRows,
  isTicketStaff,
  parseTicketClaimedBy,
  parseTicketDmMirror,
  parseTicketLogThreadId,
  parseTicketOwnerId,
  parseTicketType,
  parseTopicFieldValue,
  updateTicketTopicField,
};
