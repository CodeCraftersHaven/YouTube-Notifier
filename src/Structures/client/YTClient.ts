import { Cooldowns } from "#adapters";
import { Client, GatewayIntentBits, Partials, ActivityType } from "discord.js";

export class YTClient extends Client {
  constructor(private cooldowns: Cooldowns) {
    super({
      partials: [
        Partials.Channel,
        Partials.Reaction,
        Partials.Message,
        Partials.User,
      ],
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
      ],
      allowedMentions: {
        repliedUser: false,
      },
      presence: {
        activities: [
          {
            name: "YouTube",
            type: ActivityType.Watching,
            url: "https://youtube.com",
          },
        ],
        status: "dnd",
      },
    });

    process.on("unhandledRejection", (err) => {
      return console.error("Unhandled Rejection:", err);
    });
    process.on("uncaughtException", (err) => {
      return console.error("Uncaught Exception:", err);
    });
  }

}
