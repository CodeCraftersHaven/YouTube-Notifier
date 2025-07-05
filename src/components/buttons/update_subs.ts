import { commandModule, CommandType } from '@sern/handler';
import { ActionRowBuilder, MessageFlags, TextInputBuilder, TextInputStyle } from 'discord.js';

export default commandModule({
  name: 'update_subs',
  type: CommandType.Button,
  execute: async (interaction, { params }) => {
    const [userId, action] = params!.split('/');
    if (userId && interaction.user.id !== userId) {
      return await interaction.reply({
        content: 'This interaction is not for you.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (action === 'yes') {
      await interaction.showModal({
        customId: 'update_subs_modal',
        title: 'Update Subscriber Count',
        components: [
          new ActionRowBuilder<TextInputBuilder>({
            components: [
              new TextInputBuilder({
                customId: 'youtube_channel_id',
                label: 'YouTube Channel ID',
                placeholder: 'e.g. UC_x5XG1OV2P6uZZ5FSM9Ttw',
                style: TextInputStyle.Short,
                required: true,
                minLength: 5
              })
            ]
          }),
          new ActionRowBuilder<TextInputBuilder>({
            components: [
              new TextInputBuilder({
                customId: 'youtube_channel_name',
                label: 'YouTube Channel Name',
                placeholder: 'e.g. Google Developers',
                style: TextInputStyle.Short,
                required: true,
                minLength: 3
              })
            ]
          })
        ]
      });
    } else if (action === 'no') {
      return await interaction.update({
        content: 'Okay, I will not update the subscriber count.',
        components: []
      });
    }
  }
});
