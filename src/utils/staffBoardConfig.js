const DEFAULT_STAFF_BOARD = {
  emblem: "Famille KobraBot Test",
  color: "#24002e",
  section_emoji: "",
  role_emoji: "",
};

let ensurePromise = null;

function normalizeHexColor(input, fallback = DEFAULT_STAFF_BOARD.color) {
  const raw = String(input || "").trim();
  if (!raw) return fallback;

  const prefixed = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-fA-F]{6}$/.test(prefixed)) return prefixed;
  return fallback;
}

function toColorInt(hexColor) {
  return parseInt(String(hexColor || "#24002e").replace("#", ""), 16);
}

function cleanText(input, maxLen = 120) {
  return String(input || "").trim().slice(0, maxLen);
}

async function ensureStaffupdateColumns(db) {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    const hasEmblem = await db.schema.hasColumn("staffupdate", "emblem");
    if (!hasEmblem) {
      await db.schema.alterTable("staffupdate", (table) => {
        table.string("emblem", 120).nullable();
      });
    }

    const hasColor = await db.schema.hasColumn("staffupdate", "color");
    if (!hasColor) {
      await db.schema.alterTable("staffupdate", (table) => {
        table.string("color", 7).nullable();
      });
    }

    const hasSectionEmoji = await db.schema.hasColumn("staffupdate", "section_emoji");
    if (!hasSectionEmoji) {
      await db.schema.alterTable("staffupdate", (table) => {
        table.string("section_emoji", 80).nullable();
      });
    }

    const hasRoleEmoji = await db.schema.hasColumn("staffupdate", "role_emoji");
    if (!hasRoleEmoji) {
      await db.schema.alterTable("staffupdate", (table) => {
        table.string("role_emoji", 80).nullable();
      });
    }
  })();

  try {
    await ensurePromise;
  } finally {
    ensurePromise = null;
  }
}

module.exports = {
  DEFAULT_STAFF_BOARD,
  normalizeHexColor,
  toColorInt,
  cleanText,
  ensureStaffupdateColumns,
};
