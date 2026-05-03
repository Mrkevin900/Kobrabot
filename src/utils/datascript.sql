/* Suppression de la base de données */
drop database if exists `nexabot_database`;
/* Recréation de la base de données */
create database if not exists `nexabot_database`;

/* Définir la base de données comme base de données d'éxécution */
use `nexabot_database`;

/*=====================================
TABLE DE DONNEES SERVERS
=====================================*/
start transaction;
    /* Suppression de la table servers */
    drop table if exists `servers_table`;
    /* Recréation de la table modules */
    create table if not exists `servers_table` (
        `server_id` varchar(20) not null,

        /* Mise en place des identifiants unique et clés primaires */
        unique index `servers_server_id_pkey`(`server_id`),
        primary key (`server_id`)
    ) engine=InnoDB default character set utf8mb4 collate utf8mb4_unicode_ci;
commit;

/*=====================================
TABLE DE DONNEES MODULES
=====================================*/

start transaction;
    /* Suppression de la table modules */
    drop table if exists `modules_table`;
    /* Recréation de la table modules */
    create table if not exists `modules_table` (
        `server_id` varchar(20) not null, /*ID su serveur*/
        `module_ar` integer not null default 0, /*Anti-Raid*/
        `module_mo` integer not null default 0, /*Modération*/
        `module_lv` integer not null default 0, /*Niveaux*/
        `module_ec` integer not null default 0, /*Economie*/
        `module_tk` integer not null default 0, /*Tickets*/
        `module_wc` integer not null default 0, /*Accueil & Boosts*/

        /* Mise en place des identifiants unique et clés primaires */
        unique index `modules_server_id_pkey`(`server_id`),
        primary key (`server_id`)
    ) engine=InnoDB default character set utf8mb4 collate utf8mb4_unicode_ci;
commit;

start transaction;
    /* Suppression de la table channels */
    drop table if exists `channels_table`;
    /* Recréation de la table channels */
    create table if not exists `channels_table` (
        `server_id` varchar(20) not null,
        `welcome_channel_id` varchar(20) not null default 'Non Défini',
        `goodbye_channel_id` varchar(20) not null default 'Non Défini',
        `rankups_channel_id` varchar(20) not null default 'Non Défini',
        `skipped_channel_id_1` varchar(20) not null default 'Non Défini',
        `skipped_channel_id_2` varchar(20) not null default 'Non Défini',
        `skipped_channel_id_3` varchar(20) not null default 'Non Défini',

        /* Mise en place des identifiants unique et clés primaires */
        unique index `channels_server_id_pkey`(`server_id`),
        primary key (`server_id`)
    ) engine=InnoDB default character set utf8mb4 collate utf8mb4_unicode_ci;
commit;

/*=====================================
TABLE DE DONNEES USERS
=====================================*/

start transaction;
    /* Suppression de la base d edonnées utilisateurs */
    drop table if exists `users_table`;
    /* Recréation de le abse de données utilisateurs */
    create table if not exists  `users_table` (
        `member_id` varchar(20) not null, /*ID de l'utilisateur*/
        `server_id` varchar(20) not null, /*ID du serveur*/
        `user_desc` varchar(191) not null default 'Aucune description fournie !',
        `user_level` integer not null default 1,
        `user_boost` char(1) not null default 'D',
        `user_xp_farmed` integer not null default 0,
        `user_xp_needed` integer not null default 200,
        `user_money` integer not null default 5000,
        `user_bank` integer not null default 0,
        `user_craft` integer not null default 0,

        /* Mise en place des identifiants unique et clés primaires */
        unique index `users_member_id_server_id_pkey`(`member_id`, `server_id`),
        primary key (`member_id`, `server_id`)
    ) engine=InnoDB default character set utf8mb4 collate utf8mb4_unicode_ci;
commit;

/*=====================================
TABLE DE DONNEES BANS
=====================================*/

start transaction;
    /* Suppression de la base de données ban */
    drop table if exists `ban_table`;
    /* Recréation de la base de données utilisateurs */
    create table if not exists  `ban_table` (
        `infraction_id` varchar(191) not null,
        `server_id` varchar(20) not null,
        `member_id` varchar(20) not null,
        `ban_date` varchar(191) not null,
        `ban_reason` varchar(191) not null default 'Aucune raison fournie !',
        `moderator` varchar(20) not null default 'Non Défini',

        /* Mise en place des identifiants unique et clés primaires */
        unique index `ban_infraction_id_pkey`(`infraction_id`, `member_id`),
        primary key (`infraction_id`, `member_id`)
    ) engine=InnoDB default character set utf8mb4 collate utf8mb4_unicode_ci;
commit;

/*=====================================
TABLE DE DONNEES KICK
=====================================*/

start transaction;
    /* Suppression de la base de données kick */
    drop table if exists `kick_table`;
    /* Recréation de la base de données utilisateurs */
    create table if not exists  `kick_table` (
        `infraction_id` varchar(191) not null,
        `server_id` varchar(20) not null,
        `member_id` varchar(20) not null,
        `kick_date` varchar(191) not null,
        `kick_reason` varchar(191) not null default 'Aucune raison fournie !',
        `moderator` varchar(20) not null default 'Non Défini',

        /* Mise en place des identifiants unique et clés primaires */
        unique index `kick_infraction_id_pkey`(`infraction_id`, `member_id`),
        primary key (`infraction_id`, `member_id`)
    ) engine=InnoDB default character set utf8mb4 collate utf8mb4_unicode_ci;
commit;

/*=====================================
TABLE DE DONNEES MUTE
=====================================*/

start transaction;
    /* Suppression de la base de données kick */
    drop table if exists `mute_table`;
    /* Recréation de la base de données utilisateurs */
    create table if not exists  `mute_table` (
        `infraction_id` varchar(191) not null,
        `server_id` varchar(20) not null,
        `member_id` varchar(20) not null,
        `mute_date` varchar(191) not null,
        `mute_reason` varchar(191) not null default 'Aucune raison fournie !',
        `moderator` varchar(20) not null default 'Non Défini',

        /* Mise en place des identifiants unique et clés primaires */
        unique index `mute_infraction_id_pkey`(`infraction_id`, `member_id`),
        primary key (`infraction_id`, `member_id`)
    ) engine=InnoDB default character set utf8mb4 collate utf8mb4_unicode_ci;
commit;

/*=====================================
TABLE DE DONNEES WARN
=====================================*/

start transaction;
    /* Suppression de la base de données warn */
    drop table if exists `warn_table`;
    /* Recréation de la base de données utilisateurs */
    create table if not exists  `warn_table` (
        `infraction_id` varchar(191) not null,
        `server_id` varchar(20) not null,
        `member_id` varchar(20) not null,
        `warn_date` varchar(191) not null,
        `warn_reason` varchar(191) not null default 'Aucune raison fournie !',
        `moderator` varchar(20) not null default 'Non Défini',

        /* Mise en place des identifiants unique et clés primaires */
        unique index `warn_infraction_id_pkey`(`infraction_id`, `member_id`),
        primary key (`infraction_id`, `member_id`)
    ) engine=InnoDB default character set utf8mb4 collate utf8mb4_unicode_ci;
commit;

/*=========================================
ALTERATION DES TABLES ( CLES ETRANGERES )
=========================================*/

/* Servers Tables */
alter table `modules_table` add constraint `modules_server_id_fkey` foreign key (`server_id`) references `servers_table`(`server_id`) on delete restrict on update cascade;
alter table `channels_table` add constraint `channels_server_id_fkey` foreign key (`server_id`) references `servers_table`(`server_id`) on delete restrict on update cascade;
alter table `users_table` add constraint `users_server_id_fkey` foreign key (`server_id`) references `servers_table` (`server_id`) on delete restrict on update cascade;
