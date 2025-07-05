import { env } from '#sern';
import { eventModule, EventType, Services } from '@sern/handler';
import { EmbedBuilder, Events } from 'discord.js';
import { removeGuildDoc, removeYtNotifiers } from '#adapters';

export default eventModule({
  type: EventType.Discord,
  name: Events.GuildDelete,
  execute: async guild => {
    const [YT, prisma] = Services('@sern/client', 'prisma');
    const [docRemoved, { mainRemoved, optRemoved }, botLogsChannel] = await Promise.all([
      removeGuildDoc(prisma.guilds, guild.id),
      removeYtNotifiers(prisma, guild.id),
      YT.channels.fetch(env.BOT_LOGS_CHANNEL_ID)
    ]);

    const logEmbed = new EmbedBuilder({
      title: 'No longer in guild',
      description: `I have been removed from a guild!`,
      fields: [
        {
          name: `Guild Name`,
          value: guild.name
        },
        {
          name: `Guild ID`,
          value: guild.id
        },
        {
          name: 'Guild Doc Removed',
          value: docRemoved ? 'Yes' : 'No'
        },
        { name: 'Main Notifier Removed', value: mainRemoved ? 'Yes' : 'No' },
        {
          name: 'Optional Notifier Removed',
          value: optRemoved ? 'Yes' : 'No'
        }
      ]
    });

    if (botLogsChannel?.isSendable()) {
      await botLogsChannel.send({
        embeds: [logEmbed]
      });
    }
  }
});
