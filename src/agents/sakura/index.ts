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
      try {
        const channel = await client.channels.fetch(config.channel_id);
        if (!(channel instanceof TextChannel)) {
          console.log(`Channel ${config.channel_id} is not a text channel, skipping`);
          continue;
        }

        // Fetch messages in batches of 100 until we find messages that are young enough
        let lastId: string | undefined;
        let shouldContinue = true;

        while (shouldContinue) {
          const options: { limit: number; before?: string } = { limit: 100 };
          if (lastId) options.before = lastId;

          const messages = await channel.messages.fetch(options);
          if (messages.size === 0) break;

          const now = Date.now();
          const oldMessages = messages.filter(msg => 
            !msg.pinned && // Don't delete pinned messages
            (now - msg.createdTimestamp) / 1000 > config.vanish_after
          );

          if (oldMessages.size > 0) {
            console.log(`Deleting ${oldMessages.size} messages from channel ${channel.name} (${channel.id})`);
            try {
              await channel.bulkDelete(oldMessages);
            } catch (deleteError) {
              // If bulk delete fails (messages > 14 days old), delete one by one
              if (deleteError instanceof Error && deleteError.message.includes('14 days')) {
                console.log('Messages too old for bulk delete, deleting individually...');
                for (const [_, message] of oldMessages) {
                  try {
                    await message.delete();
                  } catch (singleDeleteError) {
                    console.error(`Failed to delete message ${message.id}:`, singleDeleteError);
                  }
                }
              } else {
                throw deleteError;
              }
            }
          }

          // Stop if the last message in this batch is young enough
          const lastMessage = messages.last();
          if (lastMessage) {
            lastId = lastMessage.id;
            shouldContinue = (now - lastMessage.createdTimestamp) / 1000 > config.vanish_after;
          } else {
            shouldContinue = false;
          }
        }
      } catch (channelError) {
        console.error(`Error processing channel ${config.channel_id}:`, channelError);
        // Continue with next channel
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
