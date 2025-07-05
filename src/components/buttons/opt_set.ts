import { commandModule, CommandType } from '@sern/handler';
import { MessageFlags } from 'discord.js';
import { getGuildDoc } from '#adapters';

export default commandModule({
  name: 'opt_set',
  type: CommandType.Button,
  execute: async (interaction, { deps: { prisma }, params }) => {
    const [userId, chanId, action] = params!.split('/');
    if (userId && interaction.user.id !== userId) {
      return await interaction.reply({
        content: 'This interaction is not for you.',
        flags: MessageFlags.Ephemeral
      });
    }
    const { guilds } = prisma;
    let _guild = await getGuildDoc(guilds, interaction.guildId!);
    let content = '...';

    if (action === 'yes') {
      await guilds.update({
        where: { id: _guild!.id },
        data: {
          optAnnounceId: chanId
        }
      });
      content = `I have set Optional video notifier channel as <#${chanId}> as well!`;
    } else if (action === 'no') {
      content = `Okay, I will leave your optional channel as is and I have set your main announcement channel as <#${chanId}>.`;
    }
    return await interaction.update({
      content,
      components: []
    });
  }
});
