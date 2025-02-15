import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import {
  Client,
  type Interaction,
  MessageFlags,
  type VoiceState,
} from "discord.js";
import { type RedisClientType, createClient } from "redis";
import {
  checkChannelsCommand,
  setChannelsCommand,
} from "./commands/setChannels";
import { voiceStatsCommand } from "./commands/voiceStats";
import { trackVoiceStateChange } from "./voiceActivity";

const { SAKURA_TOKEN, SAKURA_CLIENT_ID } = process.env;
if (!SAKURA_TOKEN || !SAKURA_CLIENT_ID) {
  throw new Error(
    "Environment variables SAKURA_TOKEN and SAKURA_CLIENT_ID must be set.",
  );
}

const redis: RedisClientType = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
});

redis.on("error", (err) => console.error("Redis client error:", err));

const client = new Client({
  intents: ["Guilds", "GuildMessages", "MessageContent", "GuildVoiceStates"],
});

const commands = [
  voiceStatsCommand.data.toJSON(),
  setChannelsCommand.data.toJSON(),
  checkChannelsCommand.data.toJSON(),
];

const startBot = async () => {
  try {
    await redis.connect();
    await client.login(SAKURA_TOKEN);

    const rest = new REST({ version: "9" }).setToken(SAKURA_TOKEN);
    await rest.put(Routes.applicationCommands(SAKURA_CLIENT_ID), {
      body: commands,
    });
  } catch (error) {
    console.error("Startup error:", error);
    setTimeout(startBot, 5000);
  }
};

client.on(
  "voiceStateUpdate",
  async (oldState: VoiceState, newState: VoiceState) => {
    try {
      await trackVoiceStateChange(redis, oldState, newState);
    } catch (error) {
      console.error("Error tracking voice activity:", error);
    }
  },
);

client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case "voicestats":
        await voiceStatsCommand.execute(interaction, redis);
        break;
      case "setchannel":
        await setChannelsCommand.execute(interaction, redis);
        break;
      case "checkchannels":
        await checkChannelsCommand.execute(interaction, redis);
        break;
      default:
        console.warn(`Unknown command: ${interaction.commandName}`);
    }
  } catch (error) {
    console.error("Error executing command:", error);
    if (!interaction.replied) {
      await interaction.reply({
        content: "An error occurred while processing your command.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

client.once("ready", () => console.log("Sakura is ready!"));

startBot();
