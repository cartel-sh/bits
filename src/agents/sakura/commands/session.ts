import { SlashCommandBuilder } from "@discordjs/builders";
import { type ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { startSession, stopSession } from "../database/db";
import { DateTime } from "luxon";

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

export const startCommand = {
  data: new SlashCommandBuilder()
    .setName("start")
    .setDescription("Start a practice session")
    .addStringOption((option) =>
      option
        .setName("notes")
        .setDescription("Optional notes about this practice session")
        .setRequired(false),
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      const notes = interaction.options.getString("notes") || undefined;
      const session = await startSession(interaction.user.id, notes);

      await interaction.reply({
        content: `Started your practice session!`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("Error starting practice session:", error);
      await interaction.reply({
        content: error instanceof Error ? error.message : "An error occurred while starting the practice session.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export const stopCommand = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop the current practice session"),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      const session = await stopSession(interaction.user.id);
      const duration = session.duration || 0;

      await interaction.reply({
        content: `Ended practice session. Duration: ${formatDuration(duration)}`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("Error stopping practice session:", error);
      await interaction.reply({
        content: error instanceof Error ? error.message : "An error occurred while stopping the practice session.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};