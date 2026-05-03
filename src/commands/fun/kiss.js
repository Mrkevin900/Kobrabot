const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const kissGifs = [
  "https://media.tenor.com/SZ8-4vDwi6cAAAAM/miyamura-hori.gif",
  "https://media.tenor.com/NO6j5K8YuRAAAAAM/leni.gif",
  "https://media.tenor.com/g92jdEmFrn0AAAAM/anime-kiss-anime.gif",
  "https://media.tenor.com/-tGrNiv2e_AAAAAM/ali-ecrin.gif",
  "https://media.tenor.com/XB3mEB77l7EAAAAM/kiss.gif",
  "https://media.tenor.com/LOWcGLwNC2AAAAAM/dabi.gif",
  "https://media.tenor.com/H7ElWf1bKUkAAAAM/anime-kiss-miyamura-kiss.gif",
  "https://media.tenor.com/25Rz_PwWSHgAAAAM/anime-kiss.gif",
  "https://media.tenor.com/hK8IUmweJWAAAAAM/kiss-me-%D0%BB%D1%8E%D0%B1%D0%BB%D1%8E.gif",
  "https://media.tenor.com/sbMBW4a-VN4AAAAM/anime-kiss.gif",
  "https://media.tenor.com/L-NTpww8HTUAAAAM/kiss-anime-anime-kiss.gif",
  "https://media.tenor.com/2-Wymg2o2iYAAAAM/oshi-no-ko-onk.gif",
  "https://media.tenor.com/lyuW54_wDU0AAAAM/kiss-anime.gif",
  "https://media.tenor.com/L-NTpww8HTUAAAAM/kiss-anime-anime-kiss.gif",
  "https://media.tenor.com/g8AeFZoe7dsAAAAM/kiss-anime-kiss.gif",
  "https://media.tenor.com/ItYRNh6P-Q8AAAAM/kiss-hori-miya.gif",
  "https://media.tenor.com/4KLQYilRM0IAAAAM/anime-val-ally.gif",
  "https://media.tenor.com/fFXn6UF_Dt4AAAAM/yuki-yuki-and-itsuomi-kiss.gif",
  "https://media.tenor.com/nqp2ZsxCj54AAAAM/anime-kiss-anime.gif",
  "https://media.tenor.com/qnrnHJojgx8AAAAM/anime-lesbians.gif",
  "https://media.tenor.com/c0YBJLTUvioAAAAM/takt-op-destiny-takt-and-anna.gif",
  "https://media.tenor.com/rWP3G1_WyZAAAAAM/anime-kiss-kiss.gif",
  "https://media.tenor.com/i_XER1f674AAAAAM/shizuku.gif",
  "https://media.tenor.com/3DHc1_2PZ-oAAAAM/kiss.gif",
  "https://media.tenor.com/ZuZTRDf__hQAAAAM/kiss.gif",
  "https://media.tenor.com/xGfzOqMVt4AAAAAM/anime.gif",
  "https://media.tenor.com/n2UTCb3vyHMAAAAM/darling-and002.gif",
  "https://media.tenor.com/rVJ3ONfODg4AAAAM/eris-mushoku.gif",
  "https://media.tenor.com/qGwV4sHYkegAAAAM/anime-kiss-love.gif",
  "https://media.tenor.com/05pHS9Wn_hcAAAAM/engage-kiss-anime-kiss.gif",
  "https://media.tenor.com/qDwclum7vqQAAAAM/black-aesthetic.gif",
  "https://media.tenor.com/uWRURodhrKYAAAAM/yuzu-x-mei10-citrus.gif",
  "https://media.tenor.com/kRMTd3OW_n0AAAAM/anime-kiss.gif",
  "https://media.tenor.com/5Vu_lqnSWY8AAAAM/anime-kiss.gif",
  "https://media.tenor.com/tRSq006tGDsAAAAM/anime-kiss.gif",
  "https://media.tenor.com/--MVHdjEn8UAAAAM/love-anime.gif",
  "https://media.tenor.com/2PcIda3662kAAAAM/their.gif",
  "https://media.tenor.com/ali-zPMJvRsAAAAM/kiss-anime.gif",
  "https://media.tenor.com/LZlrJ0Vp7XYAAAAM/anime-kiss-kiss.gif",
  "https://media.tenor.com/VS9ZNDV-PNUAAAAM/anime-kiss.gif",
  "https://media.tenor.com/Sv8LQZAoQmgAAAAM/chainsaw-man-csm.gif",
  "https://media.tenor.com/xqxgr-wfiJMAAAAM/anime.gif",
  "https://tenor.com/fr/view/slap-gif-20126850",
  "https://tenor.com/fr/view/slap-gif-20126989",
  "https://media.tenor.com/E3OW-MYYum0AAAAM/no-angry.gif",
  "https://media.tenor.com/1-1M4PZpYcMAAAAM/tsuki-tsuki-ga.gif",
  "https://tenor.com/fr/search/handa-seishuu-gifs",
  "https://media.tenor.com/2J2Leu-RoVsAAAAM/eureka-7-eureka-seven.gif",
  "https://media.tenor.com/24XQteNk3K0AAAAM/anime-girls.gif",
  "https://media.tenor.com/m14m8vGLFugAAAAM/asobi-asobase-anime.gif",
  "https://media.tenor.com/umXpRY6EYmgAAAAM/mushokutensei-slap.gif",
  "https://media.tenor.com/Fs0QfuMH-4UAAAAM/anime-manga.gif",
  "https://media.tenor.com/Ao52XTMY1RcAAAAM/slap.gif",
  "https://media.tenor.com/-nUvNvpdFJYAAAAM/working-wagnaria.gif",
  "https://media.tenor.com/NMvI03LMTzIAAAAM/mushoku-tensei-boy-hit-girl.gif",
  "https://media.tenor.com/-wfr09tbkwcAAAAM/discord-anime.gif",
  "https://media.tenor.com/DTVNVJrDdJIAAAAM/my-collection-anime.gif",
  "https://media.tenor.com/j6UWDrX6ZrwAAAAM/arima-ichika-ichika.gif",
  "https://media.tenor.com/UDo0WPttiRsAAAAM/bunny-girl-slap.gif",
  "https://media.tenor.com/bHE5Txlp5-8AAAAM/slap-butts-anime.gif",
  "https://media.tenor.com/DTVNVJrDdJIAAAAM/my-collection-anime.gif",
  "https://media.tenor.com/7xFcP1KWjY0AAAAM/no.gif",
  "https://media.tenor.com/Ws6Dm1ZW_vMAAAAM/girl-slap.gif",
  "https://media.tenor.com/WWE1BxoPzv4AAAAM/my-hero-academia-anime.gif",
  "https://media.tenor.com/HTHoXnBc400AAAAM/in-your-face-slap.gif",
  "https://media.tenor.com/24XQteNk3K0AAAAM/anime-girls.gif",
  "https://media.tenor.com/TGO7qG_lEDQAAAAM/ogata-rina-white-album-anime.gif",
  "https://media.tenor.com/L0fsdBYmh_wAAAAM/kokoro-connect-slap-anime.gif",
];

const kiss = {
  data: new SlashCommandBuilder()
    .setName("kiss")
    .setDescription("✨ Envoie un bisou en mode anime a un membre")
    .addUserOption((option) =>
      option
        .setName("membre")
        .setDescription("\u2728 La personne que tu veux embrasser")
        .setRequired(true),
    ),

  async executeCommand(client, interaction) {
    const membre = interaction.options.getUser("membre");
    const auteur = interaction.user;
    const kbrpEmoji = client.mascot("\u{1F497}");

    if (membre.id === auteur.id) {
      return interaction.reply({
        content: "Tu ne peux pas t'embrasser toi-meme, voyons.",
        ephemeral: true,
      });
    }

    const gif = kissGifs[Math.floor(Math.random() * kissGifs.length)];

    const embed = new EmbedBuilder()
      .setColor("#FFB6C1")
      .setTitle(`${kbrpEmoji} BISUO !`)
      .setDescription(
        `**${auteur.username}** embrasse tendrement **${membre.username}** !`,
      )
      .setImage(gif)
      .setFooter({ text: "Quelle tendresse..." })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  settings: {
    module: "general",
    enabled: true,
  },
};

module.exports = { default: kiss };




