const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const path = require("path");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reglement")
    .setDescription("⚖️ Envoie le règlement du serveur dans le salon actuel ou un salon spécifié")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName("salon")
        .setDescription("Le salon où envoyer le règlement")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async executeCommand(client, interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetChannel = interaction.options.getChannel("salon") || interaction.channel;
    const bannerPath = path.join(__dirname, "../../assets/reglement_banner.png");
    
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("⚖️ Règlement du Serveur")
      .setDescription(
        `> **Règlement du Discord**\n` +
        `> \n` +
        `> 🤝 **Bonne entente et respect vont de pair, toutes entraves à ces règles ne seront pas tolérées:**\n` +
        `> - Les discriminations (racisme, sexisme, antisémitisme...)\n` +
        `> - Le harcèlement\n` +
        `> - Les insultes (quelle qu'en soit le type)\n` +
        `> - Les menaces\n` +
        `> - Les provocations\n` +
        `> - Le racket (nitros, grades...)\n` +
        `> - Les soundboards\n` +
        `> - Le troll\n` +
        `> - Les propos politiques\n` +
        `> \n` +
        `> 📣 **Pub:**\n` +
        `> La pub est interdite (message privé compris), ce n’est pas un serveur promotionnel sauf pour les familles dans <#1019889268501524480>\n` +
        `> \n` +
        `> 🗺️ **Serveur:**\n` +
        `> Tout serveur Discord ayant un lien avec le nôtre n'est pas officiellement affilié. Les problèmes liés à ce dernier ne relèvent pas de notre responsabilité.\n` +
        `> \n` +
        `> 🔔 **Mentions et spam:**\n` +
        `> Toutes mentions abusives et le spam sont interdits.\n` +
        `> \n` +
        `> 💡 **Fausses informations:**\n` +
        `> Les fausses informations sur votre personne ou sur une autre sont interdites (exemple: l’usurpation d’identité).\n` +
        `> \n` +
        `> ✍️ **Respect des salons:**\n` +
        `> Le respect des salons est primordial afin d'éviter que le serveur ne devienne un dépotoir. Chaque salon a une fonction précise, merci de la respecter (exemple: signaler quelqu'un ailleurs que dans les <#866402345268019260>)\n` +
        `> \n` +
        `> 🗃️ **Motif des tickets:**\n` +
        `> Veuillez utiliser le motif de ticket approprié en fonction de votre problème, sinon celui-ci sera fermé.\n` +
        `> \n` +
        `> 📁 **Tickets abusifs:**\n` +
        `> Les tickets abusifs (non pertinents multiples) seront sanctionnés et fermés directement.\n` +
        `> \n` +
        `> 🔞 **NSFW:**\n` +
        `> Toute divulgation de contenu potentiellement choquant est interdit.\n` +
        `> \n` +
        `> 🔑 **Contournement:**\n` +
        `> Les contournements de sanctions sont strictement interdits.\n` +
        `> \n` +
        `> 📑 **TOS et charte d'utilisation:**\n` +
        `> Vous devez respecter les TOS, ainsi que la charte d'utilisation de Discord.\n` +
        `> \n` +
        `> 🎇 **Pour finir:**\n` +
        `> En participant à l’activité du serveur, vous acceptez le fait d'être sanctionné si l'une de ces règles sont enfreintes.`
      )
      .setImage("attachment://reglement_banner.png")
      .setFooter({
        text: interaction.guild?.name || client.user.username,
        iconURL: client.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    const payload = { embeds: [embed] };
    
    if (fs.existsSync(bannerPath)) {
      const bannerAttachment = new AttachmentBuilder(bannerPath, { name: "reglement_banner.png" });
      payload.files = [bannerAttachment];
    }

    try {
      await targetChannel.send(payload);
      return interaction.editReply(`✅ Le règlement a bien été envoyé dans ${targetChannel}.`);
    } catch (error) {
      client.getLogger().send(`Error sending rules: ${error.message}`, "ERROR");
      return interaction.editReply("❌ Impossible d'envoyer le règlement (permissions manquantes ?).");
    }
  },

  settings: {
    module: "admin",
    enabled: true,
  },
};
