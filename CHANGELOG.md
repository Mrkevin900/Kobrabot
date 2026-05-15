# Changelog KobraBot

---

## v2.0.0 — Critical Disk Fix & Command Recovery Update *(2026-05-03)*

### 🔧 Corrections Commandes
- **Fix chemin mort `loadCommands.js`** : Suppression du fallback inutile vers `src/api/commands/` qui n'existait jamais — améliore le temps de démarrage.
- **Fermeture propre du LogRotator** : Intégration dans les handlers SIGINT/SIGTERM pour garantir que les logs sont flushés avant l'arrêt.

### 💾 Nettoyage Disque
- **Suppression de 3 fichiers de lock redondants** : `bun.lock` (113 KB), `pnpm-lock.yaml` (106 KB) — `package-lock.json` conservé uniquement.
- **Suppression de `party.png`** (85 KB) — image orpheline sans référence dans le code.
- **Suppression de `doc/BOT.md`** (246 KB) — documentation trop volumineuse pour la prod, ne doit pas être en repo.
- **Nettoyage `package.json`** : Suppression de `fs` (module natif Node, inutile en dépendance), `bun`, `pnpm`, `npm` des devDependencies. Déplacement de `prettier` en devDependency.

### ⚡ Optimisation
- **Nouveau `src/utils/logRotator.js`** : Système de rotation automatique des logs fichier.
  - Rotation par taille (défaut : 5 MB max par fichier)
  - Nettoyage automatique (conserve les 7 derniers fichiers)
  - Rotation quotidienne forcée (minuit)
  - Activable via `LOG_FILE_ENABLED=true` dans `.env`
  - Désactivé par défaut (zéro overhead si non utilisé)
- **`logger.runtime.js` amélioré** : Intégration du LogRotator — chaque log console peut être dupliqué dans un fichier (sans codes ANSI).

### 🔐 Sécurité
- **`.env.example` entièrement masqué** : Toutes les valeurs réelles remplacées par des placeholders clairs. Ajout des nouvelles variables de configuration (LogRotator, AUTOMOD, SYNC_COMMANDS).
- **`.gitignore` renforcé** : Ajout de `*.log`, `logs/`, `pnpm-lock.yaml`, `bun.lock`, `yarn.lock`, `doc/`, `tmp/`, `temp/`, fichiers IDE.

### 📁 Organisation
- **`package.json` v2.0.0** : Nouveaux scripts `start:sync` (avec `--sync-commands`), `dev` (avec `--watch` Node.js natif).
- **`PUBLIC_GUIDE.md`** déplacé de `doc/` vers la racine pour meilleure accessibilité.

### 📜 Documentation
- **`README.md`** mis à jour avec structure, installation, configuration et commandes.
- **`REPORT.md`** créé : rapport complet de l'audit disque et des corrections.

---

## v1.4.0 — Mega Update Sécurité *(précédent)*

### Phase 1 : Nettoyage et Réorganisation
- **Suppression des dépendances obsolètes** : Suppression de `quick.db` (et `sqlite3`), libérant de l'espace disque.
- **Réorganisation des dossiers** : Renommage complet de l'arborescence en minuscules pour assurer une compatibilité Linux/Windows parfaite (`src/commands`, `src/events`, `src/utils`, etc.).
- **Nettoyage de code mort** : Plus de 45 fichiers obsolètes liés à `quick.db` ont été supprimés.
- **Centralisation MySQL** : Les fonctions d'accès à la base de données ont été centralisées dans `src/database/`.

### Phase 2 : LoggerBot Avancé
- **Nouveau gestionnaire centralisé** : Création de `LoggerManager.js` générant des Embeds professionnels pour tous les événements du bot.
- **Traçabilité des messages** : Intégration avancée pour l'édition (`messageUpdate`) et la suppression (`messageDelete`) de messages, en conservant le contenu de l'ancien/nouveau message.
- **Traçabilité des commandes d'administration** : Les commandes `/warn`, `/mute`, `/kick`, et `/ban` (via `guildBanAdd`) enregistrent désormais l'auteur de la sanction et la raison dans les logs.
- **Traçabilité des exécutions** : Chaque commande slash exécutée par un utilisateur est maintenant loggée de manière propre.

### Phase 3 : Système AutoMod Puissant
- **AutoMod Natif (Badge Discord)** : Intégration de l'API AutoMod native de Discord (`AutoModManager.js`).
- **Règles par défaut** : Création automatique des filtres natifs : Anti-Spam, Filtre d'Insultes (presets Discord), Anti-Liens, et Anti-Masse-Mention.
- **Délégation à Discord** : L'ancien système d'AutoMod intrusif (qui lisait chaque message avec des requêtes lourdes) a été retiré, rendant le bot ultra-rapide tout en étant mieux protégé.
- **Logs AutoMod** : Implémentation de `autoModerationActionExecution` pour logger dans le bot chaque fois que Discord intercepte un message fautif.
- **Correction Bienvenue** : Fiabilisation du système de carte de bienvenue (`guildMemberAdd.js`). Si l'image (Canvacord) échoue, l'Embed texte est quand même envoyé.

### Phase 4 : Performance & Sécurité Maximale
- **Optimisation Mémoire (Memory Leaks)** : Migration de l'historique des spams (`counters`) et du cache des multiplicateurs XP vers `CacheManager` avec Time-To-Live (TTL), résolvant les fuites de mémoire (RAM).
- **Parallélisation** : Optimisation des boucles de traitement avec `Promise.all` (ex: Distribution différée de l'XP, Purge des salons vocaux privés, etc.), évitant les verrous (bottlenecks).
- **Anti-Spam Commandes (Rate Limit)** : Ajout d'une limite globale de 3 secondes par commande et par utilisateur pour éviter de surcharger l'API Discord et la base de données.
