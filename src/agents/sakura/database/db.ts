import { DateTime } from "luxon";
import { sql } from "./connection";

export interface PracticeSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  date: string;
  notes?: string;
}

export interface ChannelSettings {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
}

export interface UserIdentity {
  userId: string;
  platform: string;
  identity: string;
}

export interface VanishingChannel {
  channel_id: string;
  guild_id: string;
  vanish_after: number;  // in seconds
  messages_deleted: number;
  last_deletion: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const getUserByDiscordId = async (discordId: string): Promise<string> => {
  console.log(`[DB] Getting or creating user for Discord ID: ${discordId}`);
  
  try {
    const result = await sql<[{ id: string }]>`
      SELECT get_or_create_user_by_identity('discord', ${discordId}) as id
    `;
    return result[0].id;
  } catch (error) {
    console.error(`[DB] Error in getUserByDiscordId for ${discordId}:`, error);
    throw error;
  }
};

export const startSession = async (discordId: string, notes?: string): Promise<PracticeSession> => {
  console.log(`[DB] Starting new session for Discord ID: ${discordId}`);
  
  try {
    const userId = await getUserByDiscordId(discordId);
    const date = DateTime.now().toFormat("yyyy-MM-dd");
    
    const activeSession = await sql<PracticeSession[]>`
      SELECT * FROM practice_sessions
      WHERE user_id = ${userId}
        AND end_time IS NULL
    `;

    if (activeSession.length > 0) {
      throw new Error("You already have an active practice session");
    }

    const result = await sql<[PracticeSession]>`
      INSERT INTO practice_sessions (
        user_id,
        start_time,
        date,
        notes
      ) VALUES (
        ${userId},
        CURRENT_TIMESTAMP,
        ${date},
        ${notes || null}
      )
      RETURNING *
    `;

    return result[0];
  } catch (error) {
    console.error(`[DB] Error in startSession for ${discordId}:`, error);
    throw error;
  }
};

export const stopSession = async (discordId: string): Promise<PracticeSession> => {
  console.log(`[DB] Stopping session for Discord ID: ${discordId}`);
  
  try {
    const userId = await getUserByDiscordId(discordId);

    const result = await sql<[PracticeSession]>`
      UPDATE practice_sessions 
      SET 
        end_time = CURRENT_TIMESTAMP,
        duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))::INTEGER
      WHERE user_id = ${userId}
        AND end_time IS NULL
      RETURNING *
    `;

    if (!result[0]) {
      throw new Error("No active practice session found");
    }

    return result[0];
  } catch (error) {
    console.error(`[DB] Error in stopSession for ${discordId}:`, error);
    throw error;
  }
};

export const getDailyStats = async (discordId: string): Promise<number> => {
  const userId = await getUserByDiscordId(discordId);
  const date = DateTime.now().toFormat("yyyy-MM-dd");
  
  const result = await sql<[{ total_duration: number }]>`
    SELECT COALESCE(SUM(duration), 0) as total_duration
    FROM practice_sessions
    WHERE user_id = ${userId} AND date = ${date}
  `;
  return result[0].total_duration;
};

export const getWeeklyStats = async (discordId: string): Promise<Record<string, number>> => {
  const userId = await getUserByDiscordId(discordId);
  const endDate = DateTime.now();
  const startDate = endDate.minus({ days: 6 });
  
  const results = await sql<Array<{ date: Date; total_duration: number }>>`
    SELECT date, COALESCE(SUM(duration), 0) as total_duration
    FROM practice_sessions
    WHERE user_id = ${userId}
      AND date >= ${startDate.toFormat("yyyy-MM-dd")}
      AND date <= ${endDate.toFormat("yyyy-MM-dd")}
    GROUP BY date
  `;

  const stats: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const date = endDate.minus({ days: i }).toFormat("yyyy-MM-dd");
    const record = results.find(r => DateTime.fromJSDate(r.date).toFormat("yyyy-MM-dd") === date);
    stats[date] = record?.total_duration || 0;
  }
  
  return stats;
};

export const getMonthlyStats = async (discordId: string): Promise<Record<string, number>> => {
  const userId = await getUserByDiscordId(discordId);
  const now = DateTime.now();
  const startDate = now.startOf("month");
  const endDate = now.endOf("month");
  
  const results = await sql<Array<{ date: Date; total_duration: number }>>`
    SELECT date, COALESCE(SUM(duration), 0) as total_duration
    FROM practice_sessions
    WHERE user_id = ${userId}
      AND date >= ${startDate.toFormat("yyyy-MM-dd")}
      AND date <= ${endDate.toFormat("yyyy-MM-dd")}
    GROUP BY date
  `;

  const stats: Record<string, number> = {};
  for (let i = 0; i < now.daysInMonth; i++) {
    const date = now.minus({ days: i }).toFormat("yyyy-MM-dd");
    const record = results.find(r => DateTime.fromJSDate(r.date).toFormat("yyyy-MM-dd") === date);
    stats[date] = record?.total_duration || 0;
  }
  
  return stats;
};

export const setChannels = async (settings: ChannelSettings) => {
  await sql`
    INSERT INTO channel_settings (guild_id, voice_channel_id, text_channel_id)
    VALUES (${settings.guildId}, ${settings.voiceChannelId}, ${settings.textChannelId})
    ON CONFLICT (guild_id) 
    DO UPDATE SET 
      voice_channel_id = ${settings.voiceChannelId},
      text_channel_id = ${settings.textChannelId}
  `;
};

export const getChannels = async (guildId: string): Promise<ChannelSettings | null> => {
  const result = await sql<[ChannelSettings]>`
    SELECT 
      guild_id as "guildId", 
      voice_channel_id as "voiceChannelId", 
      text_channel_id as "textChannelId"
    FROM channel_settings
    WHERE guild_id = ${guildId}
  `;
  return result[0] || null;
};

export const getTopUsers = async (): Promise<Array<{ identity: string; total_duration: number }>> => {
  const results = await sql<Array<{ identity: string; total_duration: number }>>`
    SELECT 
      ui.identity,
      COALESCE(SUM(ps.duration), 0) as total_duration
    FROM user_identities ui
    LEFT JOIN practice_sessions ps ON ui.user_id = ps.user_id
    WHERE ui.platform = 'discord'
    GROUP BY ui.identity
    ORDER BY total_duration DESC
  `;
  
  return results;
};

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

export const getTotalTrackedHours = async (): Promise<number> => {
  const result = await sql<[{ total_seconds: number }]>`
    SELECT COALESCE(SUM(duration), 0) as total_seconds
    FROM practice_sessions
    WHERE duration IS NOT NULL
  `;
  
  return Math.floor((result[0]?.total_seconds) / 3600);
}; 