import type { Client } from "discord.js";
import type { RedisClientType } from "redis";
import { sendGuildMessage } from "./channelManager";
import { checkGoalProgress, getActivityGoal } from "./voiceActivity";

export const checkAndSendNotifications = async (
	client: Client,
	redis: RedisClientType,
	userId: string,
	guildId?: string,
): Promise<void> => {
	const goals = await getActivityGoal(redis, userId);
	if (!goals || !goals.notifications) return;

	const progress = await checkGoalProgress(redis, userId);
	const user = await client.users.fetch(userId);
	if (!user) return;

	for (const [type, { current, goal, achieved }] of Object.entries(progress)) {
		// Only send notification if we've just achieved the goal
		const achievementKey = `activity:${userId}:${type}:achievement_notified`;
		const alreadyNotified = await redis.get(achievementKey);

		if (achieved && !alreadyNotified) {
			const hours = Math.floor(goal / 3600);
			const minutes = Math.floor((goal % 3600) / 60);
			const message = `🎉 ${user.username} has achieved their ${type} voice activity goal of ${hours}h ${minutes}m!`;

			try {
				// Send DM to user
				await user.send(
					`🎉 Congratulations! You've achieved your ${type} voice activity goal of ${hours}h ${minutes}m!`,
				);

				// If we have a guild ID, also send to the guild's text channel
				if (guildId) {
					await sendGuildMessage(client, redis, guildId, message);
				}

				await redis.set(achievementKey, "true");
			} catch (error) {
				console.error(
					`Failed to send achievement notification for user ${userId}:`,
					error,
				);
			}
		} else if (!achieved && alreadyNotified) {
			await redis.del(achievementKey);
		}

		// Send progress notifications at certain thresholds
		const percentage = Math.round((current / goal) * 100);
		const thresholds = [25, 50, 75];

		for (const threshold of thresholds) {
			const thresholdKey = `activity:${userId}:${type}:threshold_${threshold}_notified`;
			const thresholdNotified = await redis.get(thresholdKey);

			if (percentage >= threshold && !thresholdNotified) {
				const message = `📊 ${user.username} has completed ${percentage}% of their ${type} voice activity goal!`;

				try {
					// Send DM to user
					await user.send(
						`📊 Progress Update: You've completed ${percentage}% of your ${type} voice activity goal!`,
					);

					// If we have a guild ID, also send to the guild's text channel
					if (guildId) {
						await sendGuildMessage(client, redis, guildId, message);
					}

					await redis.set(thresholdKey, "true");
				} catch (error) {
					console.error(
						`Failed to send progress notification for user ${userId}:`,
						error,
					);
				}
			} else if (percentage < threshold && thresholdNotified) {
				await redis.del(thresholdKey);
			}
		}
	}
};

// Function to reset daily notification flags
export const resetDailyNotifications = async (
	redis: RedisClientType,
): Promise<void> => {
	const keys = await redis.keys("activity:*:daily:*_notified");
	if (keys.length > 0) {
		await redis.del(keys);
	}
};

// Function to reset weekly notification flags
export const resetWeeklyNotifications = async (
	redis: RedisClientType,
): Promise<void> => {
	const keys = await redis.keys("activity:*:weekly:*_notified");
	if (keys.length > 0) {
		await redis.del(keys);
	}
};

// Function to reset monthly notification flags
export const resetMonthlyNotifications = async (
	redis: RedisClientType,
): Promise<void> => {
	const keys = await redis.keys("activity:*:monthly:*_notified");
	if (keys.length > 0) {
		await redis.del(keys);
	}
};
