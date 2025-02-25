import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import {
  Client,
  type Interaction,
  MessageFlags,
  TextChannel,
  ActivityType,
} from "discord.js";
import { startCommand, stopCommand } from "./commands/session";
import { statsCommand } from "./commands/stats";
import { vanishCommand } from "./commands/vanish";
import { cleanup } from "./database/connection";
import { getVanishingChannels, updateVanishingChannelStats, getTotalTrackedHours } from "./database/db";

// Helper function to format duration for channel topic
const formatDurationForTopic = (seconds: number): string => {
  if (seconds >= 86400) {
    return `${Math.floor(seconds / 86400)}d`;
  } else if (seconds >= 3600) {
    return `${Math.floor(seconds / 3600)}h`;
  } else if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}m`;
  }
  return `${seconds}s`;
};

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
let isDeletionInProgress = false;

const deleteOldMessages = async () => {
  // Prevent overlapping runs
  if (isDeletionInProgress) {
    console.log('[VANISH] Previous deletion run still in progress, skipping this run');
    return;
  }

  isDeletionInProgress = true;
  try {
    const channels = await getVanishingChannels();
    console.log(`[VANISH] Checking ${channels.length} channels for old messages`);

    for (const config of channels) {
      try {
        const channel = await client.channels.fetch(config.channel_id);
        if (!(channel instanceof TextChannel)) {
          console.log(`[VANISH] Channel ${config.channel_id} is not a text channel, skipping`);
          continue;
        }

        console.log(`[VANISH] Processing channel: ${channel.name} (${channel.id}), vanish after: ${config.vanish_after}s`);

        // Fetch messages in batches of 100 until we find messages that are young enough
        let lastId: string | undefined;
        let shouldContinue = true;
        let totalProcessed = 0;
        let totalDeleted = 0;
        let totalErrors = 0;

        while (shouldContinue) {
          const options: { limit: number; before?: string } = { limit: 100 };
          if (lastId) options.before = lastId;

          const messages = await channel.messages.fetch(options);
          if (messages.size === 0) break;

          totalProcessed += messages.size;
          const now = Date.now();
          const oldMessages = messages.filter(msg =>
            !msg.pinned && // Don't delete pinned messages
            (now - msg.createdTimestamp) / 1000 > config.vanish_after
          );

          if (oldMessages.size > 0) {
            console.log(`[VANISH] Found ${oldMessages.size} old messages in ${channel.name}`);
            let batchDeleted = 0;

            try {
              await channel.bulkDelete(oldMessages);
              batchDeleted = oldMessages.size;
              console.log(`[VANISH] Bulk deleted ${oldMessages.size} messages from ${channel.name}`);
            } catch (deleteError) {
              // Handle messages older than 14 days
              if (deleteError instanceof Error && deleteError.message.includes('14 days')) {
                console.log(`[VANISH] Messages too old for bulk delete in ${channel.name}, deleting individually...`);

                for (const [messageId, message] of oldMessages) {
                  try {
                    await message.delete();
                    batchDeleted++;
                    console.log(`[VANISH] Successfully deleted message ${messageId}`);

                    // Add a small delay to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 200));
                  } catch (singleDeleteError: any) {
                    // Handle specific Discord API errors
                    if (singleDeleteError.code === '10008') { // Unknown Message
                      console.log(`[VANISH] Message ${messageId} already deleted, counting as success`);
                      batchDeleted++;
                    } else if (singleDeleteError.code === '50013') { // Missing Permissions
                      console.error(`[VANISH] Missing permissions to delete messages in ${channel.name}`);
                      totalErrors++;
                      shouldContinue = false;
                      break;
                    } else if (singleDeleteError.code === '429') { // Rate Limited
                      console.log(`[VANISH] Rate limited, waiting longer between deletions`);
                      totalErrors++;
                      await new Promise(resolve => setTimeout(resolve, 5000));
                    } else {
                      console.error(`[VANISH] Error deleting message ${messageId}:`, {
                        error: singleDeleteError.message,
                        code: singleDeleteError.code,
                        channel: channel.name,
                        channelId: channel.id
                      });
                      totalErrors++;
                    }
                  }
                }
              } else if (deleteError instanceof Error && deleteError.message.includes('Missing Permissions')) {
                console.error(`[VANISH] Missing permissions to delete messages in ${channel.name}`);
                shouldContinue = false;
              } else {
                console.error(`[VANISH] Unexpected error during bulk delete in ${channel.name}:`, deleteError);
                totalErrors++;
              }
            }

            // Update stats after each successful batch
            if (batchDeleted > 0) {
              totalDeleted += batchDeleted;
              try {
                console.log(`[VANISH] Updating stats for ${channel.name} with ${batchDeleted} deletions`);
                await updateVanishingChannelStats(channel.id, batchDeleted);
                console.log(`[VANISH] Successfully updated stats for ${channel.name}`);
              } catch (error) {
                console.error(`[VANISH] Failed to update deletion stats for ${channel.name}:`, error);
                if (error instanceof Error) {
                  console.error(`[VANISH] Error stack:`, error.stack);
                }
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

        console.log(`[VANISH] Channel ${channel.name} summary:`, {
          processed: totalProcessed,
          deleted: totalDeleted,
          errors: totalErrors
        });

        try {
          const vanishDuration = formatDurationForTopic(config.vanish_after);
          const totalMessages = config.messages_deleted;
          const newTopic = `vanish: ${vanishDuration}, vanished ${totalMessages.toLocaleString()} messages`;
          await channel.setTopic(newTopic);
          console.log(`[VANISH] Updated channel topic for ${channel.name}`);
        } catch (topicError) {
          console.error(`[VANISH] Failed to update channel topic for ${channel.name}:`, topicError);
        }

      } catch (channelError: any) {
        if (channelError.code === '10003') { // Unknown Channel
          console.log(`[VANISH] Channel ${config.channel_id} no longer exists, skipping`);
        } else {
          console.error(`[VANISH] Error processing channel ${config.channel_id}:`, {
            error: channelError.message,
            code: channelError.code
          });
        }
      }
    }
  } catch (error) {
    console.error("[VANISH] Error in message deletion routine:", error);
  } finally {
    isDeletionInProgress = false;
  }
};

const startBot = async () => {
  try {
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

declare global {
  var deleteInterval: ReturnType<typeof setInterval> | undefined;
}

const updateBotStatus = async (client: Client) => {
  try {
    const totalHours = await getTotalTrackedHours();
    await client.user?.setActivity({
      name: `${totalHours} hours tracked`,
      type: ActivityType.Watching
    });
  } catch (error) {
    console.error('[STATUS] Error updating bot status:', error);
  }
};

client.once("ready", () => {
  console.log("Sakura is ready!");
  global.deleteInterval = setInterval(deleteOldMessages, 60000);

  updateBotStatus(client);
});

// Handle process termination
const handleShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Starting cleanup...`);
  try {
    // Stop the message deletion interval
    if (global.deleteInterval) {
      clearInterval(global.deleteInterval);
    }

    // Destroy the Discord client connection
    if (client) {
      console.log('Destroying Discord client connection...');
      await client.destroy();
    }

    // Cleanup database connections
    console.log('Cleaning up database connection...');
    await cleanup();

    console.log('Cleanup completed. Exiting...');
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

startBot();

