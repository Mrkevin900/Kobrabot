const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { getDatabase } = require("../../database/database");

const gmod = {
  data: new SlashCommandBuilder()
    .setName("gmod")
    .setDescription("Commandes d'administration et d'interconnexion Garry's Mod Dedicated Server")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // Subcommand: status
    .addSubcommand(sub =>
      sub
        .setName("status")
        .setDescription("Affiche l'état du serveur Garry's Mod en temps réel")
    )
    // Subcommand: players
    .addSubcommand(sub =>
      sub
        .setName("players")
        .setDescription("Liste tous les joueurs connectés sur le serveur GMod")
    )
    // Subcommand: give
    .addSubcommand(sub =>
      sub
        .setName("give")
        .setDescription("Donne de l'argent ou un grade VIP à un joueur en jeu (file d'attente GMod)")
        .addStringOption(opt =>
          opt
            .setName("steamid")
            .setDescription("Le SteamID du joueur (ex: STEAM_0:1:12345678)")
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName("type")
            .setDescription("Type d'avantage à attribuer")
            .setRequired(true)
            .addChoices(
              { name: "Argent en Banque", value: "money" },
              { name: "Grade VIP", value: "vip" }
            )
        )
        .addStringOption(opt =>
          opt
            .setName("valeur")
            .setDescription("La quantité d'argent (ex: 50000) ou le nom du grade (ex: vip)")
            .setRequired(true)
        )
    ),

  async executeCommand(client, interaction) {
    const db = getDatabase();
    if (!db) {
      return interaction.reply({
        content: "❌ Base de données MySQL non disponible.",
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "status") {
      const serverInfo = client.gmodServerInfo || { name: "Crimson RP Dedicated Server", map: "rp_rockford_v2b", maxPlayers: 24, playersOnline: 0 };
      const onlinePlayersCount = client.gmodOnlinePlayers?.length || 0;

      // Count total registered GMod players in db
      let totalRegistered = 0;
      try {
        const result = await db("gmod_players").count({ count: "*" }).first();
        totalRegistered = result?.count || 0;
      } catch (e) {}

      const embed = new EmbedBuilder()
        .setTitle("🎮 Statut du Serveur Garry's Mod")
        .setDescription(`Voici les informations en temps réel sur le serveur GMod :`)
        .addFields(
          { name: "Nom du Serveur", value: `\`${serverInfo.name}\``, inline: false },
          { name: "Carte", value: `\`${serverInfo.map}\``, inline: true },
          { name: "Joueurs Connectés", value: `\`${onlinePlayersCount}/${serverInfo.maxPlayers}\``, inline: true },
          { name: "Total Joueurs Enregistrés", value: `\`${totalRegistered}\``, inline: true },
          { name: "Statut", value: "🟢 **En Ligne**", inline: true }
        )
        .setColor(0x39da8a)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "players") {
      const players = client.gmodOnlinePlayers || [];
      if (players.length === 0) {
        return interaction.reply({
          content: "ℹ️ Aucun joueur n'est actuellement connecté sur le serveur Garry's Mod.",
          ephemeral: false
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎮 Joueurs Connectés (${players.length})`)
        .setColor(0x5865f2)
        .setTimestamp();

      let desc = "";
      players.forEach((p, idx) => {
        desc += `${idx + 1}. **${p.rpname}** (${p.steamid}) - *${p.job}* | 💰 $${p.wallet.toLocaleString()}\n`;
      });

      embed.setDescription(desc || "Aucune information de joueur disponible.");
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "give") {
      const steamid = interaction.options.getString("steamid").trim();
      const type = interaction.options.getString("type");
      const val = interaction.options.getString("valeur").trim();

      let actionType = "lua_cmd";
      let actionValue = "";
      let benefitText = "";

      if (type === "money") {
        const amt = parseInt(val);
        if (isNaN(amt) || amt <= 0) {
          return interaction.reply({ content: "❌ La valeur doit être un nombre valide et supérieur à 0 pour l'argent.", ephemeral: true });
        }
        actionType = "give_money";
        actionValue = String(amt);
        benefitText = `**$${amt.toLocaleString()}** en banque`;
      } else if (type === "vip") {
        actionType = "give_vip";
        actionValue = val.toLowerCase();
        benefitText = `le grade VIP **${val}**`;
      }

      try {
        // Queue the action
        await db("gmod_actions").insert({
          steamid,
          action_type: actionType,
          action_value: actionValue,
          status: "pending",
          created_at: db.fn.now()
        });

        // Send confirmation
        const embed = new EmbedBuilder()
          .setTitle("⚙️ Action GMod Planifiée")
          .setDescription(`L'action a été ajoutée à la file d'attente GMod. Elle sera exécutée dès que le joueur sera en jeu.`)
          .addFields(
            { name: "Cible (SteamID)", value: `\`${steamid}\``, inline: true },
            { name: "Avantage", value: benefitText, inline: true },
            { name: "Statut", value: "⏳ En attente de synchronisation GMod", inline: false }
          )
          .setColor(0xff9f43)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      } catch (error) {
        client.logger?.send(`[CMD GMOD GIVE] Error: ${error.message}`, "ERROR");
        return interaction.reply({ content: "❌ Une erreur SQL est survenue lors de l'enregistrement de l'action.", ephemeral: true });
      }
    }
  },

  settings: {
    module: "admin",
    enabled: true
  }
};

module.exports = { default: gmod };
