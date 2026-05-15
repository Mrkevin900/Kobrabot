const { EmbedBuilder, Colors } = require("discord.js");

class LoggerManager {
  constructor(client) {
    this.client = client;
  }

  async getLogChannel(guild) {
    if (!guild) return null;
    const channelId = process.env.LOGS_CHANNEL_ID;
    if (!channelId) return null;
    return guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  }

  async sendEmbed(guild, embed) {
    const channel = await this.getLogChannel(guild);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] }).catch(() => null);
    }
  }

  async logMessageDelete(message) {
    if (!message || !message.guild || !message.author || message.author.bot) return;
    
    const embed = new EmbedBuilder()
      .setTitle("🗑️ Message Supprimé")
      .setColor(Colors.Red)
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setDescription(`Un message de **${message.author.tag}** a été supprimé dans ${message.channel}`)
      .addFields(
        { name: "Contenu", value: message.content ? message.content.substring(0, 1024) : "*Aucun contenu textuel*" }
      )
      .setFooter({ text: `Auteur ID: ${message.author.id} | Message ID: ${message.id}` })
      .setTimestamp();

    await this.sendEmbed(message.guild, embed);
  }

  async logMessageUpdate(oldMessage, newMessage) {
    if (!newMessage || !newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // Ignore embed updates
    
    const embed = new EmbedBuilder()
      .setTitle("✏️ Message Modifié")
      .setColor(Colors.Orange)
      .setAuthor({ name: newMessage.author.tag, iconURL: newMessage.author.displayAvatarURL() })
      .setDescription(`Un message de **${newMessage.author.tag}** a été modifié dans ${newMessage.channel}\n\n[Aller au message](${newMessage.url})`)
      .addFields(
        { name: "Avant", value: oldMessage.content ? oldMessage.content.substring(0, 1024) : "*Aucun*" },
        { name: "Après", value: newMessage.content ? newMessage.content.substring(0, 1024) : "*Aucun*" }
      )
      .setFooter({ text: `Auteur ID: ${newMessage.author.id}` })
      .setTimestamp();

    await this.sendEmbed(newMessage.guild, embed);
  }

  async logBan(guild, user, reason) {
    const embed = new EmbedBuilder()
      .setTitle("🔨 Membre Banni")
      .setColor(Colors.DarkRed)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(`**${user.tag}** a été banni du serveur.`)
      .addFields(
        { name: "Raison", value: reason || "Aucune raison fournie" }
      )
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    await this.sendEmbed(guild, embed);
  }

  async logUnban(guild, user) {
    const embed = new EmbedBuilder()
      .setTitle("🔓 Membre Débanni")
      .setColor(Colors.Green)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(`**${user.tag}** a été débanni du serveur.`)
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    await this.sendEmbed(guild, embed);
  }

  async logPunishment(guild, action, user, moderator, reason) {
    // action: "Kick", "Mute", "Warn"
    const colors = {
      "Kick": Colors.Orange,
      "Mute": Colors.Yellow,
      "Warn": Colors.Gold
    };
    
    const embed = new EmbedBuilder()
      .setTitle(`🛡️ Sanction: ${action}`)
      .setColor(colors[action] || Colors.Orange)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(`**${user.tag}** a reçu la sanction **${action}**.`)
      .addFields(
        { name: "Modérateur", value: moderator.tag, inline: true },
        { name: "Raison", value: reason || "Aucune raison fournie", inline: true }
      )
      .setFooter({ text: `User ID: ${user.id} | Mod ID: ${moderator.id}` })
      .setTimestamp();

    await this.sendEmbed(guild, embed);
  }

  async logCommand(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("💻 Commande Exécutée")
      .setColor(Colors.Blue)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .setDescription(`**${interaction.user.tag}** a utilisé la commande \`/${interaction.commandName}\` dans ${interaction.channel}`)
      .setFooter({ text: `User ID: ${interaction.user.id}` })
      .setTimestamp();

    await this.sendEmbed(interaction.guild, embed);
  }

  async logAutoMod(actionExecution) {
    const embed = new EmbedBuilder()
      .setTitle("🛡️ AutoMod Déclenché")
      .setColor(Colors.Red)
      .setDescription(`Une règle d'AutoMod a été déclenchée.`)
      .addFields(
        { name: "Règle", value: actionExecution.ruleTriggerType.toString(), inline: true },
        { name: "Action", value: actionExecution.action.type.toString(), inline: true }
      )
      .setTimestamp();

    if (actionExecution.user) {
      embed.setAuthor({ name: actionExecution.user.tag, iconURL: actionExecution.user.displayAvatarURL() });
      embed.setFooter({ text: `User ID: ${actionExecution.user.id}` });
    }

    await this.sendEmbed(actionExecution.guild, embed);
  }
}

module.exports = LoggerManager;
