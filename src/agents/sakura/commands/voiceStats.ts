import { SlashCommandBuilder } from "@discordjs/builders";
import { type ChatInputCommandInteraction, MessageFlags } from "discord.js";
import type { RedisClientType } from "redis";
import {
  getDailyStats,
  getMonthlyStats,
  getWeeklyStats,
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
