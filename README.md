<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:1a1a2e,50:7c3aed,100:a855f7&height=200&section=header&text=KobraBot&fontSize=80&fontColor=ffffff&fontAlignY=38&desc=Bot%20Discord%20Français%20Multi-Fonctions%20&descAlignY=58&descSize=20" alt="KobraBot Banner"/>

<br/>

[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/Node.js-≥18-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com)
[![License](https://img.shields.io/badge/License-GPL%20v3-a855f7?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.1.0-7c3aed?style=for-the-badge)](CHANGELOG.md)

<br/>

> 🐍 **KobraBot** est un bot Discord français complet et robuste, développé en **JavaScript** avec **Discord.js v14**.  
> Il intègre un système de modération avancée, de progression d'XP, d'AutoMod natif, de tickets avec bannières graphiques, de concours de cadeaux (giveaways) automatisés et une synchronisation complète avec l'API KobraLost (Garry's Mod).

<br/>

[📖 Installation](#-installation) · [🎮 Commandes](#-commandes) · [⚙️ Configuration](#️-configuration) · [📜 Déploiement Émojis](#-déploiement-des-émojis)

</div>

---

## ✨ Fonctionnalités Clés

<table>
<tr>
<td width="50%">

### 🛡️ Modération & Sécurité
- Commandes de modération : `ban`, `kick`, `mute`, `tempban`, `warn`, `clear`.
- Visualisation de l'historique judiciaire avec `/punishments` (accès restreint aux Admins et rôles autorisés).
- AutoMod natif Discord (anti-insultes, anti-liens, anti-mention) pour une latence nulle.
- Panel de sécurité et journalisation (logs) des événements.

### 📊 Niveaux & Progression
- Progression XP active par message écrit et temps passé en salon vocal.
- Cartes de rang générées dynamiquement en image (Canvas) via `/rank`.
- Système de séries de connexions (`/streak`) et statistiques de matchs (`/match`).
- Classement général interactif avec `/leaderboard`.

</td>
<td width="50%">

### 🎫 Tickets & Support
- Gestion complète de salons de support par catégories (Bug, Question, Plainte, Recrutement, Autre).
- Bannières d'en-tête locales et immersives pour chaque catégorie.
- Système d'administration et de rôles de support dédiés.

### 🎉 Concours (Giveaways)
- Système de création et d'inscription aux concours par boutons Discord.
- Watcher en tâche de fond pour la désignation automatique des gagnants après la date limite.

### 🔗 Synchronisation KobraLost RP
- Synchronisation complète des profils et pseudonymes des joueurs GMod.
- Suivi du statut des serveurs GMod et intégration avec BattleMetrics.
- Script d'intégration de base de données MySQL auto-initialisé au démarrage.

</td>
</tr>
</table>

---

## 📦 Installation

### Prérequis

- **Node.js** `>= 18.x`
- **MySQL** `8.0` (Local ou distant)
- Un **Bot Discord** configuré sur le [Discord Developer Portal](https://discord.com/developers/applications)

### 1. Télécharger le bot

```bash
git clone https://github.com/Mrkevin900/Kobrabot.git
cd Kobrabot
```

### 2. Installer les dépendances

Installez l'ensemble des modules requis :
```bash
npm install
```

### 3. Configurer l'environnement

Dupliquez le fichier d'exemple pour créer votre configuration locale :
```bash
cp .env.example .env
```
Ouvrez le fichier `.env` et complétez les informations requises :
- Vos jetons de bot (`CLIENT_TOKEN_PROD`/`CLIENT_TOKEN_TEST`) et IDs clients.
- Vos identifiants de base de données MySQL (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_BASE`).
- Les IDs de salons et rôles Discord cibles (bienvenue, départs, logs, tickets, staff, etc.).

> [!NOTE]  
> **Auto-Bootstrap Database** : Lors du premier démarrage du bot, si les tables MySQL vitales (`users`, `giveaways`, `user_progression`) sont absentes de votre base de données, KobraBot détecte automatiquement la situation et exécute le script d'initialisation de schéma `src/database/database_schema.sql` de manière transparente.

### 4. Déployer les commandes slash

Avant de démarrer le bot, déployez et synchronisez l'ensemble des commandes avec l'API Discord :
```bash
npm run start:sync
```

### 5. Démarrer le bot

```bash
# Lancement classique (Production)
npm start

# Lancement en mode développement (Rechargement automatique)
npm run dev
```

---

## 📜 Déploiement des Émojis

Le bot nécessite un ensemble d'émojis personnalisés dans son interface de réponses, stockés localement dans le répertoire `kbrp_emojis/`. 

Un script utilitaire permet d'importer et de configurer automatiquement ces émojis sur votre serveur Discord.

```bash
node src/utils/Scripts/deployEmojis.js
```

### Fonctionnement du script
1. Lit le contenu du dossier `kbrp_emojis/`.
2. Filtre et sélectionne les versions optimales de chaque émoji en ignorant les doublons.
3. Se connecte à Discord et compare avec les émojis déjà existants sur votre serveur cible (défini par `SYNC_GUILD_ID` dans le `.env`).
4. Importe uniquement les émojis manquants, avec une latence de sécurité afin d'éviter les limites de débit de Discord (rate limits).

---

## ⚙️ Variables d'Environnement Clés

| Variable | Description |
|---|---|
| `PRODUCTION` | Basculer en mode production (`TRUE`) ou test (`FALSE`). |
| `GOODBYE_CHANNEL_ID` | Salon où envoyer les cartes et messages d'au revoir. |
| `WELCOME_CHANNEL_ID` | Salon d'envoi des messages de bienvenue. |
| `PUNISHMENTS_VIEW_ROLE_ID` | ID du rôle autorisé à consulter les casiers judiciaires via `/punishments`. |
| `TICKET_STAFF_ROLE_ID` | Rôle staff autorisé à voir et gérer les tickets ouverts. |
| `SYNC_GUILD_ID` | ID du serveur Discord cible pour la synchronisation générale et les émojis. |
| `SQL_BASE` | Nom de la base de données MySQL. |

---

## 🎮 Exemples de Commandes

### Administration
- `/configuration` : Paramétrer le bot sur votre serveur.
- `/addstaff <user> <role>` : Ajouter un membre dans le tableau d'affichage du staff.
- `/liststaff` : Afficher la liste complète du staff.
- `/reglement [salon]` : Envoyer le règlement du serveur avec sa bannière associée.

### Progression
- `/rank [user]` : Afficher la carte de rang XP générée à la volée.
- `/leaderboard` : Consulter le classement XP du serveur.
- `/streak` : Afficher votre série de connexions consécutives.

### Modération
- `/ban <user> [raison]` : Bannir un membre.
- `/mute <user> <durée> [raison]` : Mettre en sourdine un membre.
- `/punishments <user>` : Consulter le casier judiciaire d'un utilisateur.
- `/clear <nombre>` : Purger un salon textuel.
