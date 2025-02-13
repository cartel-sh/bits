import type { VoiceState } from "discord.js";
import { DateTime } from "luxon";
import type { RedisClientType } from "redis";

export interface VoiceActivity {
	userId: string;
	startTime: string;
	duration?: number;
}

export interface VoiceActivityGoal {
	userId: string;
	dailyGoal?: number; // in seconds
	weeklyGoal?: number; // in seconds
	monthlyGoal?: number; // in seconds
	notifications: boolean;
}

export const trackVoiceStateChange = async (
	redis: RedisClientType,
	oldState: VoiceState,
	newState: VoiceState,
): Promise<void> => {
	if (oldState.channelId !== newState.channelId) {
		if (newState.channelId) {
			await storeActivityStart(redis, newState.member?.user.id);
		} else {
			await storeActivityEnd(redis, oldState.member?.user.id);
		}
	}
};

export const storeActivityStart = async (
	redis: RedisClientType,
	userId: string | undefined,
): Promise<void> => {
	if (!userId) return;

	const activityStart = await redis.get(`activity:${userId}`);
	if (activityStart) return;

	await redis.set(`activity:${userId}`, new Date().toISOString());
	await addUserToTrackingSet(redis, userId);
};

export const storeActivityEnd = async (
	redis: RedisClientType,
	userId: string | undefined,
): Promise<number | null> => {
	if (!userId) return null;

	const activityStart = await redis.get(`activity:${userId}`);
	if (!activityStart) return null;

	const duration = calculateDuration(new Date(activityStart), new Date());
	const currentDay = DateTime.now().toFormat("yyyy-MM-dd");

	await updateDurationForDay(redis, userId, currentDay, duration);
	await redis.del(`activity:${userId}`);

	return duration;
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

export const setActivityGoal = async (
	redis: RedisClientType,
	userId: string,
	goalType: "daily" | "weekly" | "monthly",
	hours: number,
	notifications = true,
): Promise<void> => {
	const seconds = hours * 3600;
	const goal: VoiceActivityGoal = {
		userId,
		notifications,
		[`${goalType} Goal`]: seconds,
	};

	await redis.set(`activity:${userId}:goals`, JSON.stringify(goal));
};

export const getActivityGoal = async (
	redis: RedisClientType,
	userId: string,
): Promise<VoiceActivityGoal | null> => {
	const goalData = await redis.get(`activity:${userId}:goals`);
	return goalData ? JSON.parse(goalData) : null;
};

export const checkGoalProgress = async (
	redis: RedisClientType,
	userId: string,
): Promise<{
	[key: string]: { current: number; goal: number; achieved: boolean };
}> => {
	const goals = await getActivityGoal(redis, userId);
	if (!goals) return {};

	const progress: {
		[key: string]: { current: number; goal: number; achieved: boolean };
	} = {};

	if (goals.dailyGoal) {
		const dailyStats = await getDailyStats(redis, userId);
		progress.daily = {
			current: dailyStats,
			goal: goals.dailyGoal,
			achieved: dailyStats >= goals.dailyGoal,
		};
	}

	if (goals.weeklyGoal) {
		const weeklyStats = await getWeeklyStats(redis, userId);
		const totalWeekly = Object.values(weeklyStats).reduce(
			(sum, duration) => sum + duration,
			0,
		);
		progress.weekly = {
			current: totalWeekly,
			goal: goals.weeklyGoal,
			achieved: totalWeekly >= goals.weeklyGoal,
		};
	}

	if (goals.monthlyGoal) {
		const monthlyStats = await getMonthlyStats(redis, userId);
		const totalMonthly = Object.values(monthlyStats).reduce(
			(sum, duration) => sum + duration,
			0,
		);
		progress.monthly = {
			current: totalMonthly,
			goal: goals.monthlyGoal,
			achieved: totalMonthly >= goals.monthlyGoal,
		};
	}

	return progress;
};

// Helper functions
const calculateDuration = (startTime: Date, endTime: Date): number => {
	return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
};

const updateDurationForDay = async (
	redis: RedisClientType,
	userId: string,
	day: string,
	newDuration: number,
): Promise<void> => {
	const existingDuration = await redis.get(
		`activity:${userId}:duration:${day}`,
	);
	const totalDuration = existingDuration
		? Number.parseInt(existingDuration) + newDuration
		: newDuration;

	await redis.set(
		`activity:${userId}:duration:${day}`,
		totalDuration.toString(),
	);
};

const addUserToTrackingSet = async (
	redis: RedisClientType,
	userId: string,
): Promise<void> => {
	const currentDay = DateTime.now().toFormat("yyyy-MM-dd");
	await redis.sAdd(`activity:tracking:${currentDay}`, userId);
};
