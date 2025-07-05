import {
  createGuildDoc,
  getGuildDoc,
  getGuildDocs,
  removeGuildDoc,
  updateSubscriberCount,
  displayAdvancedConsole,
  getNewMainVideo,
  getNewOptVideo
} from '#adapters';
import { eventModule, EventType, Services } from '@sern/handler';
import { EmbedBuilder, Events } from 'discord.js';

export default eventModule({
  type: EventType.Discord,
  name: Events.ClientReady,
  once: true,
  execute: async () => {
    const [YT, prisma] = Services('@sern/client', 'prisma');

    displayAdvancedConsole(YT, prisma);

    const guildDocsList = await getGuildDocs(prisma.guilds);
    const guildIds = new Set(YT.guilds.cache.map(guild => guild.id));

    for (const doc of guildDocsList) {
      if (!guildIds.has(doc.id)) {
        await removeGuildDoc(prisma.guilds, doc.id, false);
      }
    }

    for (const guild of YT.guilds.cache.values()) {
      let _guild = await getGuildDoc(prisma.guilds, guild.id);
      let mainNotifier = await prisma.mainYtNotifier.findFirst({
        where: { id: guild.id }
      });
      let optNotifier = await prisma.optChannels.findFirst({
        where: {
          id: guild.id
        }
      });
      if (!_guild) {
        await createGuildDoc(prisma.guilds, guild.id);
        continue;
      }

      const channel = guild.channels.cache.get(_guild.mainSubId);
      if (!channel) {
        continue;
      }
      if (!mainNotifier) {
        continue;
      }
      await updateSubscriberCount(mainNotifier.ChannelId, channel.id, YT);
      setInterval(async () => {
        await updateSubscriberCount(mainNotifier.ChannelId, channel.id, YT);
      }, 1000 * 60 * 60); // Update every hour

      const notifs = async () => {
        try {
          const mainAnnouce = await guild.channels.fetch(_guild.mainAnnounceId);
          const optAnnouce = await guild.channels.fetch(_guild.optAnnounceId);

          if (mainAnnouce && mainAnnouce.isTextBased()) {
            const newMainVideo = await getNewMainVideo(prisma, mainNotifier.ChannelId);
            if (newMainVideo instanceof EmbedBuilder) {
              await mainAnnouce.send({ embeds: [newMainVideo] });
            }
          }
          if (!optNotifier) return;
          if (optAnnouce && optAnnouce.isTextBased() && Array.isArray(optNotifier.channels)) {
            for (const c of optNotifier.channels) {
              const newOptVideo = await getNewOptVideo(prisma, guild.id, c.ChannelId);
              if (newOptVideo instanceof EmbedBuilder) {
                await optAnnouce.send({ embeds: [newOptVideo] });
              }
            }
          }
        } catch (err) {
          console.error('Error in notifs function:', err);
        }
      };

      await notifs();
      setInterval(async () => {
        await notifs();
      }, 1000 * 60 * 60 * 2); // Check every 2 hours
    }
  }
});
