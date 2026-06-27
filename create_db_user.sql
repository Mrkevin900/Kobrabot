-- ============================================================
-- 🗄️ CRÉATION BASE DE DONNÉES & UTILISATEUR KOBRABOT
-- À exécuter en tant qu'administrateur (root) sur votre serveur MySQL
-- ============================================================

-- 1. Création de la base de données
CREATE DATABASE IF NOT EXISTS `s1_bot` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Création de l'utilisateur
-- Le '%' permet des connexions depuis n'importe quel hôte (nécessaire si le bot n'est pas sur la même machine).
-- Si le bot tourne sur le même serveur que MySQL, vous pouvez remplacer '%' par 'localhost'.
CREATE USER IF NOT EXISTS 'u1_3IfSts6lV8'@'%' IDENTIFIED BY '9wC47!nYHyB15eEF^Si^^JR7';

-- 3. Attribution de tous les privilèges sur la base de données
GRANT ALL PRIVILEGES ON `s1_bot`.* TO 'u1_3IfSts6lV8'@'%';

-- 4. Rechargement des privilèges
FLUSH PRIVILEGES;

-- 5. Sélection de la base
USE `s1_bot`;

-- Le schéma complet des tables sera automatiquement créé par le bot lors de son démarrage réussi.
