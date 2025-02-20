import { SlashCommandBuilder } from "@discordjs/builders";
import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { setVanishingChannel, removeVanishingChannel, getVanishingChannel } from "../database/db";

const parseDuration = (duration: string): number | null => {
  const match = duration.match(/^(\d+)(d|h|m|s)$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'd': return value * 24 * 60 * 60;
    case 'h': return value * 60 * 60;
    case 'm': return value * 60;
    case 's': return value;
    default: return null;
  }
};

export const vanishCommand = {
  data: new SlashCommandBuilder()
    .setName("vanish")
    .setDescription("Configure message auto-deletion for this channel")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
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
          await interaction.reply({
            content: `Messages in this channel will be automatically deleted after ${durationStr}`,
          });
          break;
        }

        case "off": {
          await removeVanishingChannel(interaction.channelId);
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

          let duration = config.vanish_after;
          let unit = "seconds";

          if (duration >= 86400) {
            duration = Math.floor(duration / 86400);
            unit = "days";
          } else if (duration >= 3600) {
            duration = Math.floor(duration / 3600);
            unit = "hours";
          } else if (duration >= 60) {
            duration = Math.floor(duration / 60);
            unit = "minutes";
          }

          await interaction.reply({
            content: `Messages in this channel are automatically deleted after ${duration} ${unit}`,
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