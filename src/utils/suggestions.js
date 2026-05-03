const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { getDatabase, ensureDatabaseConnection, describeDbError } = require("../database/database");
const { getRuntimeStore } = require("./runtimeStore");

const SUGGESTIONS_TABLE = "bot_suggestions";
const VOTES_TABLE = "bot_suggestion_votes";
let schemaReady = false;
let schemaPromise = null;

function getSuggestionChannelId() {
  return String(process.env.SUGGEST_CHANNEL_ID || "").trim();
}

function isImageLikeAttachment(attachment) {
  const contentType = String(attachment?.contentType || "").toLowerCase();
  const name = String(attachment?.name || "").toLowerCase();
  return (
    contentType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)
  );
}

function extractSuggestionImageUrl(attachment) {
  if (!attachment || !attachment.url) return null;
  return isImageLikeAttachment(attachment) ? attachment.url : null;
}

async function ensureSchema(db) {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const hasSuggestions = await db.schema.hasTable(SUGGESTIONS_TABLE);
    if (!hasSuggestions) {
      await db.schema.createTable(SUGGESTIONS_TABLE, (table) => {
        table.increments("id").primary();
        table.string("guild_id", 32).notNullable().index();
        table.string("channel_id", 32).notNullable();
        table.string("author_id", 32).notNullable().index();
        table.string("author_tag", 128).nullable();
        table.string("author_name", 128).nullable();
        table.string("source_message_id", 32).nullable();
        table.string("suggestion_message_id", 32).notNullable().unique();
        table.string("thread_id", 32).nullable();
        table.text("content").notNullable();
        table.text("image_url").nullable();
        table.bigInteger("created_at").notNullable().defaultTo(0);
      });
    }

    const hasVotes = await db.schema.hasTable(VOTES_TABLE);
    if (!hasVotes) {
      await db.schema.createTable(VOTES_TABLE, (table) => {
        table.increments("id").primary();
        table.integer("suggestion_id").unsigned().notNullable().index();
        table.string("user_id", 32).notNullable().index();
        table.string("vote_type", 8).notNullable();
        table.bigInteger("created_at").notNullable().defaultTo(0);
        table.unique(["suggestion_id", "user_id"]);
      });
    }

    schemaReady = true;
  })();

  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

async function getDb(client) {
  return (await ensureDatabaseConnection(client)) || getDatabase();
}

function normalizeSuggestion(entry, id) {
  return {
    id: Number(id || entry.id || 0),
    guildId: String(entry.guildId || ""),
    channelId: String(entry.channelId || ""),
    authorId: String(entry.authorId || ""),
    authorTag: String(entry.authorTag || ""),
    authorName: String(entry.authorName || ""),
    sourceMessageId: entry.sourceMessageId ? String(entry.sourceMessageId) : null,
    suggestionMessageId: String(entry.suggestionMessageId || ""),
    threadId: entry.threadId ? String(entry.threadId) : null,
    content: String(entry.content || "").trim(),
    imageUrl: entry.imageUrl ? String(entry.imageUrl) : null,
    createdAt: Number(entry.createdAt) || Date.now(),
  };
}

function rowToSuggestion(row) {
  if (!row) return null;
  return normalizeSuggestion(
    {
      guildId: row.guild_id,
      channelId: row.channel_id,
      authorId: row.author_id,
      authorTag: row.author_tag,
      authorName: row.author_name,
      sourceMessageId: row.source_message_id,
      suggestionMessageId: row.suggestion_message_id,
      threadId: row.thread_id,
      content: row.content,
      imageUrl: row.image_url,
      createdAt: row.created_at,
    },
    row.id,
  );
}

function buildSuggestionButtons(client, upvotes = 0, downvotes = 0) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("suggest_upvote")
      .setLabel(String(upvotes))
      .setEmoji(client?.emoji?.("public", "✅") || "✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("suggest_downvote")
      .setLabel(String(downvotes))
      .setEmoji(client?.emoji?.("blacklist", "❌") || "❌")
      .setStyle(ButtonStyle.Danger),
  );
}

function buildSuggestionEmbed(client, guild, author, suggestion) {
  const avatar = author?.displayAvatarURL?.({ size: 256 }) || author?.avatarURL?.({ size: 256 }) || null;
  const authorName =
    suggestion.authorName ||
    author?.displayName ||
    author?.username ||
    author?.user?.username ||
    "Membre";
  const authorTag =
    suggestion.authorTag ||
    author?.user?.tag ||
    author?.tag ||
    authorName;

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`Suggestion de ${authorName}`)
    .setDescription(suggestion.content || "Suggestion sans texte.")
    .setFooter({
      text: `Cree par ${authorTag} - ${guild?.name || "Serveur"}`,
      iconURL: avatar || undefined,
    })
    .setTimestamp(new Date(suggestion.createdAt));

  if (avatar) {
    embed.setThumbnail(avatar);
  }

  if (suggestion.imageUrl) {
    embed.setImage(suggestion.imageUrl);
  }

  return embed;
}

async function createSuggestionRecord(client, entry) {
  const payload = normalizeSuggestion(entry);
  const db = await getDb(client);
  if (db) {
    try {
      await ensureSchema(db);
      const inserted = await db(SUGGESTIONS_TABLE).insert({
        guild_id: payload.guildId,
        channel_id: payload.channelId,
        author_id: payload.authorId,
        author_tag: payload.authorTag,
        author_name: payload.authorName,
        source_message_id: payload.sourceMessageId,
        suggestion_message_id: payload.suggestionMessageId,
        thread_id: payload.threadId,
        content: payload.content,
        image_url: payload.imageUrl,
        created_at: payload.createdAt,
      });
      return normalizeSuggestion(payload, Array.isArray(inserted) ? inserted[0] : inserted);
    } catch (error) {
      client
        ?.getLogger?.()
        ?.send(`[SUGGEST] Erreur DB creation suggestion: ${describeDbError(error)}`, "WARN");
    }
  }

  const store = getRuntimeStore(client);
  const records = store.has("suggestions") ? store.get("suggestions") : [];
  const safeRecords = Array.isArray(records) ? records : [];
  const nextId = Number(store.get("suggestionsNextId") || 1);
  const record = normalizeSuggestion(payload, nextId);
  safeRecords.push(record);
  store.set("suggestions", safeRecords);
  store.set("suggestionsNextId", nextId + 1);
  return record;
}

async function updateSuggestionThreadId(client, suggestionId, threadId) {
  const db = await getDb(client);
  if (db) {
    try {
      await ensureSchema(db);
      await db(SUGGESTIONS_TABLE).where({ id: suggestionId }).update({ thread_id: String(threadId) });
      return true;
    } catch (error) {
      client
        ?.getLogger?.()
        ?.send(`[SUGGEST] Erreur update thread suggestion: ${describeDbError(error)}`, "WARN");
    }
  }

  const store = getRuntimeStore(client);
  const records = store.has("suggestions") ? store.get("suggestions") : [];
  const safeRecords = Array.isArray(records) ? records : [];
  const index = safeRecords.findIndex((record) => record.id === Number(suggestionId));
  if (index >= 0) {
    safeRecords[index].threadId = String(threadId);
    store.set("suggestions", safeRecords);
    return true;
  }
  return false;
}

async function getSuggestionByMessageId(client, guildId, suggestionMessageId) {
  const db = await getDb(client);
  if (db) {
    try {
      await ensureSchema(db);
      const row = await db(SUGGESTIONS_TABLE)
        .where({
          guild_id: String(guildId),
          suggestion_message_id: String(suggestionMessageId),
        })
        .first();
      return rowToSuggestion(row);
    } catch (error) {
      client
        ?.getLogger?.()
        ?.send(`[SUGGEST] Erreur lecture suggestion: ${describeDbError(error)}`, "WARN");
    }
  }

  const store = getRuntimeStore(client);
  const records = store.has("suggestions") ? store.get("suggestions") : [];
  return (Array.isArray(records) ? records : []).find(
    (record) =>
      record.guildId === String(guildId) &&
      record.suggestionMessageId === String(suggestionMessageId),
  ) || null;
}

async function getSuggestionCounts(client, suggestionId) {
  const db = await getDb(client);
  if (db) {
    try {
      await ensureSchema(db);
      const rows = await db(VOTES_TABLE)
        .select("vote_type")
        .where({ suggestion_id: Number(suggestionId) });
      const counts = { upvotes: 0, downvotes: 0 };
      for (const row of rows) {
        if (row.vote_type === "up") counts.upvotes += 1;
        if (row.vote_type === "down") counts.downvotes += 1;
      }
      return counts;
    } catch (error) {
      client
        ?.getLogger?.()
        ?.send(`[SUGGEST] Erreur lecture votes: ${describeDbError(error)}`, "WARN");
    }
  }

  const store = getRuntimeStore(client);
  const votes = store.has("suggestionVotes") ? store.get("suggestionVotes") : [];
  const counts = { upvotes: 0, downvotes: 0 };
  for (const vote of Array.isArray(votes) ? votes : []) {
    if (vote.suggestionId !== Number(suggestionId)) continue;
    if (vote.voteType === "up") counts.upvotes += 1;
    if (vote.voteType === "down") counts.downvotes += 1;
  }
  return counts;
}

async function setSuggestionVote(client, suggestionId, userId, voteType) {
  const db = await getDb(client);
  if (db) {
    try {
      await ensureSchema(db);
      const existing = await db(VOTES_TABLE)
        .where({
          suggestion_id: Number(suggestionId),
          user_id: String(userId),
        })
        .first();

      let state = "added";
      if (existing && existing.vote_type === voteType) {
        await db(VOTES_TABLE)
          .where({ id: existing.id })
          .delete();
        state = "removed";
      } else if (existing) {
        await db(VOTES_TABLE)
          .where({ id: existing.id })
          .update({ vote_type: voteType, created_at: Date.now() });
        state = "switched";
      } else {
        await db(VOTES_TABLE).insert({
          suggestion_id: Number(suggestionId),
          user_id: String(userId),
          vote_type: voteType,
          created_at: Date.now(),
        });
      }

      const counts = await getSuggestionCounts(client, suggestionId);
      return { state, counts };
    } catch (error) {
      client
        ?.getLogger?.()
        ?.send(`[SUGGEST] Erreur vote suggestion: ${describeDbError(error)}`, "WARN");
    }
  }

  const store = getRuntimeStore(client);
  const votes = store.has("suggestionVotes") ? store.get("suggestionVotes") : [];
  const safeVotes = Array.isArray(votes) ? votes : [];
  const index = safeVotes.findIndex(
    (vote) =>
      vote.suggestionId === Number(suggestionId) &&
      vote.userId === String(userId),
  );

  let state = "added";
  if (index >= 0 && safeVotes[index].voteType === voteType) {
    safeVotes.splice(index, 1);
    state = "removed";
  } else if (index >= 0) {
    safeVotes[index].voteType = voteType;
    safeVotes[index].createdAt = Date.now();
    state = "switched";
  } else {
    safeVotes.push({
      suggestionId: Number(suggestionId),
      userId: String(userId),
      voteType,
      createdAt: Date.now(),
    });
  }

  store.set("suggestionVotes", safeVotes);
  const counts = await getSuggestionCounts(client, suggestionId);
  return { state, counts };
}

async function publishSuggestion(client, options) {
  const guild = options.guild;
  const author = options.author;
  const channel = options.channel || guild?.channels?.cache?.get(getSuggestionChannelId());
  if (!guild || !author || !channel || !channel.isTextBased?.()) {
    return { ok: false, error: "Salon de suggestions introuvable." };
  }

  const content = String(options.content || "").trim();
  const attachment = options.attachment || null;
  const imageUrl = extractSuggestionImageUrl(attachment);
  if (!content && !imageUrl) {
    return { ok: false, error: "La suggestion est vide." };
  }

  const suggestionData = normalizeSuggestion({
    guildId: guild.id,
    channelId: channel.id,
    authorId: author.id,
    authorTag: author.tag || author.user?.tag || "",
    authorName: author.displayName || author.username || author.user?.username || "",
    sourceMessageId: options.sourceMessageId || null,
    suggestionMessageId: "pending",
    threadId: null,
    content: content || "Suggestion sans texte.",
    imageUrl,
    createdAt: Date.now(),
  });

  const embed = buildSuggestionEmbed(client, guild, author, suggestionData);
  const row = buildSuggestionButtons(client, 0, 0);
  const sent = await channel.send({ embeds: [embed], components: [row] });

  const record = await createSuggestionRecord(client, {
    ...suggestionData,
    suggestionMessageId: sent.id,
  });

  let thread = null;
  if (typeof sent.startThread === "function") {
    thread = await sent
      .startThread({
        name: `Suggestion de ${suggestionData.authorName || "membre"}`.slice(0, 100),
        autoArchiveDuration: 1440,
        reason: `Discussion suggestion ${sent.id}`,
      })
      .catch(() => null);

    if (thread) {
      await updateSuggestionThreadId(client, record.id, thread.id);
      await thread
        .send({
          content: "Discussion ouverte pour cette suggestion.",
          allowedMentions: { parse: [] },
        })
        .catch(() => {});
    }
  }

  return {
    ok: true,
    message: sent,
    channel,
    record: thread ? { ...record, threadId: thread.id } : record,
    thread,
  };
}

async function handleSuggestionVote(client, interaction, voteType) {
  const suggestion = await getSuggestionByMessageId(
    client,
    interaction.guildId,
    interaction.message.id,
  );
  if (!suggestion) {
    await interaction.reply({
      content: "Suggestion introuvable ou trop ancienne.",
      flags: 64,
    }).catch(() => {});
    return false;
  }

  const result = await setSuggestionVote(client, suggestion.id, interaction.user.id, voteType);
  const row = buildSuggestionButtons(client, result.counts.upvotes, result.counts.downvotes);
  await interaction.message.edit({ components: [row] }).catch(() => {});

  const labels = {
    added: voteType === "up" ? "Vote positif enregistre." : "Vote negatif enregistre.",
    switched: voteType === "up" ? "Vote bascule en positif." : "Vote bascule en negatif.",
    removed: "Vote retire.",
  };

  await interaction.reply({
    content: labels[result.state] || "Vote mis a jour.",
    flags: 64,
  }).catch(() => {});
  return true;
}

module.exports = {
  SUGGESTIONS_TABLE,
  VOTES_TABLE,
  buildSuggestionButtons,
  buildSuggestionEmbed,
  getSuggestionByMessageId,
  getSuggestionChannelId,
  handleSuggestionVote,
  publishSuggestion,
};

