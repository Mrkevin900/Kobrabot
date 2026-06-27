const express = require("express");
const cors = require("cors");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

let onlinePlayers = []; // In-memory cache of online players on GMod
let serverInfo = {
  name: "Crimson RP Dedicated Server",
  map: "rp_rockford_v2b",
  maxPlayers: 24,
  playersOnline: 0
};

function startServer(client) {
  const app = express();
  const port = process.env.API_PORT || 3000;
  const gmodApiKey = process.env.GMOD_API_KEY || "CrimsonGmodSecretKey";

  // Expose variables on client
  client.gmodOnlinePlayers = onlinePlayers;
  client.gmodServerInfo = serverInfo;

  app.use(cors());
  app.use(express.json());

  // Database helper
  const getKnex = () => {
    if (!client.database || !client.database.isConnected()) {
      throw new Error("Base de données MySQL non connectée.");
    }
    return client.database.getDatabase();
  };

  // Middleware to authenticate GMod server requests
  const authGmod = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${gmodApiKey}`) {
      client.logger?.send(`[API] Tentative d'accès non autorisée de GMod (IP: ${req.ip})`, "WARN");
      return res.status(401).json({ error: "Non autorisé" });
    }
    next();
  };

  // ==========================================
  // 🎮 ENDPOINTS GMOD (AUTHENTIFIÉS)
  // ==========================================

  // Sync player list and events (join/leave/periodic)
  app.post("/api/gmod/sync", authGmod, async (req, res) => {
    try {
      const db = getKnex();
      const { players, event, event_player, server_info } = req.body;

      // Update server info if provided
      if (server_info) {
        serverInfo = {
          name: server_info.name || serverInfo.name,
          map: server_info.map || serverInfo.map,
          maxPlayers: server_info.maxPlayers || serverInfo.maxPlayers,
          playersOnline: server_info.playersOnline || players?.length || 0
        };
        client.gmodServerInfo = serverInfo;
      }

      // Update online players in-memory cache
      if (Array.isArray(players)) {
        onlinePlayers = players;
        client.gmodOnlinePlayers = onlinePlayers;
      }

      // Upsert players in DB
      if (Array.isArray(players)) {
        for (const p of players) {
          await db("gmod_players")
            .insert({
              steamid: p.steamid,
              rpname: p.rpname,
              wallet: p.wallet || 0,
              bank: p.bank || 0,
              job: p.job || "Citizen",
              playtime: p.playtime || 0,
              usergroup: p.usergroup || "user",
              discord_id: p.discord_id || null,
              last_seen: db.fn.now()
            })
            .onConflict("steamid")
            .merge();
        }
      }

      // Log join/leave events on Discord
      const logsChannel = client.channels.cache.get(process.env.LOGS_CHANNEL_ID || process.env.WELCOME_CHANNEL_ID);
      if (logsChannel && event && event_player) {
        let embedColor = 0x39da8a; // Green for join
        let emoji = "🟢";
        let actionWord = "s'est connecté";

        if (event === "leave") {
          embedColor = 0xff5b5c; // Red for leave
          emoji = "🔴";
          actionWord = "s'est déconnecté";
        }

        const embed = new EmbedBuilder()
          .setTitle(`${emoji} GMod: Player Activity`)
          .setDescription(`**${event_player.rpname}** (${event_player.steamid}) **${actionWord}**.\n**Métier:** ${event_player.job || "Citizen"}\n**Session:** ${Math.floor((event_player.session_playtime || 0) / 60)} min`)
          .setColor(embedColor)
          .setTimestamp();

        await logsChannel.send({ embeds: [embed] });
      }

      return res.json({ success: true });
    } catch (error) {
      client.logger?.send(`[API GMOD] Error /sync: ${error.message}`, "ERROR");
      return res.status(500).json({ error: error.message });
    }
  });

  // GMod polls actions queue (e.g. Boutique, commands)
  app.get("/api/gmod/actions", authGmod, async (req, res) => {
    try {
      const db = getKnex();
      
      // Get all pending actions
      const actions = await db("gmod_actions")
        .select("id", "steamid", "action_type", "action_value")
        .where("status", "pending");

      if (actions.length > 0) {
        // Mark as sent
        const actionIds = actions.map(a => a.id);
        await db("gmod_actions")
          .whereIn("id", actionIds)
          .update({ status: "sent" });
        
        client.logger?.send(`[API GMOD] Envoyé ${actions.length} action(s) au serveur GMod`, "INFO");
      }

      return res.json({ success: true, actions });
    } catch (error) {
      client.logger?.send(`[API GMOD] Error /actions: ${error.message}`, "ERROR");
      return res.status(500).json({ error: error.message });
    }
  });

  // GMod reports action execution result
  app.post("/api/gmod/action-result", authGmod, async (req, res) => {
    try {
      const db = getKnex();
      const { action_id, success, error } = req.body;

      if (!action_id) {
        return res.status(400).json({ error: "Paramètres invalides" });
      }

      await db("gmod_actions")
        .where("id", action_id)
        .update({
          status: success ? "executed" : "failed",
          executed_at: db.fn.now(),
          error_message: error || null
        });

      client.logger?.send(`[API GMOD] Action #${action_id} reportée comme ${success ? "EXECUTÉE" : "ÉCHOUÉE"}` + (error ? `: ${error}` : ""), "INFO");
      return res.json({ success: true });
    } catch (error) {
      client.logger?.send(`[API GMOD] Error /action-result: ${error.message}`, "ERROR");
      return res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // 💻 ENDPOINTS DASHBOARD
  // ==========================================

  // Dashboard Stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const db = getKnex();

      // Counts from DB
      const totalRegistered = await db("gmod_players").count({ count: "*" }).first();
      const totalPlaytimeSum = await db("gmod_players").sum({ sum: "playtime" }).first();

      // Get recent transactions for activity logs
      const recentTransactions = await db("transactions")
        .select("transactions.*", "users.username")
        .leftJoin("users", "transactions.user_id", "users.user_id")
        .orderBy("transactions.created_at", "desc")
        .limit(5);

      // Get recent active demands
      const recentTickets = await db("tickets")
        .select("id", "ticket_number", "type", "status", "opened_at")
        .orderBy("opened_at", "desc")
        .limit(5);

      return res.json({
        success: true,
        server: {
          name: serverInfo.name,
          map: serverInfo.map,
          maxPlayers: serverInfo.maxPlayers,
          playersOnline: onlinePlayers.length,
          status: "online"
        },
        players: onlinePlayers,
        stats: {
          totalRegistered: totalRegistered?.count || 0,
          totalPlaytimeHours: Math.floor((totalPlaytimeSum?.sum || 0) / 3600)
        },
        recentActivity: {
          transactions: recentTransactions,
          tickets: recentTickets
        }
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Get Players List (for leaderboard / search)
  app.get("/api/dashboard/players", async (req, res) => {
    try {
      const db = getKnex();
      const players = await db("gmod_players")
        .select("*")
        .orderBy("playtime", "desc")
        .limit(100);

      return res.json({ success: true, players });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Get Shop Items
  app.get("/api/dashboard/shop", async (req, res) => {
    try {
      const db = getKnex();
      let items = await db("shop_items").select("*").where("enabled", true);

      // Bootstrap shop items if database is clean and empty
      if (items.length === 0) {
        const defaultItems = [
          { code: "vip_1m", name: "VIP Crimson 1 Mois", description: "Grade VIP sur le serveur GMod pendant 1 mois. Accès aux jobs VIP, salons exclusifs et bonus d'argent (+50%).", price: 10, type: "role", enabled: true },
          { code: "money_50k", name: "Pack Argent $50,000", description: "Ajoute immédiatement $50,000 en banque sur votre personnage GMod.", price: 5, type: "other", enabled: true },
          { code: "money_100k", name: "Pack Argent $100,000", description: "Ajoute immédiatement $100,000 en banque sur votre personnage GMod.", price: 8, type: "other", enabled: true },
          { code: "starter_pack", name: "Starter Pack Braquage", description: "Contient $20,000, 1 Marteau de braquage, 1 Serflex et 1 Radio.", price: 6, type: "other", enabled: true }
        ];

        for (const item of defaultItems) {
          await db("shop_items").insert(item);
        }
        items = await db("shop_items").select("*").where("enabled", true);
      }

      return res.json({ success: true, items });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Buy Shop Item
  app.post("/api/dashboard/buy", async (req, res) => {
    try {
      const db = getKnex();
      const { steamid, package_code, discord_id } = req.body;

      if (!steamid || !package_code) {
        return res.status(400).json({ error: "SteamID et Code de Pack requis" });
      }

      // Check if package exists
      const item = await db("shop_items").where("code", package_code).first();
      if (!item) {
        return res.status(404).json({ error: "Pack non trouvé" });
      }

      // Verify or create player in DB
      let gmodPlayer = await db("gmod_players").where("steamid", steamid).first();
      const rpName = gmodPlayer ? gmodPlayer.rpname : `Joueur ${steamid}`;

      // Insert pending GMod action in queue
      let actionType = "lua_cmd";
      let actionValue = "";

      if (package_code === "vip_1m") {
        actionType = "give_vip";
        actionValue = "vip";
      } else if (package_code === "money_50k") {
        actionType = "give_money";
        actionValue = "50000";
      } else if (package_code === "money_100k") {
        actionType = "give_money";
        actionValue = "100000";
      } else if (package_code === "starter_pack") {
        // Run customized Lua code block to give money + weapons
        actionType = "lua_cmd";
        actionValue = `
          local ply = player.GetBySteamID("${steamid}")
          if IsValid(ply) then
            ply:addMoney(20000)
            ply:Give("weapon_stunstick") -- stun baton
            ply:ChatPrint("[Boutique] Starter Pack Braquage appliqué ! +$20,000 & Matraque reçus.")
          end
        `;
      }

      // Queue the action
      await db("gmod_actions").insert({
        steamid,
        action_type: actionType,
        action_value: actionValue,
        status: "pending",
        created_at: db.fn.now()
      });

      // Insert transaction simulation
      const userId = discord_id || "123456789012345678"; // Fallback placeholder
      // Ensure user exists in users table to satisfy foreign key constraints
      const userExists = await db("users").where("user_id", userId).first();
      if (!userExists) {
        await db("users").insert({
          user_id: userId,
          username: "Web User",
          discriminator: "0000",
          balance: 1000
        });
      }

      await db("transactions").insert({
        user_id: userId,
        type: "shop_buy",
        amount: -item.price,
        balance_after: 0,
        description: `Achat boutique GMod: ${item.name} pour SteamID: ${steamid}`
      });

      // Send Discord announcement
      const syncChannelId = process.env.SYNC_CHANNEL_ID || process.env.WELCOME_CHANNEL_ID;
      const channel = client.channels.cache.get(syncChannelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle("🛍️ Achat Boutique Crimson RP")
          .setDescription(`Un grand merci à **${rpName}** (${steamid}) qui vient d'acquérir le pack **${item.name}** depuis le Dashboard en ligne !`)
          .addFields(
            { name: "Pack", value: item.name, inline: true },
            { name: "Description", value: item.description, inline: false }
          )
          .setColor(0xff9f43)
          .setThumbnail("https://i.imgur.com/ZoOiFus.png")
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
      }

      return res.json({ success: true, message: "Achat validé et mis en attente d'exécution GMod.", rpName });
    } catch (error) {
      client.logger?.send(`[API SHOP] Error buying item: ${error.message}`, "ERROR");
      return res.status(500).json({ error: error.message });
    }
  });

  // Get Tickets List
  app.get("/api/dashboard/tickets", async (req, res) => {
    try {
      const db = getKnex();
      const tickets = await db("tickets").select("*").orderBy("opened_at", "desc");
      return res.json({ success: true, tickets });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Create Ticket
  app.post("/api/dashboard/tickets", async (req, res) => {
    try {
      const db = getKnex();
      const { subject, details, type, discord_id, accused, time, lost_items } = req.body;

      const userId = discord_id || "123456789012345678";
      // Ensure user exists in users table to satisfy foreign key constraints
      const userExists = await db("users").where("user_id", userId).first();
      if (!userExists) {
        await db("users").insert({
          user_id: userId,
          username: "Dashboard Guest",
          discriminator: "0000"
        });
      }

      const ticketNumber = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
      const channelId = `CH-${Math.floor(100000000000000 + Math.random() * 900000000000000)}`;

      const mappingType = {
        "Plainte contre un joueur / staff": "plainte",
        "Demande de remboursement": "recrutements", // Map to valid enum category
        "Bug / Dysfonctionnement": "questions",
        "Autre demande générale": "autres"
      };

      const dbType = mappingType[subject] || "autres";

      await db("tickets").insert({
        ticket_number: ticketNumber,
        channel_id: channelId,
        user_id: userId,
        type: dbType,
        status: "open",
        opened_at: db.fn.now()
      });

      // Log ticket creation to ticket logs database
      await db("ticket_logs").insert({
        guild_id: process.env.SYNC_GUILD_ID || "1438996721198825604",
        channel_id: channelId,
        ticket_number: ticketNumber,
        ticket_type: dbType,
        event: "ticket_created",
        actor_id: userId,
        owner_id: userId,
        details: `Ticket créé sur le Dashboard. Sujet: ${subject}. Détails: ${details || ""}`,
        created_at: db.fn.now()
      });

      // Send notification to Discord logs
      const ticketLogsChannelId = process.env.TICKET_LOG_CHANNEL_ID || process.env.LOGS_CHANNEL_ID;
      const logsChannel = client.channels.cache.get(ticketLogsChannelId);
      if (logsChannel) {
        let detailsText = details || "Aucun détail fourni.";
        if (dbType === "plainte" && accused) {
          detailsText = `**Accusé:** ${accused}\n**Date/Heure:** ${time}\n\n**Détails:** ${detailsText}`;
        } else if (subject === "Demande de remboursement" && lost_items) {
          detailsText = `**Objets perdus:** ${lost_items}\n\n**Détails:** ${detailsText}`;
        }

        const embed = new EmbedBuilder()
          .setTitle(`🎫 Nouveau Ticket: ${ticketNumber}`)
          .setDescription(`**Auteur:** <@${userId}>\n**Catégorie:** ${subject}\n\n**Description:**\n${detailsText}`)
          .setColor(0x5865f2)
          .setTimestamp();

        // Add claim/close button actions
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_claim_${ticketNumber}`)
            .setLabel("Prendre en charge")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`ticket_close_${ticketNumber}`)
            .setLabel("Fermer le Ticket")
            .setStyle(ButtonStyle.Danger)
        );

        await logsChannel.send({ embeds: [embed], components: [row] });
      }

      client.logger?.send(`[API TICKETS] Ticket ${ticketNumber} créé avec succès`, "INFO");
      return res.json({ success: true, ticket_number: ticketNumber });
    } catch (error) {
      client.logger?.send(`[API TICKETS] Error /tickets: ${error.message}`, "ERROR");
      return res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // ⚡ START LISTENING
  // ==========================================
  app.listen(port, () => {
    client.logger?.send(`[API SERVER] Express en ligne sur le port ${port}`, "READY");
  });
}

module.exports = { startServer };
