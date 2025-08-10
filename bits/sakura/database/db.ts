import { and, desc, eq, gte, isNull, lte, sql as sqlExpr } from "drizzle-orm";
import { DateTime } from "luxon";
import {
  channelSettings,
  db,
  practiceSessions,
  userIdentities,
  users,
} from "../../../core/database/client";
import type {
  ChannelSetting,
  PracticeSession,
} from "../../../core/database/client";

export const getUserByDiscordId = async (
  discordId: string,
): Promise<string> => {
  console.log(`[DB] Getting or creating user for Discord ID: ${discordId}`);

  try {
    const identity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.platform, "discord"),
        eq(userIdentities.identity, discordId),
      ),
    });

    if (identity) {
      return identity.userId;
    }

    const newUser = await db.insert(users).values({}).returning();
    const userId = newUser[0].id;

    await db.insert(userIdentities).values({
      userId,
      platform: "discord",
      identity: discordId,
    });

    return userId;
  } catch (error) {
    console.error(`[DB] Error in getUserByDiscordId for ${discordId}:`, error);
    throw error;
  }
};

export const startSession = async (
  discordId: string,
  notes?: string,
): Promise<PracticeSession> => {
  console.log(`[DB] Starting new session for Discord ID: ${discordId}`);

  try {
    const userId = await getUserByDiscordId(discordId);
    const date = DateTime.now().toFormat("yyyy-MM-dd");

    const activeSession = await db.query.practiceSessions.findFirst({
      where: and(
        eq(practiceSessions.userId, userId),
        isNull(practiceSessions.endTime),
      ),
    });

    if (activeSession) {
      throw new Error("You already have an active practice session");
    }

    const result = await db
      .insert(practiceSessions)
      .values({
        userId,
        startTime: new Date(),
        date,
        notes: notes || null,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error(`[DB] Error in startSession for ${discordId}:`, error);
    throw error;
  }
};

export const stopSession = async (
  discordId: string,
): Promise<PracticeSession> => {
  console.log(`[DB] Stopping session for Discord ID: ${discordId}`);

  try {
    const userId = await getUserByDiscordId(discordId);

    const activeSession = await db.query.practiceSessions.findFirst({
      where: and(
        eq(practiceSessions.userId, userId),
        isNull(practiceSessions.endTime),
      ),
    });

    if (!activeSession) {
      throw new Error("No active practice session found");
    }

    const endTime = new Date();
    const duration = Math.floor(
      (endTime.getTime() - activeSession.startTime.getTime()) / 1000,
    );

    const result = await db
      .update(practiceSessions)
      .set({
        endTime,
        duration,
      })
      .where(eq(practiceSessions.id, activeSession.id))
      .returning();

    return result[0];
  } catch (error) {
    console.error(`[DB] Error in stopSession for ${discordId}:`, error);
    throw error;
  }
};

export const getDailyStats = async (discordId: string): Promise<number> => {
  const userId = await getUserByDiscordId(discordId);
  const today = DateTime.now().toFormat("yyyy-MM-dd");

  const result = await db
    .select({
      totalDuration: sqlExpr`COALESCE(SUM(${practiceSessions.duration}), 0)`.as(
        "total_duration",
      ),
    })
    .from(practiceSessions)
    .where(
      and(
        eq(practiceSessions.userId, userId),
        eq(practiceSessions.date, today),
      ),
    );

  return Number(result[0]?.totalDuration) || 0;
};

export const getWeeklyStats = async (
  discordId: string,
): Promise<Record<string, number>> => {
  const userId = await getUserByDiscordId(discordId);
  const now = DateTime.now();
  const startDate = now.minus({ days: 6 }).startOf("day");
  const endDate = now.endOf("day");

  const results = await db
    .select({
      date: practiceSessions.date,
      totalDuration: sqlExpr`COALESCE(SUM(${practiceSessions.duration}), 0)`.as(
        "total_duration",
      ),
    })
    .from(practiceSessions)
    .where(
      and(
        eq(practiceSessions.userId, userId),
        gte(practiceSessions.date, startDate.toFormat("yyyy-MM-dd")),
        lte(practiceSessions.date, endDate.toFormat("yyyy-MM-dd")),
      ),
    )
    .groupBy(practiceSessions.date);

  const stats: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const date = endDate.minus({ days: i }).toFormat("yyyy-MM-dd");
    const record = results.find(
      (r) =>
        DateTime.fromJSDate(new Date(r.date)).toFormat("yyyy-MM-dd") === date,
    );
    stats[date] = Number(record?.totalDuration) || 0;
  }

  return stats;
};

export const getMonthlyStats = async (
  discordId: string,
): Promise<Record<string, number>> => {
  const userId = await getUserByDiscordId(discordId);
  const now = DateTime.now();
  const startDate = now.startOf("month");
  const endDate = now.endOf("month");

  const results = await db
    .select({
      date: practiceSessions.date,
      totalDuration: sqlExpr`COALESCE(SUM(${practiceSessions.duration}), 0)`.as(
        "total_duration",
      ),
    })
    .from(practiceSessions)
    .where(
      and(
        eq(practiceSessions.userId, userId),
        gte(practiceSessions.date, startDate.toFormat("yyyy-MM-dd")),
        lte(practiceSessions.date, endDate.toFormat("yyyy-MM-dd")),
      ),
    )
    .groupBy(practiceSessions.date);

  const stats: Record<string, number> = {};
  for (let i = 0; i < now.daysInMonth; i++) {
    const date = now.minus({ days: i }).toFormat("yyyy-MM-dd");
    const record = results.find(
      (r) =>
        DateTime.fromJSDate(new Date(r.date)).toFormat("yyyy-MM-dd") === date,
    );
    stats[date] = Number(record?.totalDuration) || 0;
  }

  return stats;
};

export const setChannels = async (settings: {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
}): Promise<ChannelSetting[]> => {
  try {
    return await db
      .insert(channelSettings)
      .values({
        guildId: settings.guildId,
        voiceChannelId: settings.voiceChannelId,
        textChannelId: settings.textChannelId,
      })
      .onConflictDoUpdate({
        target: channelSettings.guildId,
        set: {
          voiceChannelId: settings.voiceChannelId,
          textChannelId: settings.textChannelId,
          updatedAt: new Date(),
        },
      })
      .returning();
  } catch (error) {
    console.error("[DB] Error in setChannels:", error);
    throw error;
  }
};

export const getChannels = async (
  guildId: string,
): Promise<ChannelSetting | null> => {
  try {
    const result = await db.query.channelSettings.findFirst({
      where: eq(channelSettings.guildId, guildId),
    });

    return result || null;
  } catch (error) {
    console.error("[DB] Error in getChannels:", error);
    throw error;
  }
};

export const getTopUsers = async (): Promise<
  Array<{ identity: string; totalDuration: number }>
> => {
  try {
    const result = await db
      .select({
        identity: userIdentities.identity,
        totalDuration:
          sqlExpr`COALESCE(SUM(${practiceSessions.duration}), 0)`.as(
            "total_duration",
          ),
      })
      .from(practiceSessions)
      .innerJoin(
        userIdentities,
        eq(practiceSessions.userId, userIdentities.userId),
      )
      .where(eq(userIdentities.platform, "discord"))
      .groupBy(userIdentities.identity)
      .orderBy(desc(sqlExpr`SUM(${practiceSessions.duration})`))
      .limit(10);

    return result.map((item) => ({
      identity: item.identity,
      totalDuration: Number(item.totalDuration) || 0,
    }));
  } catch (error) {
    console.error("[DB] Error in getTopUsers:", error);
    throw error;
  }
};

export const getTotalTrackedHours = async (): Promise<number> => {
  try {
    const result = await db
      .select({
        totalDuration:
          sqlExpr`COALESCE(SUM(${practiceSessions.duration}), 0)`.as(
            "total_duration",
          ),
      })
      .from(practiceSessions);

    return Number(result[0]?.totalDuration) || 0;
  } catch (error) {
    console.error("[DB] Error in getTotalTrackedHours:", error);
    throw error;
  }
};
