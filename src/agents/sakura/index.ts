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
    reconnectStrategy: (retries) => {
      if (retries > 20) {
        console.error("Max Redis reconnection attempts reached");
        return new Error("Max Redis reconnection attempts reached");
      }
      // Exponential backoff with a maximum of 3 seconds
      const delay = Math.min(retries * 100, 3000);
      console.log(`Attempting Redis reconnection in ${delay}ms...`);
      return delay;
    },
  },
});

const client = new Client({
  intents: ["Guilds", "GuildMessages", "MessageContent", "GuildVoiceStates"],
});

// Add reconnection logic for Discord client
const connectDiscord = async (client: Client, token: string) => {
  try {
    await client.login(token);
  } catch (error) {
    console.error("Failed to connect to Discord:", error);
    console.log("Attempting to reconnect in 5 seconds...");
    setTimeout(() => connectDiscord(client, token), 5000);
  }
};

// Enhanced Redis connection handling
const connectRedis = async (redis: RedisClientType): Promise<void> => {
  try {
    if (!redis.isOpen) {
      console.log("Attempting to connect to Redis...");
      await redis.connect();
    }
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    // Connection will be retried automatically by reconnectStrategy
  }
};

redis.on("connect", () => {
  console.log("Redis client connecting...");
});

redis.on("ready", () => {
  console.log("Redis client connected and ready");
});

redis.on("error", (err) => {
  console.error("Redis client error:", err);
});

redis.on("end", () => {
  console.log("Redis client connection closed");
});

redis.on("reconnecting", () => {
  console.log("Redis client reconnecting...");
});

// Initialize Redis connection
console.log("Initializing Redis connection...");
connectRedis(redis).catch((err) => {
  console.error("Initial Redis connection failed:", err);
});

client.on("error", (error) => {
  console.error("Discord client error:", error);
  if (
    error.message.includes("ECONNRESET") ||
    error.message.includes("ECONNREFUSED")
  ) {
    console.log("Connection lost, attempting to reconnect...");
    setTimeout(() => connectDiscord(client, SAKURA_TOKEN), 5000);
  }
});

const rest = new REST({ version: "9" }).setToken(SAKURA_TOKEN);
const commands = [
  voiceStatsCommand.data.toJSON(),
  setChannelsCommand.data.toJSON(),
  checkChannelsCommand.data.toJSON(),
];

const startBot = async () => {
  try {
    console.log("Ensuring Redis connection...");
    await connectRedis(redis);

    console.log("Connecting to Discord...");
    await connectDiscord(client, SAKURA_TOKEN);

    console.log("Registering commands...");
    await rest
      .put(Routes.applicationCommands(SAKURA_CLIENT_ID), {
        body: commands,
      })
      .catch((error) => {
        console.error("Failed to register commands:", error);
      });
  } catch (error) {
    console.error("Startup error:", error);
    console.log("Attempting restart in 5 seconds...");
    setTimeout(startBot, 5000);
  }
};

startBot();

client.on(
  "voiceStateUpdate",
  async (oldState: VoiceState, newState: VoiceState) => {
    console.log("Voice state update detected!");
    console.log("Old channel:", oldState.channelId);
    console.log("New channel:", newState.channelId);
    try {
      await trackVoiceStateChange(redis, oldState, newState);
    } catch (error) {
      console.error("Error tracking voice activity:", error);
    }
  },
);

client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

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

client.once("ready", () => {
  console.log("Sakura is ready!");
});
