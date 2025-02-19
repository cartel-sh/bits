import { SlashCommandBuilder } from "@discordjs/builders";
import { type ChatInputCommandInteraction, MessageFlags } from "discord.js";
import {
  getDailyStats,
  getMonthlyStats,
  getWeeklyStats,
} from "../database/db";

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Get your practice statistics")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("daily")
        .setDescription("Get your daily practice stats"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("weekly")
        .setDescription("Get your weekly practice stats"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("monthly")
        .setDescription("Get your monthly practice stats"),
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {
      let content = "";
      switch (subcommand) {
        case "daily": {
          const duration = await getDailyStats(userId);
          content = `Today's practice duration: ${formatDuration(duration)}`;
          break;
        }
        case "weekly": {
          const stats = await getWeeklyStats(userId);
          content = `Weekly practice summary:\n${Object.entries(stats)
            .map(([date, duration]) => `${date}: ${formatDuration(duration)}`)
            .join("\n")}`;
          break;
        }
        case "monthly": {
          const stats = await getMonthlyStats(userId);
          const total = Object.values(stats).reduce((sum, d) => sum + d, 0);
          content = `Monthly practice summary:\nTotal: ${formatDuration(total)}\n\nDaily breakdown:\n${Object.entries(stats)
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
      console.error("Error executing stats command:", error);
      await interaction.reply({
        content: "An error occurred while processing your request.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
