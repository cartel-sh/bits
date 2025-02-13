import { SlashCommandBuilder } from "@discordjs/builders";
import { type ChatInputCommandInteraction, MessageFlags } from "discord.js";
import type { RedisClientType } from "redis";
import {
	checkGoalProgress,
	getDailyStats,
	getMonthlyStats,
	getWeeklyStats,
	setActivityGoal,
} from "../voiceActivity";

export const voiceStatsCommand = {
	data: new SlashCommandBuilder()
		.setName("voicestats")
		.setDescription("Get your voice channel activity statistics")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("daily")
				.setDescription("Get your daily voice activity stats"),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("weekly")
				.setDescription("Get your weekly voice activity stats"),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("monthly")
				.setDescription("Get your monthly voice activity stats"),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("setgoal")
				.setDescription("Set a voice activity goal")
				.addStringOption((option) =>
					option
						.setName("type")
						.setDescription("Goal type")
						.setRequired(true)
						.addChoices(
							{ name: "Daily", value: "daily" },
							{ name: "Weekly", value: "weekly" },
							{ name: "Monthly", value: "monthly" },
						),
				)
				.addNumberOption((option) =>
					option
						.setName("hours")
						.setDescription("Goal in hours")
						.setRequired(true)
						.setMinValue(0.5)
						.setMaxValue(24),
				)
				.addBooleanOption((option) =>
					option
						.setName("notifications")
						.setDescription("Enable notifications for goal progress")
						.setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("goals")
				.setDescription("Check your voice activity goals progress"),
		),

	execute: async (
		interaction: ChatInputCommandInteraction,
		redis: RedisClientType,
	) => {
		const subcommand = interaction.options.getSubcommand();
		const userId = interaction.user.id;

		try {
			switch (subcommand) {
				case "daily": {
					const dailyDuration = await getDailyStats(redis, userId);
					const hours = Math.floor(dailyDuration / 3600);
					const minutes = Math.floor((dailyDuration % 3600) / 60);

					await interaction.reply({
						content: `Today's voice activity: ${hours}h ${minutes}m`,

						flags: MessageFlags.Ephemeral,
					});
					break;
				}

				case "weekly": {
					const weeklyStats = await getWeeklyStats(redis, userId);
					const formattedStats = Object.entries(weeklyStats)
						.map(([date, duration]) => {
							const hours = Math.floor(duration / 3600);
							const minutes = Math.floor((duration % 3600) / 60);
							return `${date}: ${hours}h ${minutes}m`;
						})
						.join("\n");

					await interaction.reply({
						content: `Your weekly voice activity:\n${formattedStats}`,

						flags: MessageFlags.Ephemeral,
					});
					break;
				}

				case "monthly": {
					const monthlyStats = await getMonthlyStats(redis, userId);
					const formattedStats = Object.entries(monthlyStats)
						.map(([date, duration]) => {
							const hours = Math.floor(duration / 3600);
							const minutes = Math.floor((duration % 3600) / 60);
							return `${date}: ${hours}h ${minutes}m`;
						})
						.join("\n");

					const totalDuration = Object.values(monthlyStats).reduce(
						(sum, duration) => sum + duration,
						0,
					);
					const totalHours = Math.floor(totalDuration / 3600);
					const totalMinutes = Math.floor((totalDuration % 3600) / 60);

					await interaction.reply({
						content: `Your monthly voice activity:\nTotal: ${totalHours}h ${totalMinutes}m\n\nDaily breakdown:\n${formattedStats}`,

						flags: MessageFlags.Ephemeral,
					});
					break;
				}

				case "setgoal": {
					const type = interaction.options.getString("type", true) as
						| "daily"
						| "weekly"
						| "monthly";
					const hours = interaction.options.getNumber("hours", true);
					const notifications =
						interaction.options.getBoolean("notifications") ?? true;

					await setActivityGoal(redis, userId, type, hours, notifications);
					await interaction.reply({
						content: `Successfully set ${type} goal to ${hours} hours${notifications ? " with notifications enabled" : ""}`,

						flags: MessageFlags.Ephemeral,
					});
					break;
				}

				case "goals": {
					const progress = await checkGoalProgress(redis, userId);

					if (Object.keys(progress).length === 0) {
						await interaction.reply({
							content:
								"You haven't set any goals yet. Use `/voicestats setgoal` to set your first goal!",

							flags: MessageFlags.Ephemeral,
						});
						return;
					}

					const formattedProgress = Object.entries(progress)
						.map(([type, { current, goal, achieved }]) => {
							const currentHours = Math.floor(current / 3600);
							const currentMinutes = Math.floor((current % 3600) / 60);
							const goalHours = Math.floor(goal / 3600);
							const goalMinutes = Math.floor((goal % 3600) / 60);
							const percentage = Math.round((current / goal) * 100);

							return (
								`${type.charAt(0).toUpperCase() + type.slice(1)} Goal:\n` +
								`Progress: ${currentHours}h ${currentMinutes}m / ${goalHours}h ${goalMinutes}m (${percentage}%)\n` +
								`Status: ${achieved ? "✅ Achieved!" : "🎯 In Progress"}`
							);
						})
						.join("\n\n");

					await interaction.reply({
						content: `Your Voice Activity Goals:\n\n${formattedProgress}`,

						flags: MessageFlags.Ephemeral,
					});
					break;
				}
			}
		} catch (error) {
			console.error("Error executing voice stats command:", error);
			await interaction.reply({
				content: "An error occurred while processing your request.",

				flags: MessageFlags.Ephemeral,
			});
		}
	},
};
