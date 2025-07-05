import { eventModule, EventType, Service } from '@sern/handler';
import { Events, GuildMember, PermissionFlagsBits } from 'discord.js';

export default eventModule({
  type: EventType.Discord,
  name: Events.MessageReactionAdd,
  execute: async (reaction, user) => {
    const client = Service('@sern/client');
    if (!reaction.message.inGuild()) return;
    let message = reaction.message;
    if (message.partial) await message.fetch();
    if (reaction.partial) await reaction.fetch();
    if (user.bot) return;

    let acceptableDenialEmojis = ['❌', '🗑️'];

    const member = reaction.message.guild.members.cache.get(user.id) as GuildMember;

    if (acceptableDenialEmojis.includes(reaction.emoji.name!) && message.author.id === client.user!.id) {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) return;
      await message.delete();
    }
  }
});
