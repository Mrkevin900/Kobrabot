require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");

// Paths
const EM_DIR = path.join(__dirname, "..", "..", "..", "kbrp_emojis");

async function deploy() {
  console.log("=== DEPLOYMENT DES EMOJIS DE KOBRABOT ===");

  if (!fs.existsSync(EM_DIR)) {
    console.error(`Erreur: Le dossier des emojis n'existe pas a l'adresse: ${EM_DIR}`);
    process.exit(1);
  }

  // 1. Lire et filtrer les emojis
  const files = fs.readdirSync(EM_DIR);
  console.log(`Trouve ${files.length} fichiers dans ${EM_DIR}. Selection des versions optimales...`);

  const groups = Object.create(null);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".gif"].includes(ext)) continue;

    const baseName = path.basename(file, ext);
    
    // Normaliser le nom: enlever les suffixes de taille comme _28, _56, _112, _200, _1500
    let cleanName = baseName.replace(/_(28|56|112|200|1500)$/i, "").trim();
    // Normaliser les espaces et caracteres speciaux pour Discord (lettres, chiffres, underscores uniquement)
    cleanName = cleanName.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/__+/g, "_").replace(/^_+|_+$/g, "");

    if (!groups[cleanName] || !Array.isArray(groups[cleanName])) {
      groups[cleanName] = [];
    }
    groups[cleanName].push({ file, baseName });
  }

  const selectedEmojis = [];

  for (const [cleanName, fileList] of Object.entries(groups)) {
    // Choisir le meilleur fichier de la liste
    // Priorité : 
    // 1. Fichier dont le nom sans extension est exactement le nom de base
    // 2. Fichier contenant "_112"
    // 3. Fichier contenant "_56"
    // 4. Premier fichier de la liste
    let best = fileList.find(f => {
      const b = f.baseName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      return b === cleanName;
    });

    if (!best) {
      best = fileList.find(f => f.baseName.includes("_112"));
    }
    if (!best) {
      best = fileList.find(f => f.baseName.includes("_56"));
    }
    if (!best) {
      best = fileList[0];
    }

    selectedEmojis.push({
      name: cleanName,
      filePath: path.join(EM_DIR, best.file),
      originalFile: best.file
    });
  }

  console.log(`\nSelectionne ${selectedEmojis.length} emojis uniques a deployer :`);
  selectedEmojis.forEach(e => console.log(` - ${e.name} (source: ${e.originalFile})`));

  // 2. Connexion a Discord
  const isProd = process.env.PRODUCTION === "TRUE";
  const token = isProd ? process.env.CLIENT_TOKEN_PROD : process.env.CLIENT_TOKEN_TEST;
  const guildId = process.env.SYNC_GUILD_ID;

  if (!token) {
    console.error("Erreur: Token Discord manquant dans le fichier .env (CLIENT_TOKEN_PROD ou CLIENT_TOKEN_TEST)");
    process.exit(1);
  }
  if (!guildId) {
    console.error("Erreur: SYNC_GUILD_ID manquant dans le fichier .env");
    process.exit(1);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers]
  });

  client.once("ready", async () => {
    console.log(`\nConnecte en tant que : ${client.user.tag}`);
    
    try {
      const guild = await client.guilds.fetch(guildId);
      if (!guild) {
        console.error(`Erreur: Impossible de trouver le serveur avec l'ID ${guildId}`);
        client.destroy();
        process.exit(1);
      }

      console.log(`Serveur cible : ${guild.name} (${guild.id})`);

      // Recuperer les emojis existants du serveur
      const existingEmojis = await guild.emojis.fetch();
      console.log(`Le serveur possede deja ${existingEmojis.size} emojis.`);

      let createdCount = 0;
      let skippedCount = 0;

      for (const emoji of selectedEmojis) {
        const exist = existingEmojis.find(e => e.name.toLowerCase() === emoji.name.toLowerCase());
        if (exist) {
          console.log(`[PASSER] ${emoji.name} existe deja.`);
          skippedCount++;
          continue;
        }

        try {
          console.log(`[IMPORTATION] ${emoji.name} depuis ${emoji.originalFile}...`);
          const fileBuffer = fs.readFileSync(emoji.filePath);
          
          await guild.emojis.create({
            attachment: fileBuffer,
            name: emoji.name
          });
          
          createdCount++;
          // Petit delai pour eviter le rate limit Discord
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (err) {
          console.error(`[ERREUR] Impossible de creer l'emoji ${emoji.name}:`, err.message);
        }
      }

      console.log(`\n=== DEPLOIEMENT TERMINE ===`);
      console.log(`Créés: ${createdCount} | Passés: ${skippedCount}`);

    } catch (err) {
      console.error("Une erreur critique est survenue durant le deploiement :", err);
    } finally {
      client.destroy();
      process.exit(0);
    }
  });

  await client.login(token);
}

deploy().catch(console.error);
