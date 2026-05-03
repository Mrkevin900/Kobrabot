# 🐍 KobraBot

> Bot Discord modulaire pour serveurs RP — développé en JavaScript avec `discord.js`, `mysql2`, `knex` et une synchronisation API RP.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![Discord.js](https://img.shields.io/badge/discord.js-14.x-blue)](https://discord.js.org)
[![Version](https://img.shields.io/badge/version-2.0.0-orange)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-GPL--3.0-red)](./license.txt)

---

## 📋 Fonctionnalités

- 🔗 **Synchronisation RP** — API Kobralost (rôles, pseudos, grades)
- ⭐ **Système de niveaux** — XP, cartes visuelles, récompenses, boutique
- 🎫 **Tickets** — Panel, logs, mirroring DM, transcripts
- 🛡️ **Modération** — Ban, kick, mute, warn, clear, punishments
- 🎙️ **Vocaux temporaires** — Panneaux interactifs, lock/public/privé
- 👋 **Bienvenue / Boost** — Cartes visuelles personnalisables
- 🎮 **Free Games** — Watcher Epic/Steam avec annonces automatiques
- 💡 **Suggestions** — Système de votes avec boutons
- 🤖 **AutoMod natif** — Délégué à l'API Discord (anti-spam, anti-liens, etc.)
- 📊 **Staff Board** — Tableau automatique mis à jour par rôle

---

## 🛠️ Pré-requis

- **Node.js** ≥ 18
- **MySQL** (ou MariaDB)
- Un **bot Discord** avec les intents Gateway activés
- Les **IDs Discord** du serveur, salons et rôles

---

## 🚀 Installation

### 1. Cloner et installer les dépendances

```bash
git clone https://github.com/votre-repo/kobrabot.git
cd kobrabot
npm install
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
# Éditez .env avec vos vraies valeurs
```

### 3. Configurer la base de données

La base de données est créée **automatiquement** au démarrage si elle n'existe pas.

### 4. Démarrer le bot

```bash
# Mode normal
npm start

# Avec synchronisation des slash commands (premier lancement)
npm run start:sync

# Mode développement (hot-reload)
npm run dev
```

---

## ⚙️ Configuration `.env`

Copiez `.env.example` en `.env` et remplissez **au minimum** :

```env
# Mode: FALSE = Test | TRUE = Production
PRODUCTION=FALSE

# Tokens Discord (portail développeur)
CLIENT_TOKEN_TEST=votre_token_ici
CLIENT_ID_TEST=votre_client_id_ici

# Base de données MySQL
SQL_HOST=localhost
SQL_USER=root
SQL_PASSWORD=votre_mot_de_passe
SQL_BASE=kobrabot

# Serveur Discord cible
SYNC_GUILD_ID=votre_guild_id
```

Voir `.env.example` pour la liste complète des variables disponibles.

---

## 📁 Structure du projet

```
kobravot/
├── index.js                    # Point d'entrée
├── .env                        # Configuration (non committé)
├── .env.example                # Template de configuration
├── package.json
├── src/
│   ├── interfaces/
│   │   └── application.js      # Classe principale du bot (Client étendu)
│   ├── commands/               # Commandes slash organisées par module
│   │   ├── administration/
│   │   ├── fun/
│   │   ├── info/
│   │   ├── levels/
│   │   ├── moderation/
│   │   ├── security/
│   │   ├── sync/
│   │   └── utility/
│   ├── events/                 # Handlers d'événements Discord
│   ├── interactions/           # Managers (Ticket, Vocal)
│   ├── automod/                # AutoModManager
│   ├── database/               # Connexion MySQL + schéma
│   ├── loaders/                # Chargeurs (commandes, handlers, syncAPI)
│   ├── logger/                 # LoggerManager Discord
│   ├── settings/               # Configs prod/test (intents, partials)
│   └── utils/                  # Utilitaires (XP, cache, logs, sync...)
├── data/                       # Données JSON persistantes
└── kbrp_emojis/                # Assets emoji du serveur
```

---

## 📜 Commandes disponibles

### 🔧 Administration
| Commande | Description |
|---|---|
| `/addstaff` | Ajouter un membre au staff board |
| `/liststaff` | Afficher le staff board |
| `/configuration` | Configurer le bot |
| `/config-check` | Vérifier la configuration |
| `/vocalsetup` | Configurer les vocaux temporaires |
| `/event` | Gérer les annonces d'événements |
| `/shutdown` | Arrêter le bot (owner) |

### 🛡️ Modération
| Commande | Description |
|---|---|
| `/ban` | Bannir un membre |
| `/unban` | Débannir un utilisateur |
| `/kick` | Expulser un membre |
| `/mute` | Rendre muet un membre |
| `/unmute` | Retirer le mute |
| `/warn` | Avertir un membre |
| `/punishments` | Voir les sanctions d'un membre |
| `/clear` | Purger des messages |

### ⭐ Niveaux
| Commande | Description |
|---|---|
| `/rank` | Voir son rang |
| `/classement` | Top 10 du serveur |
| `/levelshop` | Boutique de points |
| `/levels` | Informations sur les niveaux |
| `/levelpanel` | Configurer le système |
| `/leveladmin` | Administration des niveaux |
| `/resetlevel` | Réinitialiser un niveau |

### ℹ️ Informations
| Commande | Description |
|---|---|
| `/help` | Aide et liste des commandes |
| `/botinfo` | Informations sur le bot |
| `/serverinfo` | Informations sur le serveur |
| `/userinfo` | Informations sur un utilisateur |
| `/avatar` | Avatar d'un utilisateur |
| `/status` | Statut du bot |

### 🎟️ Tickets
| Commande | Description |
|---|---|
| `/ticket` | Gérer le système de tickets |

### 🎙️ Vocal
| Commande | Description |
|---|---|
| `/vocal` | Informations salon vocal actuel |
| `/vocalsetup` | Configurer les vocaux temporaires |

### 🎮 Fun
| Commande | Description |
|---|---|
| `/ping` | Latence du bot |
| `/say` | Faire parler le bot |
| `/suggest` | Envoyer une suggestion |
| `/8ball` | La boule magique |
| `/gifle` / `/kiss` | Commandes d'interaction |
| Et bien d'autres... | |

---

## 📜 Logs Fichier (optionnel)

Les logs sont affichés dans la console par défaut. Pour activer l'écriture dans des fichiers **avec rotation automatique** :

```env
LOG_FILE_ENABLED=true
LOG_FILE_PATH=./logs
LOG_MAX_SIZE_MB=5
LOG_KEEP_FILES=7
```

Les fichiers sont créés dans `logs/kobrabot-YYYY-MM-DD-HH-MM-SS.log` et tournent automatiquement à 5 MB (configurable). Les 7 derniers fichiers sont conservés.

---

## 🔐 Sécurité

- **Ne jamais committer `.env`** — il est dans `.gitignore`
- **Régénérez vos tokens** après tout partage du projet
- Les tokens Discord et credentials MySQL sont **uniquement dans `.env`**
- L'AutoMod est géré nativement par Discord (plus sécurisé)
- Rate limit de 3 secondes par commande et par utilisateur

---

## 🐛 Dépannage

### Le bot ne répond plus aux commandes

```bash
# Vérifier que les commandes sont bien synchronisées
npm run start:sync
```

### Problème de disque plein (sur serveur)

```bash
# Supprimer et réinstaller node_modules proprement
rm -rf node_modules/
npm ci
```

### La base de données ne se connecte pas

1. Vérifier `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_BASE` dans `.env`
2. La base est créée automatiquement si elle n'existe pas
3. Vérifier que le serveur MySQL est accessible

### Les slash commands n'apparaissent pas

1. Vérifier `CLIENT_ID_TEST` / `CLIENT_ID_PROD`
2. Vérifier `SYNC_GUILD_ID` ou `GUILD_ID`
3. Relancer avec `npm run start:sync`

---

## 📊 Rapport d'audit

Voir [REPORT.md](./REPORT.md) pour le rapport complet de l'audit disque et des corrections v2.0.0.

## 📝 Changelog

Voir [CHANGELOG.md](./CHANGELOG.md) pour l'historique des versions.

---

## 👤 Auteur

**Mrkevin** — [squadfinder.fr](https://squadfinder.fr)

## 📄 Licence

[GNU General Public License v3.0](./license.txt)
