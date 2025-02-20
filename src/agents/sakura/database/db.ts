import postgres from "postgres";
import { DateTime } from "luxon";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.NODE_ENV === "production",
});

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

export const getUserByDiscordId = async (discordId: string): Promise<string> => {
  const result = await sql<[{ id: string }]>`
    SELECT get_or_create_user_by_identity('discord', ${discordId}) as id
  `;
  return result[0].id;
};

export const linkIdentity = async (userId: string, platform: string, identity: string) => {
  await sql`
    INSERT INTO user_identities (user_id, platform, identity)
    VALUES (${userId}, ${platform}, ${identity})
  `;
};

export const startSession = async (discordId: string, notes?: string): Promise<PracticeSession> => {
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
};

export const stopSession = async (discordId: string): Promise<PracticeSession> => {
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