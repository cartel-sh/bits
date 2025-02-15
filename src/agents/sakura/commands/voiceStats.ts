import { SlashCommandBuilder } from "@discordjs/builders";
import { type ChatInputCommandInteraction, MessageFlags } from "discord.js";
import type { RedisClientType } from "redis";
import {
  getDailyStats,
  getMonthlyStats,
  getWeeklyStats,
} from "../voiceActivity";

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

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
      let content = "";
      switch (subcommand) {
        case "daily": {
          const duration = await getDailyStats(redis, userId);
          content = `Today's voice activity: ${formatDuration(duration)}`;
          break;
        }
        case "weekly": {
          const stats = await getWeeklyStats(redis, userId);
          content = `Weekly voice activity:\n${Object.entries(stats)
            .map(([date, duration]) => `${date}: ${formatDuration(duration)}`)
            .join("\n")}`;
          break;
        }
        case "monthly": {
          const stats = await getMonthlyStats(redis, userId);
          const total = Object.values(stats).reduce((sum, d) => sum + d, 0);
          content = `Monthly voice activity:\nTotal: ${formatDuration(total)}\n\nDaily breakdown:\n${Object.entries(stats)
            .map(([date, duration]) => `${date}: ${formatDuration(duration)}`)
            .join("\n")}`;
          break;
        }
      }

      await interaction.reply({
        content,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("Error executing voice stats command:", error);
      await interaction.reply({
        content: "An error occurred while processing your request.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
