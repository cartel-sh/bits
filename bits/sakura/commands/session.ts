import { SlashCommandBuilder } from "@discordjs/builders";
import {
  ActivityType,
  type ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { CartelClient } from "@cartel-sh/api";

const cartel = new CartelClient(
  process.env.API_URL || "https://api.cartel.sh",
  process.env.API_KEY
);

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
    console.log(
      `[START] User ${interaction.user.tag} initiating practice session`,
    );

    try {
      await interaction.deferReply();
      const notes = interaction.options.getString("notes") || undefined;
      await cartel.practice.start({ discordId: interaction.user.id, notes });

      await interaction.editReply({
        content: "Started your practice session!",
      });
    } catch (error) {
      console.error(`[START] Error for user ${interaction.user.tag}:`, error);

      const errorMessage =
        error instanceof Error
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
    console.log(
      `[STOP] User ${interaction.user.tag} stopping practice session`,
    );

    try {
      await interaction.deferReply();
      const session = await cartel.practice.stop({ discordId: interaction.user.id });
      const duration = session.duration || 0;

      const discordClient = interaction.client;
      const totalHoursData = await cartel.practice.getStats('total');
      const totalHours = totalHoursData.totalHours;
      if (discordClient.user) {
        await discordClient.user.setActivity({
          name: `${totalHours.toLocaleString()}h of practice`,
          type: ActivityType.Custom,
        });
      }

      await interaction.editReply({
        content: `Ended practice session. Duration: ${formatDuration(duration)}`,
      });
    } catch (error) {
      console.error(`[STOP] Error for user ${interaction.user.tag}:`, error);

      const errorMessage =
        error instanceof Error
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
