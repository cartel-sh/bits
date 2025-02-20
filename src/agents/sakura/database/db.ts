import postgres from "postgres";
import { DateTime } from "luxon";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

console.log("Attempting to connect to database...");

let dbConnected = false;
let connectionError: Error | null = null;

const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.NODE_ENV === "production",
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connection: {
    application_name: 'sakura_bot'
  },
  onnotice: (notice) => {
    console.log('[DB NOTICE]', notice);
  },
  transform: {
    undefined: null,
  },
  debug: (connection_id, query) => {
    console.log(`[DB DEBUG] Connection ${connection_id} executing:`, query.split('\n')[0]);
  }
});

const initializeConnection = async () => {
  try {
    await sql`SELECT 1`;
    console.log('[DB] Initial connection successful');
    dbConnected = true;
    connectionError = null;
  } catch (err) {
    console.error('[DB] Initial connection failed:', err);
    dbConnected = false;
    connectionError = err instanceof Error ? err : new Error(String(err));
    setTimeout(initializeConnection, 5000);
  }
};

const monitorConnection = async () => {
  try {
    await sql`SELECT 1`;
    if (!dbConnected) {
      console.log('[DB] Connection re-established');
      dbConnected = true;
      connectionError = null;
    }
  } catch (err) {
    if (dbConnected) {
      console.error('[DB] Connection lost:', err);
      dbConnected = false;
      connectionError = err instanceof Error ? err : new Error(String(err));
    }
  }
};

initializeConnection().catch(err => {
  console.error("Failed to establish initial database connection:", err);
  console.error("Error details:", {
    code: err.code,
    message: err.message,
    stack: err.stack
  });
});

setInterval(monitorConnection, 30000);

const checkDbConnection = () => {
  if (!dbConnected) {
    const error = new Error(
      connectionError 
        ? `Database connection failed: ${connectionError.message}` 
        : "Database connection is not established"
    );
    console.error("[DB] Connection check failed:", error);
    throw error;
  }
};

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
  console.log(`[DB] Getting or creating user for Discord ID: ${discordId}`);
  const start = Date.now();
  
  try {
    checkDbConnection();
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
    checkDbConnection();
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