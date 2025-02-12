import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { RedisClientType } from "redis";
import { getDailyStats, getWeeklyStats } from "../voiceActivity";

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
		),

	execute: async (interaction: ChatInputCommandInteraction, redis: RedisClientType) => {
		const subcommand = interaction.options.getSubcommand();
		const userId = interaction.user.id;

		try {
			if (subcommand === "daily") {
				const dailyDuration = await getDailyStats(redis, userId);
				const hours = Math.floor(dailyDuration / 3600);
				const minutes = Math.floor((dailyDuration % 3600) / 60);

				await interaction.reply({
					content: `Today's voice activity: ${hours}h ${minutes}m`,
					ephemeral: true,
				});
			} else if (subcommand === "weekly") {
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
					ephemeral: true,
				});
			}
		} catch (error) {
			console.error("Error executing voice stats command:", error);
			await interaction.reply({
				content: "An error occurred while fetching your voice activity stats.",
				ephemeral: true,
			});
		}
	},
};
