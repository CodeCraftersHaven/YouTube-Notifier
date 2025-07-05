import { IntegrationContextType, publishConfig } from '#sern';
import { commandModule, CommandType } from '@sern/handler';
import {
  ActionRow,
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} from 'discord.js';
import { buttonConfirmation, getGuildDoc, updateSubscriberCount } from '#adapters';

export default commandModule({
  type: CommandType.Slash,
  description: 'Setup the bot with the required configurations.',
  options: [
    {
      name: 'main-announce',
      description: 'Set or create main yt discord channel.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'main-channel',
          description: 'Choose a channel to send new video announcements to. (Leave blank to create new)',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText]
        }
      ]
    },
    {
      name: 'main-sub-channel',
      description: 'Set or create optional yt discord channel.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'main-sub-vc',
          description: 'Select a locked voice channel to show your sub count. (Leave blank to create new)',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildVoice]
        }
      ]
    },
    {
      name: 'opt-announce',
      description: 'Set a channel to send optional video announcements to.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'opt-channel',
          description: 'Choose a channel to send new video announcements to. (Leave blank to create new)',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText]
        }
      ]
    }
  ],
  plugins: [
    publishConfig({
      contexts: [IntegrationContextType.GUILD],
      integrationTypes: ['Guild'],
      defaultMemberPermissions: PermissionFlagsBits.Administrator
    })
  ],
  async execute({ interaction }, { deps }) {
    const subCommand = interaction.options.getSubcommand();
    const { guilds } = deps.prisma;
    const { guild, options, user } = interaction;
    if (!guild) return;
    let _guild = await getGuildDoc(guilds, guild.id);
    if (!_guild) return;

    if (subCommand === 'main-announce') {
      const mainChannel = options.getChannel('main-channel');

      if (mainChannel) {
        if (_guild.mainAnnounceId) {
          if (_guild.mainAnnounceId === mainChannel.id) {
            return await interaction.reply({
              content: `This channel is already set as your main announcement channel.`,
              flags: 64
            });
          } else {
            return await interaction.reply({
              content: `You already set your main announcement channel. Would you like to change it to ${mainChannel}?`,
              flags: 64,
              components: buttonConfirmation(`ma_change`, [user.id, mainChannel.id])
            });
          }
        } else {
          await guilds.update({
            where: { id: _guild.id },
            data: {
              mainAnnounceId: mainChannel.id
            }
          });
          return await interaction.reply({
            content: `I have set your main announcement channel to ${mainChannel}.`,
            flags: 64
          });
        }
      } else {
        const channelName = 'new-video';
        let chan = await guild.channels.create({
          name: channelName,
          position: 0,
          permissionOverwrites: [
            {
              id: guild.id,
              allow: PermissionFlagsBits.ViewChannel,
              deny: PermissionFlagsBits.SendMessages
            }
          ]
        });
        await guilds.update({
          where: { id: _guild.id },
          data: {
            mainAnnounceId: chan.id
          }
        });

        await interaction.reply({
          content: `I have set <#${chan.id}> as your main announcement channel.\nWould you like to use this channel for optional channel announcements as well?`,
          components: buttonConfirmation(`opt_set`, [user.id, chan.id])
        });
      }
    } else if (subCommand === 'main-sub-channel') {
      const mainSubCountChan = options.getChannel('main-sub-vc');
      if (mainSubCountChan) {
        if (_guild.mainSubId) {
          if (_guild.mainSubId === mainSubCountChan.id) {
            return await interaction.reply({
              content: `This channel is already set as your main sub count channel.`,
              flags: 64
            });
          } else {
            return await interaction.reply({
              content: `You already set your main sub count channel. Would you like to change it to ${mainSubCountChan}?`,
              flags: 64,
              components: buttonConfirmation(`msc_change`, [user.id, mainSubCountChan.id])
            });
          }
        } else {
          await guilds.update({
            where: { id: _guild.id },
            data: {
              mainSubId: mainSubCountChan.id
            }
          });
          return await interaction.reply({
            content: `I have set your main sub count channel to ${mainSubCountChan}.`,
            flags: 64
          });
        }
      } else {
        const channelName = 'YouTube Subs: 0';
        let chan = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildVoice,
          position: 0,
          permissionOverwrites: [
            {
              id: guild.id,
              allow: PermissionFlagsBits.ViewChannel,
              deny: PermissionFlagsBits.Connect
            }
          ]
        });
        await guilds.update({
          where: { id: _guild.id },
          data: {
            mainSubId: chan.id
          }
        });

        await interaction.reply({
          content: `I have set <#${chan.id}> as your main sub count channel.`,
          components: [
            new ActionRowBuilder<ButtonBuilder>({
              components: [
                new ButtonBuilder()
                  .setCustomId(`update_subs/${user.id}/yes`)
                  .setLabel('Update Sub Count')
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji('🔄'),
                new ButtonBuilder()
                  .setCustomId(`update_subs/${user.id}/no`)
                  .setLabel('No, thanks')
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('❌')
              ]
            })
          ]
        });
      }
    } else if (subCommand === 'opt-announce') {
      const optChannel = options.getChannel('opt-channel');

      if (optChannel) {
        if (_guild.optAnnounceId) {
          if (_guild.optAnnounceId === optChannel.id) {
            return await interaction.reply({
              content: `This channel is already set as your optional announcement channel.`,
              flags: 64
            });
          } else {
            return await interaction.reply({
              content: `You already set your optional announcement channel. Would you like to change it to ${optChannel}?`,
              flags: 64,
              components: buttonConfirmation(`opt_change`, [user.id, optChannel.id])
            });
          }
        } else {
          await guilds.update({
            where: { id: _guild.id },
            data: {
              optAnnounceId: optChannel.id
            }
          });
          return await interaction.reply({
            content: `I have set your optional announcement channel to ${optChannel}.`,
            flags: 64
          });
        }
      } else {
        const channelName = 'optional-video';
        let chan = await guild.channels.create({
          name: channelName,
          position: 0,
          permissionOverwrites: [
            {
              id: guild.id,
              allow: PermissionFlagsBits.ViewChannel,
              deny: PermissionFlagsBits.SendMessages
            }
          ]
        });
        await guilds.update({
          where: { id: _guild.id },
          data: {
            optAnnounceId: chan.id
          }
        });
        await interaction.reply({
          content: `I have set <#${chan.id}> as your optional announcement channel.`,
          flags: 64
        });
      }
    }
  }
});
