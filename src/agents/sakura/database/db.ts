import { DateTime } from "luxon";
import { sql, checkDbConnection } from "./connection";

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
  const start = Date.now();
  
  try {
    await checkDbConnection();
    const result = await sql<[{ id: string }]>`
      SELECT get_or_create_user_by_identity('discord', ${discordId}) as id
    `;
    console.log(`[DB] User lookup completed in ${Date.now() - start}ms`);
    return result[0].id;
  } catch (error) {
    console.error(`[DB] Error in getUserByDiscordId for ${discordId}:`, error);
    if (error instanceof Error) {
      console.error(`[DB] Stack trace:`, error.stack);
    }
    throw error;
  }
};

export const startSession = async (discordId: string, notes?: string): Promise<PracticeSession> => {
  console.log(`[DB] Starting new session for Discord ID: ${discordId}`);
  const start = Date.now();
  
  try {
    await checkDbConnection();
    const userId = await getUserByDiscordId(discordId);
    console.log(`[DB] Retrieved userId: ${userId}`);
    
    const date = DateTime.now().toFormat("yyyy-MM-dd");
    console.log(`[DB] Checking for active sessions for user ${userId}`);
    
    const activeSession = await sql<PracticeSession[]>`
      SELECT * FROM practice_sessions
      WHERE user_id = ${userId}
        AND end_time IS NULL
    `;

    if (activeSession.length > 0) {
      console.log(`[DB] Found existing active session for user ${userId}`);
      throw new Error("You already have an active practice session");
    }

    console.log(`[DB] Creating new session for user ${userId}`);
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

    console.log(`[DB] Session created successfully in ${Date.now() - start}ms`);
    return result[0];
  } catch (error) {
    console.error(`[DB] Error in startSession for ${discordId}:`, error);
    if (error instanceof Error) {
      console.error(`[DB] Stack trace:`, error.stack);
    }
    throw error;
  }
};

export const stopSession = async (discordId: string): Promise<PracticeSession> => {
  console.log(`[DB] Stopping session for Discord ID: ${discordId}`);
  const start = Date.now();
  
  try {
    await checkDbConnection();
    const userId = await getUserByDiscordId(discordId);

    console.log(`[DB] Updating session for user ${userId}`);
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
      console.log(`[DB] No active session found for user ${userId}`);
      throw new Error("No active practice session found");
    }

    console.log(`[DB] Session stopped successfully in ${Date.now() - start}ms`);
    return result[0];
  } catch (error) {
    console.error(`[DB] Error in stopSession for ${discordId}:`, error);
    if (error instanceof Error) {
      console.error(`[DB] Stack trace:`, error.stack);
    }
    throw error;
  }
};

export const getDailyStats = async (discordId: string): Promise<number> => {
  await checkDbConnection();
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
  await checkDbConnection();
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
  await checkDbConnection();
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
  await checkDbConnection();
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
  await checkDbConnection();
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
  await checkDbConnection();
  
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
  await checkDbConnection();
  await sql`
    INSERT INTO vanishing_channels (channel_id, guild_id, vanish_after)
    VALUES (${channelId}, ${guildId}, ${duration})
    ON CONFLICT (channel_id) 
    DO UPDATE SET 
      vanish_after = ${duration},
      updated_at = CURRENT_TIMESTAMP
  `;
};

export const removeVanishingChannel = async (channelId: string): Promise<void> => {
  await checkDbConnection();
  await sql`
    DELETE FROM vanishing_channels
    WHERE channel_id = ${channelId}
  `;
};

export const getVanishingChannels = async (guildId?: string): Promise<VanishingChannel[]> => {
  await checkDbConnection();
  
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
  await checkDbConnection();
  const result = await sql<[VanishingChannel]>`
    SELECT * FROM vanishing_channels
    WHERE channel_id = ${channelId}
  `;
  return result[0] || null;
};

export const updateVanishingChannelStats = async (channelId: string, deletedCount: number): Promise<void> => {
  await checkDbConnection();
  await sql`
    UPDATE vanishing_channels
    SET 
      messages_deleted = messages_deleted + ${deletedCount},
      last_deletion = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE channel_id = ${channelId}
  `;
}; 