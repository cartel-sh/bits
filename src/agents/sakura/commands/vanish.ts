import { SlashCommandBuilder } from "@discordjs/builders";
import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, TextChannel } from "discord.js";
import { setVanishingChannel, removeVanishingChannel, getVanishingChannel } from "../database/db";
import { DateTime } from "luxon";

const parseDuration = (duration: string): number | null => {
  const match = duration.match(/^(\d+)(d|h|m|s)$/);
  if (!match) return null;

  const value = parseInt(match[1] || '0');
  const unit = match[2];

  switch (unit) {
    case 'd': return value * 24 * 60 * 60;
    case 'h': return value * 60 * 60;
    case 'm': return value * 60;
    case 's': return value;
    default: return null;
  }
};

const formatDuration = (seconds: number): string => {
  if (seconds >= 86400) {
    return `${Math.floor(seconds / 86400)}d`;
  } else if (seconds >= 3600) {
    return `${Math.floor(seconds / 3600)}h`;
  } else if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}m`;
  }
  return `${seconds}s`;
};

const formatTimestamp = (date: Date | null): string => {
  if (!date) return 'Never';
  return DateTime.fromJSDate(date).toRelative() || 'Unknown';
};

export const vanishCommand = {
  data: new SlashCommandBuilder()
    .setName("vanish")
    .setDescription("Configure message auto-deletion for this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName("set")
        .setDescription("Set auto-deletion duration for this channel")
        .addStringOption(option =>
          option
            .setName("duration")
            .setDescription("Duration (e.g., 6h, 1d, 30m, 60s)")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("off")
        .setDescription("Disable auto-deletion for this channel")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("status")
        .setDescription("Check current auto-deletion settings")
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
              content: "Invalid duration format. Use something like: 6h, 1d, 30m, or 60s",
            });
            return;
          }

          await setVanishingChannel(interaction.channelId, interaction.guildId, seconds);
          
          // Update channel topic
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
          await removeVanishingChannel(interaction.channelId);
          
          // Clear vanish info from channel topic
          if (interaction.channel instanceof TextChannel) {
            const currentTopic = interaction.channel.topic || '';
            const newTopic = currentTopic.replace(/vanish: .+?messages/, '').trim();
            await interaction.channel.setTopic(newTopic);
          }
          
          await interaction.reply({
            content: "Auto-deletion has been disabled for this channel",
          });
          break;
        }

        case "status": {
          const config = await getVanishingChannel(interaction.channelId);
          if (!config) {
            await interaction.reply({
              content: "Auto-deletion is not enabled for this channel",
            });
            return;
          }

          const duration = formatDuration(config.vanish_after);
          const lastDeletion = formatTimestamp(config.last_deletion);
          const messagesDeleted = (config.messages_deleted || 0).toLocaleString();

          const status = [
            `**Auto-Deletion Status**`,
            `• Messages older than ${duration} will be deleted`,
            `• Total messages deleted: ${messagesDeleted}`,
            `• Last deletion: ${lastDeletion}`,
            `• Active since: ${formatTimestamp(config.created_at)}`,
          ].join('\n');

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