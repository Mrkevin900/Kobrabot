const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const ModerationDb = require("../../utils/ModerationDb");

const punishments = {
  data: new SlashCommandBuilder()
    .setName("punishments")
    .setDescription("⚖️ Affiche le casier judiciaire complet d'un joueur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt
        .setName("membre")
        .setDescription("Membre à vérifier")
        .setRequired(true),
    ),

  async executeCommand(client, interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const KobralostAPI = require("../../utils/KobralostAPI");
    const api = new KobralostAPI(client);

    const member = interaction.options.getUser("membre");
    if (!member) return interaction.editReply("❌ Membre introuvable.");

    // Resolve UUID
    let uuid = null;
    const playerRes = await api.findPlayerByDiscordId(member.id);
    if (playerRes.success && playerRes.data?.uuid) {
        uuid = playerRes.data.uuid;
    }

    let apiPunishments = [];
    let apiErrorStatus = 200;
    let hasApiAccess = false;

    if (uuid) {
        let res = await api.getAllPunishments(uuid);

        if (res.status === 403) {
            const PermissionManager = require("../../utils/PermissionManager");
            
            await interaction.editReply({ 
                content: `⌛ Demande d'autorisation envoyée par MP à **${member.username}**... En attente d'approbation.\n*(Le bot a besoin de permissions pour lire le casier depuis l'API)*`
            });

            const pollCallback = async () => {
                const checkRes = await api.getAllPunishments(uuid);
                return checkRes.status !== 403;
            };

            const approved = await PermissionManager.requestApproval(
                client, 
                interaction.user, 
                member, 
                "Casier judiciaire",
                pollCallback
            );

            if (!approved) {
                return interaction.editReply({ 
                    content: `❌ L'accès au casier de **${member.username}** a été refusé ou la demande a expiré.`
                });
            }

            // Refetch after approval
            res = await api.getAllPunishments(uuid);
            
            // Clear the waiting content message
            await interaction.editReply({ content: null });
        }

        if (res.success) {
            apiPunishments = res.data;
            hasApiAccess = true;
        } else {
            apiErrorStatus = res.status;
        }
    }

    // Local data
    const localData = await ModerationDb.getPunishments(client, member.id);
    const localPunishments = localData.map(p => ({ ...p, category: "Local" }));
    
    // Merge & Sort (Newest first)
    const all = [...localPunishments, ...apiPunishments].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.date || 0).getTime();
        const dateB = new Date(b.createdAt || b.date || 0).getTime();
        return dateB - dateA;
    });
    
    // Filter categories
    const adminPunishments = all.filter(p => ["moderation", "discord", "Local"].includes(p.category) || !p.category);
    const metierPunishments = all.filter(p => p.category === "team");

    let currentCategory = "admin";
    let currentPage = 0;
    const itemsPerPage = 6; // Increased for professionalism

    const generateEmbed = (cat, page) => {
        const list = cat === "admin" ? adminPunishments : metierPunishments;
        const totalPages = Math.max(1, Math.ceil(list.length / itemsPerPage));
        const safePage = Math.min(Math.max(0, page), totalPages - 1);
        const start = safePage * itemsPerPage;
        const pageItems = list.slice(start, start + itemsPerPage);

        const embed = new EmbedBuilder()
            .setTitle(`⚖️ Dossier Judiciaire • ${member.username}`)
            .setDescription(
                `👤 **Joueur:** ${member.tag}\n` +
                (uuid ? `🆔 **UUID:** \`${uuid}\`\n` : "") +
                `📊 **Statistiques:** ${list.length} sanction(s) ${cat === "admin" ? "administratives" : "métier"}`
            )
            .setColor(cat === "admin" ? 0x5865F2 : 0xEB459E)
            .setThumbnail(member.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        if (list.length === 0) {
            embed.addFields({ name: "✨ Casier Vierge", value: "Aucune sanction enregistrée dans cette catégorie." });
        } else {
            pageItems.forEach((p, index) => {
                const date = p.createdAt || p.date;
                const timestamp = date ? `<t:${Math.floor(new Date(date).getTime() / 1000)}:d>` : "Date inconnue";
                const type = String(p.type || "Sanction").toUpperCase();
                const source = p.category ? `[${p.category.toUpperCase()}]` : "[LOCAL]";
                const active = (p.active === true || p.active === 1) ? "🔴 **ACTIF**" : "⚪ *Expiré*";
                const gravity = p.gravity ? ` | \`${p.gravity}\`` : "";
                
                let body = `**Raison:** ${p.reason || "Non spécifiée"}\n` +
                           `**Auteur:** ${p.author?.name || p.authorId || (p.moderator ? `<@${p.moderator}>` : "Système")}\n` +
                           `**État:** ${active}${gravity}`;

                if (p.description && p.description !== p.reason) {
                    body += `\n**Note:** *${p.description.length > 100 ? p.description.substring(0, 97) + "..." : p.description}*`;
                }

                embed.addFields({ name: `📌 ${type} ${source} — ${timestamp}`, value: body, inline: false });
            });
        }

        let footer = `Page ${safePage + 1}/${totalPages} • KobraBot Judiciary System`;
        if (apiErrorStatus === 403 && !hasApiAccess) {
            footer = `⚠️ Accès API Restreint | ${footer}`;
        }
        embed.setFooter({ text: footer });

        return embed;
    };

    const getComponents = (cat, page) => {
        const list = cat === "admin" ? adminPunishments : metierPunishments;
        const totalPages = Math.max(1, Math.ceil(list.length / itemsPerPage));
        const safePage = Math.min(Math.max(0, page), totalPages - 1);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("page_prev").setLabel("◀️").setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0),
            new ButtonBuilder().setCustomId("cat_admin").setLabel("Admin").setStyle(cat === "admin" ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("cat_metier").setLabel("Métier").setStyle(cat === "metier" ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("page_next").setLabel("▶️").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1)
        );

        const components = [row];

        if (uuid) {
            const rowDash = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Détails complets sur le Dashboard")
                    .setURL(`https://dashboard.kobralost-rp.com/user/1/players/${uuid}/punishments`)
                    .setStyle(ButtonStyle.Link)
            );
            components.push(rowDash);
        }

        return components;
    };

    const response = await interaction.editReply({
        embeds: [generateEmbed(currentCategory, currentPage)],
        components: getComponents(currentCategory, currentPage)
    });

    const collector = response.createMessageComponentCollector({ time: 600000 }); // 10 mins

    collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: "Seul l'auteur peut changer de page.", flags: MessageFlags.Ephemeral });
        }

        if (i.customId === "page_prev") currentPage--;
        else if (i.customId === "page_next") currentPage++;
        else if (i.customId === "cat_admin") { currentCategory = "admin"; currentPage = 0; }
        else if (i.customId === "cat_metier") { currentCategory = "metier"; currentPage = 0; }

        await i.update({
            embeds: [generateEmbed(currentCategory, currentPage)],
            components: getComponents(currentCategory, currentPage)
        });
    });
  },

  settings: {
    module: "moderation",
    enabled: true,
  },
};

module.exports = { default: punishments };
