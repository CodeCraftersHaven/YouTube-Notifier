import { IntegrationContextType, publishConfig } from '#sern';
import { commandModule, CommandType } from '@sern/handler';
import { ApplicationCommandOptionType, ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { videoChecker, getNewMainVideo, getNewOptVideo, getGuildDoc } from '#adapters';

export default commandModule({
  type: CommandType.Slash,
  description: 'Check for new YouTube videos by channel id manually.',
  options: [
    {
      name: 'channel',
      description: 'The YouTube channel ID to check for new videos.',
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: true,
      command: {
        onEvent: [],
        async execute(interaction, { deps: { prisma } }) {
          const { mainYtNotifier, optChannels } = prisma;
          if (!interaction.guild) {
            return interaction.respond([
              {
                name: 'This command can only be used in a server.',
                value: 'no-guild.'
              }
            ]);
          }
          const { guildId } = interaction;
          const mainNotifier = await mainYtNotifier.findFirst({
            where: { id: guildId! }
          });
          if (!mainNotifier) {
            return interaction.respond([
              {
                name: 'No main YouTube notifier channel set up.',
                value: 'no-main-channel.'
              }
            ]);
          }
          const optNotifier = await optChannels.findFirst({
            where: { id: mainNotifier.id }
          });
          if (!optNotifier) {
            return interaction.respond([
              {
                name: mainNotifier.ChannelName,
                value: `main-` + mainNotifier.ChannelId
              }
            ]);
          } else {
            const guildOwner = await interaction.guild.fetchOwner();
            const array = [];
            array.push(
              ...(mainNotifier
                ? [
                    {
                      name: mainNotifier.ChannelName,
                      value: `main-${mainNotifier.ChannelId}`,
                      uploaderId: guildOwner.user.id
                    }
                  ]
                : [])
            );
            array.push(
              ...(optNotifier
                ? optNotifier.channels.map(channel => ({
                    name: channel.ChannelName,
                    value: `opt-${channel.ChannelId}`,
                    uploaderId: channel.DiscordUserId
                  }))
                : [])
            );

            const channels = array;

            const focusedOption = interaction.options.getFocused(true);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

            let filteredChannels = channels;

            if (!isAdmin) {
              filteredChannels = channels.filter(channel => channel.uploaderId === interaction.user.id);
            }

            filteredChannels = filteredChannels.filter(channel => {
              const channelName = channel.name.toLowerCase();
              const search = focusedOption.value.toLowerCase();
              return channelName.includes(search);
            });

            return await interaction.respond(
              channels
                .map(channel => ({
                  name: channel.name,
                  value: channel.value
                }))
                .slice(0, 25)
            );
          }
        }
      }
    }
  ],
  plugins: [
    publishConfig({
      contexts: [IntegrationContextType.GUILD],
      integrationTypes: ['Guild']
    })
  ],
  async execute({ interaction }, { deps: { prisma } }) {
    const [type, channelId] = interaction.options.getString('channel', true).split('-');
    console.log('Type:', type, 'Channel ID:', channelId);
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral
    });

    try {
      const guildDoc = await getGuildDoc(prisma.guilds, interaction.guild!.id);
      if (!guildDoc) {
        return interaction.editReply({
          content: 'No YouTube notifier channels set up for this server.'
        });
      }

      if (type === 'main') {
        const newVideo = await getNewMainVideo(prisma, channelId);
        const channel = await interaction.guild!.channels.fetch(guildDoc.mainAnnounceId);

        if (!channel || channel.type !== ChannelType.GuildText) {
          await interaction.editReply({
            content: `Main announcement channel not found for channel ID: ${channelId}.`
          });
          return;
        }

        if (newVideo instanceof EmbedBuilder) {
          await channel.send({ embeds: [newVideo] });
          await interaction.editReply({
            content: `New videos found for channel ID: ${channelId}.`
          });
        } else {
          await interaction.editReply({
            content: newVideo
          });
        }
        return;
      }

      if (type === 'opt') {
        const channel = await interaction.guild!.channels.fetch(guildDoc.optAnnounceId);
        const newVideos = await getNewOptVideo(prisma, interaction.guild!.id, channelId);

        if (!channel || channel.type !== ChannelType.GuildText) {
          await interaction.editReply({
            content: `Optional announcement channel not found for channel ID: ${channelId}.`
          });
          return;
        }

        if (newVideos instanceof EmbedBuilder) {
          await channel.send({ embeds: [newVideos] });
          await interaction.editReply({
            content: `New videos found for channel ID: ${channelId}.`
          });
        } else {
          await interaction.editReply({
            content: typeof newVideos === 'string' ? newVideos : 'No new videos found.'
          });
        }
        return;
      } else {
        await interaction.editReply({
          content: 'No new videos found or unable to check for new videos.'
        });
      }
    } catch (error) {
      console.error('Error checking for new videos:', error);
      return interaction.editReply({
        content: 'An error occurred while checking for new videos.'
      });
    }
  }
});
