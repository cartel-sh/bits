import { SlashCommandBuilder } from "@discordjs/builders";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { DateTime } from "luxon";
import { CartelClient } from "@cartel-sh/api";

const cartel = new CartelClient(
  process.env.API_URL || "https://api.cartel.sh",
  process.env.API_KEY
);

const parseDuration = (duration: string): number | null => {
  const match = duration.match(/^(\d+)(d|h|m|s)$/);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1] || "0");
  const unit = match[2];

  switch (unit) {
    case "d":
      return value * 24 * 60 * 60;
    case "h":
      return value * 60 * 60;
    case "m":
      return value * 60;
    case "s":
      return value;
    default:
      return null;
  }
};

const formatDuration = (seconds: number): string => {
  if (seconds >= 86400) {
    return `${Math.floor(seconds / 86400)}d`;
  }
  if (seconds >= 3600) {
    return `${Math.floor(seconds / 3600)}h`;
  }
  if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}m`;
  }
  return `${seconds}s`;
};

const formatTimestamp = (date: Date | null): string => {
  if (!date) {
    return "Never";
  }
  return DateTime.fromJSDate(date).toRelative() || "Unknown";
};

export const vanishCommand = {
  data: new SlashCommandBuilder()
    .setName("vanish")
    .setDescription("Configure message auto-deletion for this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set auto-deletion duration for this channel")
        .addStringOption((option) =>
          option
            .setName("duration")
            .setDescription("Duration (e.g., 6h, 1d, 30m, 60s)")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("off")
        .setDescription("Disable auto-deletion for this channel"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("Check current auto-deletion settings"),
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "set": {
          const durationStr = interaction.options.getString("duration", true);
          const seconds = parseDuration(durationStr);

          if (!seconds) {
            await interaction.reply({
              content:
                "Invalid duration format. Use something like: 6h, 1d, 30m, or 60s",
            });
            return;
          }

          await cartel.vanish.create({
            channelId: interaction.channelId,
            guildId: interaction.guildId,
            duration: seconds,
          });

          if (interaction.channel instanceof TextChannel) {
            const newTopic = `vanish: ${formatDuration(seconds)}`;
            await interaction.channel.setTopic(newTopic);
          }

          await interaction.reply({
            content: `Messages in this channel will be automatically deleted after ${durationStr}`,
          });
          break;
        }

        case "off": {
          await cartel.vanish.remove(interaction.channelId);

          if (interaction.channel instanceof TextChannel) {
            const currentTopic = interaction.channel.topic || "";
            const newTopic = currentTopic
              .replace(/vanish: .+?messages/, "")
              .trim();
            await interaction.channel.setTopic(newTopic);
          }

          await interaction.reply({
            content: "Auto-deletion has been disabled for this channel",
          });
          break;
        }

        case "status": {
          const config = await cartel.vanish.get(interaction.channelId);
          if (!config) {
            await interaction.reply({
              content: "Auto-deletion is not enabled for this channel",
            });
            return;
          }

          const duration = formatDuration(config.vanishAfter);
          const lastDeletion = formatTimestamp(config.lastDeletion ? new Date(config.lastDeletion) : null);
          const messagesDeleted = (
            config.messagesDeleted || 0
          ).toLocaleString();

          const status = [
            "**Auto-Deletion Status**",
            `• Messages older than ${duration} will be deleted`,
            `• Total messages deleted: ${messagesDeleted}`,
            `• Last deletion: ${lastDeletion}`,
            `• Active since: ${formatTimestamp(config.createdAt ? new Date(config.createdAt) : null)}`,
          ].join("\n");

          await interaction.reply({
            content: status,
          });
          break;
        }
      }
    } catch (error) {
      console.error("Error executing vanish command:", error);
      await interaction.reply({
        content: "An error occurred while processing your request.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
