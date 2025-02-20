import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import {
  Client,
  type Interaction,
  MessageFlags,
  Message,
  TextChannel,
} from "discord.js";
import { startCommand, stopCommand } from "./commands/session";
import { statsCommand } from "./commands/stats";
import { vanishCommand } from "./commands/vanish";
import { initializeDatabase, cleanup } from "./database/connection";
import { getVanishingChannels } from "./database/db";

const { SAKURA_TOKEN, SAKURA_CLIENT_ID } = process.env;
if (!SAKURA_TOKEN || !SAKURA_CLIENT_ID) {
  throw new Error(
    "Environment variables SAKURA_TOKEN and SAKURA_CLIENT_ID must be set.",
  );
}

const client = new Client({
  intents: ["Guilds", "GuildMessages", "MessageContent"],
});

const commands = [
  startCommand.data.toJSON(),
  stopCommand.data.toJSON(),
  statsCommand.data.toJSON(),
  vanishCommand.data.toJSON(),
];

// Message deletion logic
const deleteOldMessages = async () => {
  try {
    const channels = await getVanishingChannels();
    
    for (const config of channels) {
      const channel = await client.channels.fetch(config.channel_id);
      if (!(channel instanceof TextChannel)) continue;

      const messages = await channel.messages.fetch({ limit: 100 });
      const now = Date.now();
      
      const oldMessages = messages.filter(msg => 
        (now - msg.createdTimestamp) / 1000 > config.vanish_after
      );

      if (oldMessages.size > 0) {
        console.log(`Deleting ${oldMessages.size} messages from channel ${channel.name}`);
        await channel.bulkDelete(oldMessages);
      }
    }
  } catch (error) {
    console.error("Error in message deletion routine:", error);
  }
};

const startBot = async () => {
  try {
    await initializeDatabase();
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

client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

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
      case "vanish":
        await vanishCommand.execute(interaction);
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

// Start message deletion routine when bot is ready
client.once("ready", () => {
  console.log("Sakura is ready!");
  // Check for messages to delete every minute
  setInterval(deleteOldMessages, 60000);
});

// Handle process termination
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

startBot();
