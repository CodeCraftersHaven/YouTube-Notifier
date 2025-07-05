import { IntegrationContextType, publishConfig } from '#sern';
import { commandModule, CommandType } from '@sern/handler';
import { ApplicationCommandOptionType, EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { getNewMainVideo } from '#adapters';

export default commandModule({
  type: CommandType.Slash,
  description: 'Manages your main YouTube video notifier channel settings.',
  options: [
    {
      name: 'add',
      description: 'Adds a YouTube channel to get notified of new videos.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'add-channel-id',
          description: 'The YouTube channel ID to add.',
          type: ApplicationCommandOptionType.String,
          required: true
        },
        {
          name: 'add-channel-name',
          description: 'The YouTube channel name to add.',
          type: ApplicationCommandOptionType.String,
          required: true
        },
        {
          name: 'add-video-id',
          description: 'If you know your last video id, insert it here. (Not required)',
          type: ApplicationCommandOptionType.String
        }
      ]
    },
    {
      name: 'remove',
      description: 'Removes a YouTube channel from the notifier.',
      type: ApplicationCommandOptionType.Subcommand
    }
  ],
  plugins: [
    publishConfig({
      contexts: [IntegrationContextType.GUILD],
      integrationTypes: ['Guild'],
      defaultMemberPermissions: PermissionFlagsBits.Administrator
    })
  ],
  async execute({ interaction }, { deps: { prisma } }) {
    const { options, guildId: GuildId } = interaction;
    if (!GuildId) return;
    const { mainYtNotifier, guilds } = prisma;

    if (!interaction.guild) {
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guild = await guilds.findFirst({ where: { id: GuildId } });
    if (!guild) {
      return interaction.reply({
        content: 'This server is not registered in my database. Please setup your guild settings first with `/setup`.',
        flags: MessageFlags.Ephemeral
      });
    }
    const notifier = await mainYtNotifier.findFirst({ where: { id: GuildId } });
    const subcommand = options.getSubcommand();

    if (subcommand === 'add') {
      const channelName = options.getString('add-channel-name', true);
      const channelId = options.getString('add-channel-id', true);
      const videoId = options.getString('add-video-id', false);

      const data = {
        ChannelName: channelName,
        ChannelId: channelId,
        LatestVideoId: videoId ?? null,
        LastChecked: null
      };

      if (notifier) {
        await mainYtNotifier.update({
          where: { id: notifier.id },
          data: data
        });
      } else {
        await mainYtNotifier.create({
          data: {
            id: GuildId,
            ...data
          }
        });
      }
      let con = '';
      if (videoId) {
        const res = await getNewMainVideo(prisma, channelId, videoId);
        if (typeof res === 'string' || typeof res === 'boolean') {
          con = res;
        }
        if (res instanceof EmbedBuilder) {
          const channel = interaction.guild.channels.cache.get(guild.mainAnnounceId);
          if (!channel || !channel.isTextBased()) {
            con =
              '\nYour video was found but your Main announcement channel was not found. Please set it up with `/setup`.';
          } else {
            await channel.send({ embeds: [res] });
            con = '\nYour video was found and sent to your main announcement channel.';
          }
        }
      }
      return interaction.reply({
        content: `I have added the YouTube channel **${channelName}** with ID **${channelId}** to be the main notifier!${con}`,
        flags: MessageFlags.Ephemeral
      });
    } else if (subcommand === 'remove') {
      if (!notifier) {
        return interaction.reply({
          content: 'No Main YouTube video notifier channel is set for this server.',
          flags: MessageFlags.Ephemeral
        });
      }
      await mainYtNotifier.delete({ where: { id: GuildId } });

      return interaction.reply({
        content: 'Main YouTube video notifier channel removed successfully!',
        flags: MessageFlags.Ephemeral
      });
    }
  }
});
