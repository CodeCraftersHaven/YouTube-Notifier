import { env } from '#sern';
import { eventModule, EventType, Services } from '@sern/handler';
import { EmbedBuilder, Events } from 'discord.js';
import { findOrCreateGuildDoc } from '#adapters';

export default eventModule({
  type: EventType.Discord,
  name: Events.GuildCreate,
  execute: async guild => {
    const [YT, prisma] = Services('@sern/client', 'prisma');
    await findOrCreateGuildDoc(prisma.guilds, guild.id);

    const guildOwner = await guild.members.fetch(guild.ownerId);

    const logEmbed = new EmbedBuilder({
      title: 'Joined new guild',
      description: `I have been invited a new guild!`,
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
          name: `Guild Owner`,
          value: `Username: ${guildOwner.user.username}\nGlobal Name: ${guildOwner.displayName}\nNickname: ${guildOwner.nickname}\nID: ${guildOwner.id}`
        }
      ]
    });

    const botLogsChannel = await YT.channels.fetch(env.BOT_LOGS_CHANNEL_ID);
    const channels = {
      botLogs: botLogsChannel
    };

    if (channels.botLogs?.isSendable()) {
      await channels.botLogs.send({
        embeds: [logEmbed]
      });
    }
  }
});
