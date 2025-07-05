import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, resolveColor } from 'discord.js';
import axios from 'axios';
import { env } from '#sern';
import os from 'os';
import { YTClient } from '#bot';
import { Prisma } from './Prisma';
import { Guilds, YouTubeVideo, YTSearchResponse } from './ytTypes';
const { YT_API_KEY } = env;

/**
 * Retrieves a guild document by its ID.
 */
export async function getGuildDoc(db: Guilds, guildId: string) {
  return await db.findFirst({
    where: { id: guildId }
  });
}
/**
 * Retrieves guild documents from the database.
 */
export async function getGuildDocs(db: Guilds) {
  return await db.findMany();
}
/**
 * Creates or updates a guild document in the database.
 */
export async function createGuildDoc(db: Guilds, guildId: string) {
  return await db.create({
    data: {
      id: guildId
    }
  });
}
/**
 * Find or create a guild document in the database.
 */
export async function findOrCreateGuildDoc(db: Guilds, guildId: string) {
  const existingDoc = await getGuildDoc(db, guildId);
  if (existingDoc) {
    return existingDoc;
  } else {
    return await createGuildDoc(db, guildId);
  }
}
/**
 * Removes a guild document from the database.
 */
export async function removeGuildDoc(db: Guilds, guildId: string, find = true) {
  if (!find) {
    await db.delete({
      where: { id: guildId }
    });
    return true;
  }
  const doc = await db.findFirst({
    where: { id: guildId }
  });
  if (doc) {
    await db.delete({
      where: { id: doc.id }
    });
    return true;
  } else {
    return false;
  }
}

/**
 * Removes YouTube notifiers for a guild.
 */
export async function removeYtNotifiers(db: Prisma, guildId: string) {
  let mainRemoved = false;
  let optRemoved = false;

  const mainNotifier = await db.mainYtNotifier.findFirst({
    where: { id: guildId }
  });
  if (mainNotifier) {
    await db.mainYtNotifier.delete({
      where: { id: mainNotifier.id }
    });
    mainRemoved = true;
  }

  const optNotifier = await db.optChannels.findFirst({
    where: { id: guildId }
  });
  if (optNotifier) {
    await db.optChannels.delete({
      where: { id: optNotifier.id }
    });
    optRemoved = true;
  }

  return { mainRemoved, optRemoved };
}

export const buttonConfirmation = (baseId: string, args: string[]): ActionRowBuilder<ButtonBuilder>[] => [
  new ActionRowBuilder({
    components: ['✅|Yes', '❌|No'].map(choice => {
      const [emoji, label] = choice.split('|');
      const rest = args.join('/');
      return new ButtonBuilder({
        custom_id: `${baseId}/${rest}/${label.toLowerCase()}`,
        emoji,
        label,
        style: label === 'Yes' ? ButtonStyle.Success : ButtonStyle.Danger
      });
    })
  })
];

/**
 * Sleeps for a specified number of milliseconds.
 */
export const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Parses a YouTube duration string (ISO 8601 format) into seconds.
 */
export const parseDuration = function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const hours = parseInt(match?.[1] ?? '') || 0;
  const minutes = parseInt(match?.[2] ?? '') || 0;
  const seconds = parseInt(match?.[3] ?? '') || 0;
  return hours * 3600 + minutes * 60 + seconds;
};

/**
 * Formats a YouTube duration string (ISO 8601 format) into a human-readable format.
 */
export function formatDuration(duration: string) {
  const seconds = parseDuration(duration);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  let result = [];
  if (hours > 0) result.push(`${hours}h`);
  if (minutes > 0 || hours > 0) result.push(`${minutes % 60}m`);
  result.push(`${remainingSeconds}s`);
  return result.join(' ');
}

/**
 * Checks if a YouTube channel has any videos, live streams, or Shorts.
 */
export async function videoChecker(channelId: string) {
  try {
    const searchResponse = (await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        channelId,
        maxResults: 1,
        order: 'date',
        key: YT_API_KEY
      }
    })) as { data: YTSearchResponse };

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return null;
    } else {
      const latestItem = searchResponse.data.items[0];
      const videoId = latestItem.id.videoId;

      if (!videoId) {
        return null;
      } else {
        return videoId;
      }
    }
  } catch (error) {
    return null;
  }
}

/**
 * Checks if a YouTube channel has any videos, live streams, or Shorts.
 */
export async function searchVideos(channelId: string, amount = 1) {
  try {
    const searchResponse = (await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        channelId,
        maxResults: amount,
        order: 'date',
        key: YT_API_KEY
      }
    })) as { data: YTSearchResponse };

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return null;
    } else {
      return searchResponse.data.items;
    }
  } catch (error) {
    return null;
  }
}

/**
 * Checks if a YouTube channel has any videos, live streams, or Shorts.
 */
export async function searchVideo(channelId: string, videoId: string) {
  try {
    const searchResponse = (await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,contentDetails,statistics,liveStreamingDetails',
        channelId,
        id: videoId,
        maxResults: 1,
        order: 'date',
        key: YT_API_KEY
      }
    })) as { data: { items: YouTubeVideo[] } };

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return null;
    } else {
      return searchResponse.data.items;
    }
  } catch (error) {
    console.error('Error fetching video details:', error);
    return null;
  }
}
/**
 * Checks for new main videos on a YouTube channel and sends notifications to the specified Discord channels.
 */
export async function getNewMainVideo(db: Prisma, channelId: string, videoId?: string) {
  try {
    const notifier = await db.mainYtNotifier.findUnique({
      where: { ChannelId: channelId }
    });
    if (!notifier) {
      return `No notifier found for channel ID: ${channelId}`;
    }
    const video = videoId ? videoId : await videoChecker(channelId);
    if (!video) {
      return `No new videos found for channel: ${notifier.ChannelName} (ID: ${channelId})`;
    }
    if (video === notifier.LatestVideoId) {
      return `No new videos found for channel: ${notifier.ChannelName} (ID: ${channelId})`;
    }
    const videoResponse = await searchVideo(channelId, video);
    if (!videoResponse) {
      return `No video details found for video ID: ${video}`;
    }

    await db.mainYtNotifier.update({
      where: { id: notifier.id },
      data: {
        LatestVideoId: video,
        LastChecked: new Date()
      }
    });

    const videoDetails = videoResponse[0];
    const title = videoDetails.snippet.title;
    const isLive = !!videoDetails.liveStreamingDetails;
    const duration = videoDetails.contentDetails.duration;
    const isShort = parseDuration(duration) <= 60;
    const contentType = isLive ? 'Live Stream' : isShort ? 'Short' : 'Video';

    const embed = new EmbedBuilder({
      author: {
        name: notifier.ChannelName
      },
      title,
      description: videoDetails.snippet.description?.trim(),
      url: `https://www.youtube.com/watch?v=${video}`,
      color: resolveColor('#FF0000'),
      thumbnail: {
        url: videoDetails.snippet.thumbnails.high.url
      },
      timestamp: new Date(videoDetails.snippet.publishedAt),
      footer: {
        text: `New ${contentType === 'Live Stream' ? 'Live Sream Started' : contentType + ' has been uploaded'}!`
      }
    });
    if (isLive && videoDetails.liveStreamingDetails?.actualStartTime) {
      embed.setDescription(
        embed.data.description +
          `\nThe channel is currently live streaming: [${title}](https://www.youtube.com/watch?v=${video})`
      );
    }
    return embed;
  } catch (error: any) {
    console.error('Error checking for new main video:', error);
    return `Error checking for new main video on channel ID: ${channelId}`;
  }
}

/**
 * Checks for new opt videos on a YouTube channel and sends notifications to the specified Discord channels.
 */
export async function getNewOptVideo(db: Prisma, guildId: string, channelId: string, videoId?: string) {
  try {
    const notifiers = await db.optChannels.findFirst({
      where: { id: guildId },
      select: {
        channels: true
      }
    });

    if (!notifiers) {
      return `server does not have any optional YouTube notifiers set up. Please set up a notifier first.`;
    }

    const notifier = notifiers.channels.find(c => c.ChannelId === channelId);
    if (!notifier) {
      return `No notifier found for channel ID: ${channelId}`;
    }

    if (!notifier.Active) {
      return `Notifier for channel ID: ${channelId} is inactive.`;
    }

    const video = videoId ? videoId : await videoChecker(channelId);
    if (!video || typeof video === 'boolean') {
      return `No new videos found for channel ID: ${channelId}`;
    }
    if (video === notifier.LatestVideoId) {
      return `No new videos found for channel ID: ${channelId}`;
    }
    await db.optChannels.update({
      where: { id: guildId },
      data: {
        channels: {
          updateMany: {
            where: { ChannelId: channelId },
            data: {
              LatestVideoId: video,
              LastChecked: new Date()
            }
          }
        }
      }
    });

    const videoResponse = await searchVideo(channelId, video);
    if (!videoResponse) {
      return `No video details found for video ID: ${video}`;
    }
    const videoDetails = videoResponse[0];
    const title = videoDetails.snippet.title;
    const isLive = !!videoDetails.liveStreamingDetails;
    const duration = videoDetails.contentDetails.duration;
    const isShort = parseDuration(duration) <= 60;
    const contentType = isLive ? 'Live Stream' : isShort ? 'Short' : 'Video';
    if (isLive && videoDetails.liveStreamingDetails?.actualStartTime) {
      return `The channel is currently live streaming: [${title}](https://www.youtube.com/watch?v=${video})`;
    }

    return new EmbedBuilder({
      author: {
        name: notifier.ChannelName
      },
      title,
      description: videoDetails.snippet.description?.trim(),
      url: `https://www.youtube.com/watch?v=${video}`,
      color: resolveColor('#FF0000'),
      thumbnail: {
        url: videoDetails.snippet.thumbnails.high.url
      },
      timestamp: new Date(videoDetails.snippet.publishedAt),
      footer: {
        text: `New ${contentType === 'Live Stream' ? 'Live Sream Started' : contentType + ' has been uploaded'}!`
      }
    });
  } catch (error: any) {
    console.error('Error checking for new main video:', error.message || error);
    return `Error checking for new main video on channel ID: ${channelId}`;
  }
}

type Stats = {
  viewCount: string;
  subscriberCount: string;
  hiddenSubscriberCount: true;
  videoCount: string;
};

type StatsResponse = {
  kind: string;
  etag: string;
  pageInfo: { totalResults: number; resultsPerPage: number };
  items: {
    kind: string;
    etag: string;
    id: string;
    statistics: Stats;
  }[];
};
/**
 * Updates the subscriber count of a YouTube channel in a Discord channel.
 */
export async function updateSubscriberCount(ytChannelId: string, discordChannelId: string, client: YTClient) {
  try {
    const res = (await axios.get(`https://www.googleapis.com/youtube/v3/channels`, {
      params: {
        part: 'statistics',
        id: ytChannelId,
        key: YT_API_KEY
      }
    })) as { data: StatsResponse };

    const stats = res.data.items[0].statistics;
    const subs = stats.subscriberCount;

    const channel = await client.channels.fetch(discordChannelId);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      console.error(`Channel with ID ${discordChannelId} not found.`);
      return;
    }
    await channel.setName(`YouTube Subs: ${subs}`, 'Updating subscriber count');
  } catch (err: any) {
    console.error('Error fetching subscriber count:', err);
  }
}

export function displayAdvancedConsole(client: YTClient, db: Prisma) {
  if (!client) {
    console.error('Utils.client is undefined. Cannot display advanced console.');
    return;
  }
  const commandCount = client.application?.commands.cache.size ?? 0;
  const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount ?? 0), 0);
  const totalGuilds = client.guilds.cache.size;
  if (!db) {
    console.error('Utils.prisma is undefined. Cannot display advanced console.');
    return;
  }
  const { connectionStatus, databaseName } = db;

  console.log('==================================');
  console.log('Bot Status Console');
  console.log('==================================');
  console.log(`Command Count: ${commandCount}`);
  console.log(`Total Members: ${totalMembers}`);
  console.log(`Total Guilds: ${totalGuilds}`);
  console.log(`Bot Launch Time: ${new Date().toLocaleString()}`);
  console.log(`Storage Used: ${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)} MB`);
  console.log(`Total RAM: ${Math.round(os.totalmem() / 1024 / 1024)} MB`);
  console.log(`CPU: ${os.cpus()[0].model}`);
  if (connectionStatus)
    console.log(
      `Database Connection: ${connectionStatus === 'connected' ? `connected to ${databaseName}` : connectionStatus}`
    );
  console.log('==================================');
}
