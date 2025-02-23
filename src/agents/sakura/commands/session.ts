import { SlashCommandBuilder } from "@discordjs/builders";
import { type ChatInputCommandInteraction, MessageFlags, Client, ActivityType } from "discord.js";
import { startSession, stopSession, getTotalTrackedHours } from "../database/db";
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
      await interaction.deferReply();
      
      const notes = interaction.options.getString("notes") || undefined;
      console.log(`[START] Starting session for user ${interaction.user.id} with notes: ${notes || 'none'}`);
      
      const dbStart = Date.now();
      const session = await startSession(interaction.user.id, notes);
      console.log(`[START] Database operation completed in ${Date.now() - dbStart}ms`);

      await interaction.editReply({
        content: `Started your practice session!`,
      });
      console.log(`[START] Command completed successfully in ${Date.now() - cmdStart}ms`);
    } catch (error) {
      console.error(`[START] Error for user ${interaction.user.id}:`, error);
      console.error(`[START] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
      
      const errorMessage = error instanceof Error 
        ? error.message
        : "An error occurred while starting the practice session.";
        
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      }
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
      await interaction.deferReply();
      
      const dbStart = Date.now();
      const session = await stopSession(interaction.user.id);
      console.log(`[STOP] Database operation completed in ${Date.now() - dbStart}ms`);
      
      const duration = session.duration || 0;
      console.log(`[STOP] Session duration: ${duration}s (${formatDuration(duration)})`);

      const client = interaction.client;
      const totalHours = await getTotalTrackedHours();
      await client.user?.setActivity({
        name: `${totalHours.toLocaleString()}h of practice`,
        type: ActivityType.Custom,
      });

      await interaction.editReply({
        content: `Ended practice session. Duration: ${formatDuration(duration)}`,
      });
      console.log(`[STOP] Command completed successfully in ${Date.now() - cmdStart}ms`);
    } catch (error) {
      console.error(`[STOP] Error for user ${interaction.user.id}:`, error);
      console.error(`[STOP] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
      
      const errorMessage = error instanceof Error 
        ? error.message
        : "An error occurred while stopping the practice session.";
        
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};