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
    const cmdStart = Date.now();
    console.log(`[START] User ${interaction.user.id} (${interaction.user.tag}) initiating practice session`);
    
    try {
      const notes = interaction.options.getString("notes") || undefined;
      console.log(`[START] Starting session for user ${interaction.user.id} with notes: ${notes || 'none'}`);
      
      const dbStart = Date.now();
      const session = await startSession(interaction.user.id, notes);
      console.log(`[START] Database operation completed in ${Date.now() - dbStart}ms`);

      await interaction.reply({
        content: `Started your practice session!`,
        flags: MessageFlags.Ephemeral,
      });
      console.log(`[START] Command completed successfully in ${Date.now() - cmdStart}ms`);
    } catch (error) {
      console.error(`[START] Error for user ${interaction.user.id}:`, error);
      console.error(`[START] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
      
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
    const cmdStart = Date.now();
    console.log(`[STOP] User ${interaction.user.id} (${interaction.user.tag}) stopping practice session`);
    
    try {
      const dbStart = Date.now();
      const session = await stopSession(interaction.user.id);
      console.log(`[STOP] Database operation completed in ${Date.now() - dbStart}ms`);
      
      const duration = session.duration || 0;
      console.log(`[STOP] Session duration: ${duration}s (${formatDuration(duration)})`);

      await interaction.reply({
        content: `Ended practice session. Duration: ${formatDuration(duration)}`,
        flags: MessageFlags.Ephemeral,
      });
      console.log(`[STOP] Command completed successfully in ${Date.now() - cmdStart}ms`);
    } catch (error) {
      console.error(`[STOP] Error for user ${interaction.user.id}:`, error);
      console.error(`[STOP] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
      
      await interaction.reply({
        content: error instanceof Error ? error.message : "An error occurred while stopping the practice session.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};