import { getGuildDoc, updateSubscriberCount, videoChecker } from '#adapters';
import { commandModule, CommandType } from '@sern/handler';
import { MessageFlags } from 'discord.js';

export default commandModule({
  name: 'update_subs_modal',
  type: CommandType.Modal,
  execute: async (interaction, { deps }) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const [client, prisma] = [deps['@sern/client'], deps.prisma];
    const field = (str: string) => interaction.fields.getTextInputValue(str);
    const [id, name] = [field('youtube_channel_id'), field('youtube_channel_name')];

    if (!id || !name) {
      return await interaction.reply({
        content: 'You must provide both a YouTube Channel ID and Name.',
        flags: MessageFlags.Ephemeral
      });
    }
    const { guilds, mainYtNotifier } = prisma;
    let _guild = await getGuildDoc(guilds, interaction.guildId!);
    if (!_guild) {
      return await interaction.reply({
        content: 'Guild not found. Please setup your guild settings first.',
        flags: MessageFlags.Ephemeral
      });
    }

    let mainNotifier = await mainYtNotifier.findFirst({
      where: {
        id: interaction.guildId!
      }
    });
    if (!mainNotifier) {
      mainNotifier = await mainYtNotifier.create({
        data: {
          id: interaction.guildId!,
          ChannelId: id,
          ChannelName: name,
          LastChecked: null,
          LatestVideoId: null
        }
      });
    }
    console.log('Main Sub Id:', _guild.mainSubId);
    await updateSubscriberCount(id, _guild.mainSubId, client);

    return await interaction.editReply({
      content: `Subscriber count for **${name}** has been updated successfully!`
    });
  }
});
