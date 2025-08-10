import { SlashCommandBuilder } from "@discordjs/builders";
import { type ChatInputCommandInteraction, MessageFlags } from "discord.js";
import {
  getDailyStats,
  getMonthlyStats,
  getTopUsers,
  getWeeklyStats,
} from "../database/db";

const formatDuration = (seconds: number): string => {
  if (!seconds || Number.isNaN(seconds)) {
    return "0h 0m";
  }
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
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("top").setDescription("Show top practice durations"),
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
            .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
            .map(([date, duration]) => `${date}: ${formatDuration(duration)}`)
            .join("\n")}`;
          break;
        }
        case "monthly": {
          const stats = await getMonthlyStats(userId);
          const total = Object.values(stats).reduce(
            (sum, d) => sum + (d || 0),
            0,
          );
          content = `Monthly practice summary:\nTotal: ${formatDuration(total)}\n\nDaily breakdown:\n${Object.entries(
            stats,
          )
            .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
            .map(([date, duration]) => `${date}: ${formatDuration(duration)}`)
            .join("\n")}`;
          break;
        }
        case "top": {
          const topUsers = await getTopUsers();
          content = `Top Practice Durations:\n\n${topUsers
            .filter((user) => user.total_duration > 0)
            .map((user, index) => {
              return `${user.identity}: ${formatDuration(user.total_duration)}`;
            })
            .join("\n")}`;

          if (!content.includes(":")) {
            content = "No practice sessions recorded yet!";
          }
          break;
        }
      }

      await interaction.reply({
        content,
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
