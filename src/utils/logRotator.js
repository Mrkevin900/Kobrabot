/**
 * LogRotator — Rotation automatique des logs fichier
 * Gère l'écriture des logs dans des fichiers avec rotation par taille et par date.
 *
 * Variables d'environnement :
 *   LOG_FILE_ENABLED=true      — Active l'écriture dans les fichiers (défaut: false)
 *   LOG_FILE_PATH=./logs       — Répertoire des logs (défaut: ./logs)
 *   LOG_MAX_SIZE_MB=5          — Taille max d'un fichier log en MB avant rotation (défaut: 5)
 *   LOG_KEEP_FILES=7           — Nombre de fichiers de log conservés (défaut: 7)
 */

const fs = require("fs");
const path = require("path");

const LOG_DIR = process.env.LOG_FILE_PATH
  ? path.resolve(process.env.LOG_FILE_PATH)
  : path.join(process.cwd(), "logs");

const MAX_SIZE_BYTES =
  (parseFloat(process.env.LOG_MAX_SIZE_MB) || 5) * 1024 * 1024;

const KEEP_FILES = Math.max(1, parseInt(process.env.LOG_KEEP_FILES, 10) || 7);

let currentStream = null;
let currentFile = null;
let currentSize = 0;
let enabled = process.env.LOG_FILE_ENABLED === "true";
let _initialized = false;

// ─── Nettoyage automatique des anciens fichiers ───────────────────────────────

function cleanOldLogs() {
  try {
    if (!fs.existsSync(LOG_DIR)) return;

    const files = fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.startsWith("kobrabot-") && f.endsWith(".log"))
      .map((f) => ({
        name: f,
        fullPath: path.join(LOG_DIR, f),
        mtime: fs.statSync(path.join(LOG_DIR, f)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    const toDelete = files.slice(KEEP_FILES);
    for (const file of toDelete) {
      fs.unlinkSync(file.fullPath);
    }
  } catch (_) {
    // Ne jamais crasher à cause du nettoyage des logs
  }
}

// ─── Création d'un nouveau fichier de log ─────────────────────────────────────

function createNewStream() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = date.toISOString().slice(11, 19).replace(/:/g, "-"); // HH-MM-SS
    const fileName = `kobrabot-${dateStr}-${timeStr}.log`;
    const filePath = path.join(LOG_DIR, fileName);

    if (currentStream) {
      try {
        currentStream.end();
      } catch (_) {}
    }

    currentStream = fs.createWriteStream(filePath, { flags: "a", encoding: "utf8" });
    currentFile = filePath;
    currentSize = 0;

    cleanOldLogs();
  } catch (_) {
    enabled = false; // Désactiver si impossible d'écrire
  }
}

// ─── Initialisation ──────────────────────────────────────────────────────────

function init() {
  if (_initialized) return;
  _initialized = true;
  if (!enabled) return;
  createNewStream();
}

// ─── Écriture d'une ligne de log ─────────────────────────────────────────────

function writeLine(level, message) {
  if (!enabled) return;

  try {
    if (!_initialized) init();

    // Rotation si le fichier dépasse la taille max
    if (currentSize >= MAX_SIZE_BYTES) {
      createNewStream();
    }

    const timestamp = new Date().toISOString();
    // Nettoyer les codes couleur ANSI pour les fichiers
    const cleanMessage = String(message || "").replace(
      // eslint-disable-next-line no-control-regex
      /\u001B\[[0-9;]*m/g,
      ""
    );
    const line = `[${timestamp}] [${String(level).padEnd(14)}] ${cleanMessage}\n`;

    if (currentStream && !currentStream.destroyed) {
      currentStream.write(line);
      currentSize += Buffer.byteLength(line, "utf8");
    }
  } catch (_) {
    // Ne jamais crasher à cause des logs
  }
}

// ─── Nettoyage périodique (toutes les 24h) ────────────────────────────────────

if (enabled) {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
  setInterval(() => {
    cleanOldLogs();
    // Rotation quotidienne forcée
    if (currentStream) {
      createNewStream();
    }
  }, CLEANUP_INTERVAL).unref?.();
}

// ─── API publique ─────────────────────────────────────────────────────────────

module.exports = {
  /**
   * Initialise le rotateur (appelé automatiquement au premier write si non fait).
   */
  init,

  /**
   * Écrit une ligne dans le fichier de log actif.
   * @param {string} level — Niveau de log (ex: "ERROR", "INFO")
   * @param {string} message — Message à écrire
   */
  writeLine,

  /**
   * Indique si l'écriture fichier est activée.
   * @returns {boolean}
   */
  isEnabled: () => enabled,

  /**
   * Retourne le chemin du fichier log actif.
   * @returns {string|null}
   */
  currentLogFile: () => currentFile,

  /**
   * Force une rotation du fichier de log.
   */
  rotate: () => {
    if (enabled) createNewStream();
  },

  /**
   * Ferme le stream de log proprement (appelé à l'arrêt du bot).
   */
  close: () => {
    if (currentStream) {
      try {
        currentStream.end();
      } catch (_) {}
      currentStream = null;
    }
  },
};
