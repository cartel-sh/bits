import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import {
  ActivityType,
  Client,
  type Interaction,
  MessageFlags,
} from "discord.js";
import { startCommand, stopCommand } from "./commands/session";
import { statsCommand } from "./commands/stats";
import { CartelDBClient } from "@cartel-sh/api";

const apiClient = new CartelDBClient(
  process.env.API_URL || "https://api.cartel.sh",
  process.env.API_KEY
);

const { SAKURA_TOKEN, SAKURA_CLIENT_ID } = process.env;
if (!SAKURA_TOKEN || !SAKURA_CLIENT_ID) {
  throw new Error(
    "Environment variables SAKURA_TOKEN and SAKURA_CLIENT_ID must be set.",
  );
}

const discordClient = new Client({
  intents: ["Guilds", "GuildMessages", "MessageContent"],
});

const commands = [
  startCommand.data.toJSON(),
  stopCommand.data.toJSON(),
  statsCommand.data.toJSON(),
];

const startBot = async () => {
  try {
    await discordClient.login(SAKURA_TOKEN);

    const rest = new REST({ version: "9" }).setToken(SAKURA_TOKEN);
    await rest.put(Routes.applicationCommands(SAKURA_CLIENT_ID), {
      body: commands,
    });
  } catch (error) {
    console.error("Startup error:", error);
    setTimeout(startBot, 5000);
  }
};

discordClient.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    switch (interaction.commandName) {
      case "start":
        await startCommand.execute(interaction);
        break;
      case "stop":
        await stopCommand.execute(interaction);
        break;
      case "stats":
        await statsCommand.execute(interaction);
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

const updateBotStatus = async (discordClient: Client) => {
  try {
    const totalHours = await apiClient.getTotalTrackedHours();
    await discordClient.user?.setActivity({
      name: `${totalHours} hours tracked`,
      type: ActivityType.Watching,
    });
  } catch (error) {
    console.error("[STATUS] Error updating bot status:", error);
  }
};

discordClient.once("ready", () => {
  console.log("Sakura is ready!");
  updateBotStatus(discordClient);
});

const handleShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Starting cleanup...`);
  try {
    if (discordClient) {
      console.log("Destroying Discord client connection...");
      await discordClient.destroy();
    }

    console.log("Cleanup completed. Exiting...");
    process.exit(0);
  } catch (error) {
    console.error("Error during cleanup:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

startBot();
