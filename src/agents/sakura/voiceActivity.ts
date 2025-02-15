import type { VoiceState } from "discord.js";
import { DateTime } from "luxon";
import type { RedisClientType } from "redis";

export const trackVoiceStateChange = async (
  redis: RedisClientType,
  oldState: VoiceState,
  newState: VoiceState,
): Promise<void> => {
  if (oldState.channelId === newState.channelId) return;

  const userId = oldState.member?.user.id || newState.member?.user.id;
  if (!userId) return;

  if (newState.channelId) {
    const currentDay = DateTime.now().toFormat("yyyy-MM-dd");
    await redis.set(`activity:${userId}`, new Date().toISOString());
    await redis.sAdd(`activity:tracking:${currentDay}`, userId);
  } else {
    const activityStart = await redis.get(`activity:${userId}`);
    if (activityStart) {
      const duration = Math.floor(
        (new Date().getTime() - new Date(activityStart).getTime()) / 1000,
      );
      const currentDay = DateTime.now().toFormat("yyyy-MM-dd");
      const existingDuration = await redis.get(
        `activity:${userId}:duration:${currentDay}`,
      );
      const totalDuration = existingDuration
        ? Number.parseInt(existingDuration) + duration
        : duration;

      await redis.set(
        `activity:${userId}:duration:${currentDay}`,
        totalDuration.toString(),
      );
      await redis.del(`activity:${userId}`);
    }
  }
};

export const getDailyStats = async (
  redis: RedisClientType,
  userId: string,
): Promise<number> => {
  const currentDay = DateTime.now().toFormat("yyyy-MM-dd");
  const duration = await redis.get(`activity:${userId}:duration:${currentDay}`);
  return duration ? Number.parseInt(duration) : 0;
};

export const getWeeklyStats = async (
  redis: RedisClientType,
  userId: string,
): Promise<{ [key: string]: number }> => {
  const stats: { [key: string]: number } = {};
  const today = DateTime.now();

  for (let i = 0; i < 7; i++) {
    const day = today.minus({ days: i }).toFormat("yyyy-MM-dd");
    const duration = await redis.get(`activity:${userId}:duration:${day}`);
    stats[day] = duration ? Number.parseInt(duration) : 0;
  }

  return stats;
};

export const getMonthlyStats = async (
  redis: RedisClientType,
  userId: string,
): Promise<{ [key: string]: number }> => {
  const stats: { [key: string]: number } = {};
  const today = DateTime.now();
  const daysInMonth = today.daysInMonth;

  for (let i = 0; i < daysInMonth; i++) {
    const day = today.minus({ days: i }).toFormat("yyyy-MM-dd");
    const duration = await redis.get(`activity:${userId}:duration:${day}`);
    stats[day] = duration ? Number.parseInt(duration) : 0;
  }

  return stats;
};
