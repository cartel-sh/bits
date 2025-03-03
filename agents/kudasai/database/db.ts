import { sql } from "./connection";

export interface VanishingChannel {
  channel_id: string;
  guild_id: string;
  vanish_after: number;  // in seconds
  messages_deleted: number;
  last_deletion: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const setVanishingChannel = async (channelId: string, guildId: string, duration: number): Promise<void> => {
  await sql`
    INSERT INTO vanishing_channels (channel_id, guild_id, vanish_after, messages_deleted)
    VALUES (${channelId}, ${guildId}, ${duration}, 0)
    ON CONFLICT (channel_id) 
    DO UPDATE SET 
      vanish_after = ${duration},
      updated_at = CURRENT_TIMESTAMP
  `;
};

export const removeVanishingChannel = async (channelId: string): Promise<void> => {
  await sql`
    DELETE FROM vanishing_channels
    WHERE channel_id = ${channelId}
  `;
};

export const getVanishingChannels = async (guildId?: string): Promise<VanishingChannel[]> => {
  if (guildId) {
    return sql<VanishingChannel[]>`
      SELECT * FROM vanishing_channels
      WHERE guild_id = ${guildId}
    `;
  }
  
  return sql<VanishingChannel[]>`
    SELECT * FROM vanishing_channels
  `;
};

export const getVanishingChannel = async (channelId: string): Promise<VanishingChannel | null> => {
  const result = await sql<[VanishingChannel]>`
    SELECT * FROM vanishing_channels
    WHERE channel_id = ${channelId}
  `;
  return result[0] || null;
};

export const updateVanishingChannelStats = async (channelId: string, deletedCount: number): Promise<void> => {
  console.log(`[DB] Updating vanishing channel stats for channel ${channelId} with ${deletedCount} deletions`);
  
  try {
    const result = await sql`
      UPDATE vanishing_channels
      SET 
        messages_deleted = messages_deleted + ${deletedCount},
        last_deletion = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE channel_id = ${channelId}
      RETURNING messages_deleted, last_deletion
    `;
    
    if (result.length > 0) {
      console.log(`[DB] Successfully updated stats for channel ${channelId}:`, {
        total_deleted: result[0]?.messages_deleted || 0,
        last_deletion: result[0]?.last_deletion || null
      });
    } else {
      console.error(`[DB] No vanishing channel found with ID ${channelId}`);
    }
  } catch (error) {
    console.error(`[DB] Error updating vanishing channel stats:`, error);
    if (error instanceof Error) {
      console.error(`[DB] Error stack:`, error.stack);
    }
    throw error;
  }
}; 