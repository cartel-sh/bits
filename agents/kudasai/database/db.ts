import { and, desc, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, vanishingChannels } from "../../../core/database/client";
import type { VanishingChannel } from "../../../core/database/client";

export const setVanishingChannel = async (
  channelId: string,
  guildId: string,
  duration: number,
): Promise<void> => {
  try {
    await db
      .insert(vanishingChannels)
      .values({
        channelId,
        guildId,
        vanishAfter: duration,
        messagesDeleted: 0,
      })
      .onConflictDoUpdate({
        target: vanishingChannels.channelId,
        set: {
          guildId,
          vanishAfter: duration,
          updatedAt: new Date(),
        },
      });

    console.log(
      `[DB] Successfully set vanishing channel ${channelId} with duration ${duration}s`,
    );
  } catch (error) {
    console.error("[DB] Error setting vanishing channel:", error);
    throw error;
  }
};

export const removeVanishingChannel = async (
  channelId: string,
): Promise<void> => {
  try {
    await db
      .delete(vanishingChannels)
      .where(eq(vanishingChannels.channelId, channelId));

    console.log(`[DB] Successfully removed vanishing channel ${channelId}`);
  } catch (error) {
    console.error("[DB] Error removing vanishing channel:", error);
    throw error;
  }
};

export const getVanishingChannels = async (
  guildId?: string,
): Promise<VanishingChannel[]> => {
  try {
    let channels;

    if (guildId) {
      channels = await db.query.vanishingChannels.findMany({
        where: eq(vanishingChannels.guildId, guildId),
      });
    } else {
      channels = await db.query.vanishingChannels.findMany();
    }

    console.log(
      `[DB] Found ${channels.length} vanishing channel(s)${guildId ? ` for guild ${guildId}` : ""}`,
    );

    // Ensure all channels have the correct types as defined in VanishingChannel
    return channels.map((channel) => ({
      ...channel,
      messagesDeleted: Number(channel.messagesDeleted) || 0,
      lastDeletion: channel.lastDeletion || null,
    }));
  } catch (error) {
    console.error("[DB] Error getting vanishing channels:", error);
    throw error;
  }
};

export const getVanishingChannel = async (
  channelId: string,
): Promise<VanishingChannel | null> => {
  try {
    const channel = await db.query.vanishingChannels.findFirst({
      where: eq(vanishingChannels.channelId, channelId),
    });

    if (!channel) {
      return null;
    }

    // Ensure the channel has the correct types as defined in VanishingChannel
    return {
      ...channel,
      messagesDeleted: Number(channel.messagesDeleted) || 0,
      lastDeletion: channel.lastDeletion || null,
    };
  } catch (error) {
    console.error("[DB] Error getting vanishing channel:", error);
    throw error;
  }
};

export const updateVanishingChannelStats = async (
  channelId: string,
  deletedCount: number,
): Promise<void> => {
  try {
    // First get the current value
    const currentChannel = await getVanishingChannel(channelId);

    if (!currentChannel) {
      console.error(`[DB] No vanishing channel found with ID ${channelId}`);
      return;
    }

    // Then update with the new count
    const newCount = currentChannel.messagesDeleted + deletedCount;

    const result = await db
      .update(vanishingChannels)
      .set({
        messagesDeleted: newCount,
        lastDeletion: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(vanishingChannels.channelId, channelId))
      .returning({
        messagesDeleted: vanishingChannels.messagesDeleted,
        lastDeletion: vanishingChannels.lastDeletion,
      });

    if (result.length > 0) {
      console.log(`[DB] Successfully updated stats for channel ${channelId}:`, {
        total_deleted: Number(result[0]?.messagesDeleted) || 0,
        last_deletion: result[0]?.lastDeletion || null,
      });
    } else {
      console.error(`[DB] No vanishing channel found with ID ${channelId}`);
    }
  } catch (error) {
    console.error("[DB] Error updating vanishing channel stats:", error);
    if (error instanceof Error) {
      console.error("[DB] Error stack:", error.stack);
    }
    throw error;
  }
};
