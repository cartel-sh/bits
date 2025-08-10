import { type Client, TextChannel } from "discord.js";
import {
  getVanishingChannels,
  updateVanishingChannelStats,
} from "../database/db";

const formatDurationForTopic = (seconds: number): string => {
  if (seconds >= 86400) {
    return `${Math.floor(seconds / 86400)}d`;
  }
  if (seconds >= 3600) {
    return `${Math.floor(seconds / 3600)}h`;
  }
  if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}m`;
  }
  return `${seconds}s`;
};

let isDeletionInProgress = false;

export const deleteOldMessages = async (client: Client) => {
  if (isDeletionInProgress) {
    console.log(
      "[VANISH] Previous deletion run still in progress, skipping this run",
    );
    return;
  }

  isDeletionInProgress = true;
  try {
    const channels = await getVanishingChannels();
    console.log(
      `[VANISH] Checking ${channels.length} channels for old messages`,
    );

    for (const config of channels) {
      try {
        const channel = await client.channels.fetch(config.channel_id);
        if (!(channel instanceof TextChannel)) {
          console.log(
            `[VANISH] Channel ${config.channel_id} is not a text channel, skipping`,
          );
          continue;
        }

        console.log(
          `[VANISH] Processing channel: ${channel.name} (${channel.id}), vanish after: ${config.vanish_after}s`,
        );

        let lastId: string | undefined;
        let shouldContinue = true;
        let totalProcessed = 0;
        let totalDeleted = 0;
        let totalErrors = 0;

        while (shouldContinue) {
          const options: { limit: number; before?: string } = { limit: 100 };
          if (lastId) {
            options.before = lastId;
          }

          const messages = await channel.messages.fetch(options);
          if (messages.size === 0) {
            break;
          }

          totalProcessed += messages.size;
          const now = Date.now();
          const oldMessages = messages.filter(
            (msg) =>
              !msg.pinned && // Don't delete pinned messages
              (now - msg.createdTimestamp) / 1000 > config.vanish_after,
          );

          if (oldMessages.size > 0) {
            console.log(
              `[VANISH] Found ${oldMessages.size} old messages in ${channel.name}`,
            );
            let batchDeleted = 0;

            try {
              await channel.bulkDelete(oldMessages);
              batchDeleted = oldMessages.size;
              console.log(
                `[VANISH] Bulk deleted ${oldMessages.size} messages from ${channel.name}`,
              );
            } catch (deleteError) {
              if (
                deleteError instanceof Error &&
                deleteError.message.includes("14 days")
              ) {
                console.log(
                  `[VANISH] Messages too old for bulk delete in ${channel.name}, deleting individually...`,
                );

                for (const [messageId, message] of oldMessages) {
                  try {
                    await message.delete();
                    batchDeleted++;
                    console.log(
                      `[VANISH] Successfully deleted message ${messageId}`,
                    );

                    await new Promise((resolve) => setTimeout(resolve, 200));
                  } catch (singleDeleteError: any) {
                    if (singleDeleteError.code === "10008") {
                      // Unknown Message
                      console.log(
                        `[VANISH] Message ${messageId} already deleted, counting as success`,
                      );
                      batchDeleted++;
                    } else if (singleDeleteError.code === "50013") {
                      // Missing Permissions
                      console.error(
                        `[VANISH] Missing permissions to delete messages in ${channel.name}`,
                      );
                      totalErrors++;
                      shouldContinue = false;
                      break;
                    } else if (singleDeleteError.code === "429") {
                      // Rate Limited
                      console.log(
                        "[VANISH] Rate limited, waiting longer between deletions",
                      );
                      totalErrors++;
                      await new Promise((resolve) => setTimeout(resolve, 5000));
                    } else {
                      console.error(
                        `[VANISH] Error deleting message ${messageId}:`,
                        {
                          error: singleDeleteError.message,
                          code: singleDeleteError.code,
                          channel: channel.name,
                          channelId: channel.id,
                        },
                      );
                      totalErrors++;
                    }
                  }
                }
              } else if (
                deleteError instanceof Error &&
                deleteError.message.includes("Missing Permissions")
              ) {
                console.error(
                  `[VANISH] Missing permissions to delete messages in ${channel.name}`,
                );
                shouldContinue = false;
              } else {
                console.error(
                  `[VANISH] Unexpected error during bulk delete in ${channel.name}:`,
                  deleteError,
                );
                totalErrors++;
              }
            }

            if (batchDeleted > 0) {
              totalDeleted += batchDeleted;
              try {
                console.log(
                  `[VANISH] Updating stats for ${channel.name} with ${batchDeleted} deletions`,
                );
                await updateVanishingChannelStats(channel.id, batchDeleted);
                console.log(
                  `[VANISH] Successfully updated stats for ${channel.name}`,
                );
              } catch (error) {
                console.error(
                  `[VANISH] Failed to update deletion stats for ${channel.name}:`,
                  error,
                );
                if (error instanceof Error) {
                  console.error("[VANISH] Error stack:", error.stack);
                }
              }
            }
          }

          const lastMessage = messages.last();
          if (lastMessage) {
            lastId = lastMessage.id;
            shouldContinue =
              (now - lastMessage.createdTimestamp) / 1000 > config.vanish_after;
          } else {
            shouldContinue = false;
          }
        }

        console.log(`[VANISH] Channel ${channel.name} summary:`, {
          processed: totalProcessed,
          deleted: totalDeleted,
          errors: totalErrors,
        });

        try {
          const vanishDuration = formatDurationForTopic(config.vanish_after);
          const totalMessages = config.messages_deleted;
          const newTopic = `vanish: ${vanishDuration}, vanished ${totalMessages.toLocaleString()} messages`;
          await channel.setTopic(newTopic);
          console.log(`[VANISH] Updated channel topic for ${channel.name}`);
        } catch (topicError) {
          console.error(
            `[VANISH] Failed to update channel topic for ${channel.name}:`,
            topicError,
          );
        }
      } catch (channelError: any) {
        if (channelError.code === "10003") {
          // Unknown Channel
          console.log(
            `[VANISH] Channel ${config.channel_id} no longer exists, skipping`,
          );
        } else {
          console.error(
            `[VANISH] Error processing channel ${config.channel_id}:`,
            {
              error: channelError.message,
              code: channelError.code,
            },
          );
        }
      }
    }
  } catch (error) {
    console.error("[VANISH] Error in message deletion routine:", error);
  } finally {
    isDeletionInProgress = false;
  }
};
