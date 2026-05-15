const ms = require('ms')

module.exports = {
    name: 'tempban',
    aliases: [],
    run: async (client, message, args, prefix, color) => {
        if (message.member.permissions.has("BAN_MEMBERS")){
            let member = message.mentions.members.first() || message.guild.members.cache.get(args[0])
        if (!member) return message.reply(`❌ Aucune personne trouvée !`)

        let temps = args[1]
        let raison = args.slice(2).join(' ')
        if (!raison) raison = "Aucune raison donnée"
        if (isNaN(ms(temps))) return message.reply("🗣️ Veuillez un indiquer une durée !")
        member.ban(`Banni par ${message.author.tag} pendant ${temps} pour ${raison}`).catch(() => false)

        setTimeout(() => {
            member.unban(`Fin du tempban`).catch(() => false)
        }, ms(temps));
        }
    }
}
