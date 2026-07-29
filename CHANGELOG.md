# Changelog KobraBot

---

## v2.0.0 — Critical Disk Fix & Command Recovery Update (2026-05-03)

### Résumé
La version `v2.0.0` modernise KobraBot avec un nettoyage profond, une meilleure gestion des logs, et une correction critique du système de chargement des commandes.

### Ce qui a changé
- Correction du chemin mort dans `loadCommands.js` pour supprimer le fallback vers un dossier de commandes inexistant.
- Ajout d'un `LogRotator` dans `src/utils/logRotator.js` pour gérer l'archivage et la rotation des fichiers de log.
- Intégration du `LogRotator` dans le système de logging pour garantir une fermeture propre lors de l'arrêt du bot.
- Nettoyage disque important : suppression des fichiers de lock redondants et des assets/documents orphelins inutiles.
- Harmonisation de `package.json` avec des scripts clairs : `start`, `start:sync`, `dev`, `lint`, `format`.
- Sécurisation de l'environnement avec un `.env.example` masqué et un `.gitignore` renforcé.
- Optimisation de la configuration de démarrage du bot et des variables d'environnement.

### Détails techniques
- `loadCommands.js` ne tente plus de charger `src/api/commands/`.
- `logger.runtime.js` peut maintenant écrire les logs dans des fichiers sans impacter la sortie console.
- `LogRotator` :
  - rotation par taille (5 MB par défaut)
  - conservation des 7 derniers fichiers
  - rotation quotidienne à minuit
  - activation via `LOG_FILE_ENABLED=true`
- Mise à jour du `.gitignore` pour exclure :
  - `*.log`, `logs/`, `bun.lock`, `pnpm-lock.yaml`, `yarn.lock`, `doc/`, `tmp/`, `temp/`, fichiers IDE.

### Impact utilisateur
- Le bot démarre plus fiable et plus propre.
- Les logs sont gérés automatiquement et ne s'accumulent plus hors contrôle.
- La configuration est plus facile à maintenir.

---

## v1.4.0 — Mega Update Sécurité (précédent)

### Nettoyage et réorganisation
- Suppression des dépendances obsolètes (`quick.db`, `sqlite3`).
- Renommage de l'arborescence en minuscules pour compatibilité multi-OS.
- Nettoyage de plus de 45 fichiers obsolètes.
- Centralisation de l'accès MySQL dans `src/database/`.

### Logger avancé
- Création de `LoggerManager.js` pour des embeds de log professionnels.
- Traçabilité améliorée des messages édités et supprimés.
- Logs d'administration détaillés (`warn`, `mute`, `kick`, `ban`).
- Logs des exécutions de commandes slash.

### AutoMod natif
- Intégration de l'AutoMod native Discord avec `AutoModManager.js`.
- Ajout de règles par défaut : anti-spam, filtre d'insultes, anti-liens, anti-mentions massives.
- Retrait du système AutoMod lourd et remplacé par des règles natives plus performantes.
- Ajout de logs AutoMod via `autoModerationActionExecution`.
- Robustesse du welcome message : l'embed texte reste envoyé si la génération d'image échoue.

### Performance & stabilité
- Migration des caches vers `CacheManager` avec TTL pour éviter les fuites mémoire.
- Optimisation avec `Promise.all` dans les tâches asynchrones.
- Ajout d'un rate limit de 3 secondes par commande/utilisateur.
