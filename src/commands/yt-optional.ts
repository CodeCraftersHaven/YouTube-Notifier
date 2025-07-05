import { IntegrationContextType, publishConfig } from "#sern";
import { commandModule, CommandType } from "@sern/handler";
import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { videoChecker, getNewOptVideo } from "#adapters";

export default commandModule({
  type: CommandType.Slash,
  description: "Setup the bot with the required configurations.",
  options: [
    {
      name: "add",
      description: "Adds a yt channel to get notified of new videos.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "add-channel-id",
          description: "The channel id.",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "add-channel-name",
          description: "The channel name.",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "add-video-id",
          description:
            "If you know your last video id, insert it here. (Not required)",
          type: ApplicationCommandOptionType.String,
          required: false,
        },
      ],
    },
    {
      name: "remove",
      description: "Removes a yt channel to stop notifs of new videos.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "remove-channel",
          description: "The channel to remove.",
          type: ApplicationCommandOptionType.String,
          autocomplete: true,
          command: {
            onEvent: [],
            async execute(interaction, { deps: { prisma } }) {
              const { guildId: GuildId, user } = interaction;
              const { optChannels } = prisma;
              if (!interaction.guild) {
                return interaction.respond([
                  {
                    name: "This command can only be used in a server.",
                    value: "no-guild.",
                  },
                ]);
              }
              if (!GuildId) return;
              const notifier = await optChannels.findFirst({
                where: { id: GuildId },
                select: {
                  channels: true,
                },
              });
              if (!notifier || notifier.channels.length === 0) {
                return interaction.respond([]);
              }
              const focusedOption = interaction.options.getFocused(true);
              const filteredChannels = notifier.channels.filter((channel) => {
                const channelName = channel.ChannelName.toLowerCase();
                const search = focusedOption.value.toLowerCase();
                if (
                  interaction.memberPermissions?.has(
                    PermissionFlagsBits.Administrator
                  )
                ) {
                  return channelName.includes(search);
                } else {
                  return (
                    channelName.includes(search) &&
                    channel.DiscordUserId === user.id
                  );
                }
              });
              const choices = filteredChannels
                .map((channel) => ({
                  name:
                    channel.ChannelName +
                    ` (${channel.Active ? "Active" : "Inactive"})`,
                  value: channel.ChannelId,
                }))
                .slice(0, 25);
              await interaction.respond(choices);
            },
          },
        },
      ],
    },
    {
      name: "active",
      description: "Enable (True)/disable (False) notifs of new videos.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "channel-id",
          description: "The channel id to enable or disable.",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "state",
          description: "Enable or disable channel notification.",
          type: ApplicationCommandOptionType.Boolean,
          required: true,
        },
      ],
    },
  ],
  plugins: [
    publishConfig({
      contexts: [IntegrationContextType.GUILD],
      integrationTypes: ["Guild"],
    }),
  ],
  async execute(interaction, { deps: { prisma } }) {
    const { options, guildId: GuildId, guild } = interaction;
    const { guilds, optChannels } = prisma;

    if (!interaction.guild) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!GuildId) return;
    const guildData = await guilds.findFirst({ where: { id: GuildId } });
    const notifier = await optChannels.findFirst({
      where: { id: GuildId },
      select: {
        channels: true,
      },
    });
    const subcommand = options.getSubcommand();

    if (subcommand === "add") {
      const channelName = options.getString("add-channel-name", true);
      const channelId = options.getString("add-channel-id", true);
      const videoId = options.getString("add-video-id", false);

      const res = await videoChecker(channelId);
      let con = "";
      if (typeof res === "string") {
        if (res === videoId) {
          con = `No new videos found for channel ID: ${channelId}`;
        } else {
          con = `New video found for channel ID: ${channelId}`;
        }
      }

      const data = {
        ChannelName: channelName,
        ChannelId: channelId,
        Active: true,
        DiscordUserId: interaction.user.id,
        LatestVideoId: videoId ?? "",
        LastChecked: new Date(),
      };

      if (!notifier) {
        await optChannels.create({
          data: {
            id: GuildId,
            channels: [],
          },
        });
      } else {
        const existing = notifier.channels.find(
          (channel) => channel.ChannelId === channelId
        );
        if (!existing) {
          await optChannels.update({
            where: { id: GuildId },
            data: {
              channels: {
                push: {
                  ...data,
                  LastChecked: new Date(),
                },
              },
            },
          });
          con += `\nYouTube video notifier channel added successfully!`;
        } else {
          con += `\nThis channel is already set up. Updating the latest video ID.`;
          await optChannels.update({
            where: { id: GuildId },
            data: {
              channels: {
                set: notifier.channels.map((channel) =>
                  channel.ChannelId === channelId
                    ? {
                        ...channel,
                        LatestVideoId: videoId!,
                        LastChecked: new Date(),
                      }
                    : channel
                ),
              },
            },
          });
        }
      }
      if (videoId) {
        const videoEmbed = await getNewOptVideo(
          prisma,
          GuildId,
          channelId,
          videoId
        );
        if (typeof videoEmbed === "string" || typeof videoEmbed === "boolean") {
          con += `\n${videoEmbed}`;
        } else if (videoEmbed instanceof EmbedBuilder) {
          const channel = guild?.channels.cache.get(guildData?.optAnnounceId!);
          if (!channel) {
            con += `\nYour video was found but your opt announcement channel was not found. Please set it up with \`/setup\`.`;
          } else {
            await (channel as TextChannel).send({ embeds: [videoEmbed] });
            con += `\nYour video was found and sent to your opt announcement channel.`;
          }
        }
      }
      return interaction.reply({
        content: con,
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === "remove") {
      if (!notifier || !notifier.channels.length) {
        return interaction.reply({
          content: "No YouTube video notifier channel is set for this server.",
          flags: MessageFlags.Ephemeral,
        });
      }
      const removeChannel = options.getString("remove-channel", true);

      const newChannels = notifier.channels.filter(
        (channel) => channel.ChannelId !== removeChannel
      );
      await optChannels.update({
        where: { id: GuildId },
        data: {
          channels: newChannels,
        },
      });
      return interaction.reply({
        content: "YouTube video notifier channel removed successfully!",
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === "active") {
      const channelId = options.getString("channel-id", true);
      const state = options.getBoolean("state", true);
      if (!notifier || !notifier.channels.length) {
        return interaction.reply({
          content: "No YouTube video notifier channel is set for this server.",
          flags: MessageFlags.Ephemeral,
        });
      }
      const channel = notifier.channels.find((c) => c.ChannelId === channelId);
      if (!channel) {
        return interaction.reply({
          content: `No YouTube video notifier channel found with ID: ${channelId}`,
          flags: MessageFlags.Ephemeral,
        });
      }
      if (channel.Active === state) {
        return interaction.reply({
          content: `The channel is already set to ${
            state ? "active" : "inactive"
          }.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      await optChannels.update({
        where: { id: GuildId },
        data: {
          channels: {
            set: notifier.channels.map((c) =>
              c.ChannelId === channelId ? { ...c, Active: state } : c
            ),
          },
        },
      });
      return interaction.reply({
        content: `Optional YouTube video notifier channel ${
          channel.ChannelName
        } is now set to ${state ? "active" : "inactive"}.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
});
