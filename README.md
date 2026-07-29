<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:1a1a2e,50:7c3aed,100:a855f7&height=200&section=header&text=KobraBot&fontSize=80&fontColor=ffffff&fontAlignY=38&desc=Bot%20Discord%20Français%20Multi-Fonctions&descAlignY=58&descSize=20" alt="KobraBot Banner"/>

<br/>

[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/Node.js-≥18-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com)
[![License](https://img.shields.io/badge/License-GPL%20v3-a855f7?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-7c3aed?style=for-the-badge)](CHANGELOG.md)

<br/>

> 🐍 **KobraBot** est un bot Discord français complet, développé en **JavaScript** avec **Discord.js v14**.  
> Il embarque un système de modération avancée, de niveaux XP, d'AutoMod natif, de tickets, de musique, et une intégration API KobraLost complète.

<br/>

[📖 Documentation](#-installation) · [🎮 Commandes](#-commandes) · [⚙️ Configuration](#️-configuration) · [📜 Changelog](CHANGELOG.md)

</div>

---

## ✨ Fonctionnalités

<table>
<tr>
<td width="50%">

### 🛡️ Modération
- Ban, Kick, Mute, Warn, TempBan, Unban, Unmute
- Historique des sanctions par joueur (`/punishments`)
- Suppression de messages en masse (`/clear`)
- Rate-limit anti-spam intégré (3s par commande)

### 📊 Niveaux & Progression
- Système XP par messages et temps vocal
- Cartes de rang générées dynamiquement (Canvas)
- Classement global (`/leaderboard`)
- Streaks et matchs (`/streak`, `/match`)

### 🎵 Musique
- Lecture audio via Lavalink / MagmaStream
- Panneau de contrôle interactif (boutons Discord)
- File d'attente, pause, skip, volume

</td>
<td width="50%">

### 🤖 AutoMod
- Anti-Spam, Filtre d'insultes, Anti-Liens
- Anti-Masse-Mention
- Intégration AutoMod natif Discord (zéro latence)
- Logs détaillés des infractions

### 🎫 Tickets & Support
- Système de tickets complet avec catégories
- Interface boutons/menus interactifs
- Gestion des rôles staff

### 🔗 Intégration API KobraLost
- Synchronisation des données joueurs en temps réel
- Informations profil, stats, calendrier d'événements
- Système de familles / gangs

</td>
</tr>
</table>

---

## 📦 Installation

### Prérequis

- **Node.js** `>= 18.x`
- **MySQL** `8.0` (local ou distant)
- **Lavalink** (pour la musique, optionnel)
- Un **bot Discord** créé sur le [Portail Développeur](https://discord.com/developers/applications)

### 1. Cloner le dépôt

```bash
git clone https://github.com/Mrkevin900/Kobrabot.git
cd Kobrabot
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'environnement

Copie le fichier exemple et remplis tes valeurs :

```bash
cp .env.example .env
```

> Voir la section [⚙️ Configuration](#️-configuration) pour le détail de chaque variable.

### 4. Lancer le bot

```bash
# Démarrage standard
npm start

# Démarrage avec synchronisation des slash commands
npm run start:sync

# Mode développement (rechargement auto)
npm run dev
```

---

## ⚙️ Configuration

Voici les variables clés du fichier `.env` :

```env
# ── Mode ──────────────────────────────────────────────
PRODUCTION=FALSE                  # TRUE en production, FALSE en test

# ── Discord ───────────────────────────────────────────
CLIENT_TOKEN_PROD=ton_token_prod  # Token bot production
CLIENT_TOKEN_TEST=ton_token_test  # Token bot test
CLIENT_ID_PROD=client_id_prod
CLIENT_ID_TEST=client_id_test

# ── Base de données MySQL ─────────────────────────────
SQL_HOST=localhost
SQL_PORT=3306
SQL_USER=root
SQL_PASSWORD=ton_mot_de_passe
SQL_BASE=kobrabot

# ── Lavalink (Musique) ────────────────────────────────
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass

# ── Logs ──────────────────────────────────────────────
LOG_FILE_ENABLED=false            # true = sauvegarde logs dans /logs/
LOG_MAX_SIZE_MB=5                 # Taille max par fichier de log
LOG_MAX_FILES=7                   # Nombre de fichiers conservés

# ── Synchronisation ───────────────────────────────────
SYNC_COMMANDS=false               # true = sync slash commands au démarrage
```

---

## 🎮 Commandes

### 🛡️ Modération

| Commande | Description |
|---|---|
| `/ban <user> [raison]` | Bannir un membre |
| `/kick <user> [raison]` | Expulser un membre |
| `/mute <user> <durée> [raison]` | Réduire au silence un membre |
| `/unmute <user>` | Retirer le mute d'un membre |
| `/warn <user> <raison>` | Avertir un membre |
| `/unban <user>` | Débannir un membre |
| `/tempban <user> <durée>` | Bannir temporairement |
| `/clear <nombre>` | Supprimer des messages en masse |
| `/punishments <user>` | Voir l'historique des sanctions |

### 📊 Niveaux & Progression

| Commande | Description |
|---|---|
| `/rank [user]` | Afficher la carte de rang d'un utilisateur |
| `/leaderboard` | Classement XP du serveur |
| `/match` | Informations sur le dernier match |
| `/streak` | Afficher la série de connexions |

### ℹ️ Informations

| Commande | Description |
|---|---|
| `/help` | Afficher l'aide complète |
| `/botinfo` | Informations sur le bot |
| `/serverinfo` | Informations sur le serveur |
| `/userinfo [user]` | Informations sur un utilisateur |
| `/avatar [user]` | Afficher l'avatar d'un membre |
| `/status` | Statut des services du bot |
| `/player <pseudo>` | Informations sur un joueur KobraLost |
| `/vocal` | Stats vocales du serveur |

### 🔧 Administration

| Commande | Description |
|---|---|
| `/configuration` | Configurer le bot sur le serveur |
| `/config-check` | Vérifier la configuration actuelle |
| `/addstaff <user>` | Ajouter un membre au staff |
| `/liststaff` | Lister les membres du staff |
| `/event` | Gérer les événements |
| `/vocalsetup` | Configurer les salons vocaux privés |
| `/shutdown` | Éteindre le bot (admin uniquement) |

### 🎫 Utilitaires

| Commande | Description |
|---|---|
| `/ticket` | Ouvrir un ticket de support |
| `/sondage` | Créer un sondage |
| `/diag` | Diagnostic du bot |
| `/optimisation` | Optimiser le cache du bot |
| `/stat` | Statistiques rapides |

---

## 🗂️ Structure du projet

```
kobrabot/
├── index.js                    # Point d'entrée principal
├── package.json
├── .env                        # Variables d'environnement (non versionné)
├── .gitignore
├── CHANGELOG.md
└── src/
    ├── commands/               # Commandes slash (par catégorie)
    │   ├── administration/
    │   ├── fun/
    │   ├── info/
    │   ├── levels/
    │   ├── moderation/
    │   ├── security/
    │   ├── sync/
    │   └── utility/
    ├── events/                 # Événements Discord
    ├── database/               # Connexion & migrations MySQL
    ├── utils/                  # Utilitaires (XP, Canvas, Logs...)
    │   ├── ProgressionManager.js
    │   ├── RankCardManager.js
    │   ├── logRotator.js
    │   └── syncAPI.js
    ├── automod/                # Système AutoMod
    ├── interfaces/             # Classe Application principale
    ├── loaders/                # Chargeurs (commandes, events...)
    ├── logger/                 # Système de logs console/fichier
    └── settings/               # Configuration du serveur
```

---

## 🚀 Déploiement (Pterodactyl)

KobraBot est compatible avec les panels **Pterodactyl**. Variables d'environnement importantes pour la production :

```env
PRODUCTION=TRUE
SQL_HOST=<host-distant>
SQL_PORT=<port>
SYNC_COMMANDS=false    # Mettre true uniquement au premier démarrage
LOG_FILE_ENABLED=true
```

> ⚠️ Ne jamais versionner le fichier `.env` — il est exclu par défaut dans le `.gitignore`.

---

## 🛠️ Technologies

| Technologie | Usage |
|---|---|
| [Discord.js v14](https://discord.js.org) | Framework principal |
| [Node.js ≥ 18](https://nodejs.org) | Runtime JavaScript |
| [MySQL 8 + Knex.js](https://knexjs.org) | Base de données |
| [Canvas](https://www.npmjs.com/package/canvas) | Génération d'images (rang, bienvenue) |
| [Axios](https://axios-http.com) | Requêtes API |
| [Dayjs](https://day.js.org) | Gestion des dates |
| [Chalk](https://github.com/chalk/chalk) | Logs colorés en console |
| [Lavalink](https://github.com/lavalink-devs/Lavalink) | Moteur audio musique |

---

## 📜 Licence

Ce projet est distribué sous licence **GNU General Public License v3.0**.  
Voir le fichier [license.txt](license.txt) pour plus de détails.

---

<div align="center">

Développé avec ❤️ par **[mrkevin](https://squadfinder.fr)**

[![GitHub](https://img.shields.io/badge/GitHub-Mrkevin900-181717?style=for-the-badge&logo=github)](https://github.com/Mrkevin900)

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:a855f7,50:7c3aed,100:1a1a2e&height=100&section=footer" alt="footer"/>

</div>
