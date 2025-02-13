import { SlashCommandBuilder } from "@discordjs/builders";
import { ChannelType, type ChatInputCommandInteraction } from "discord.js";
import type { RedisClientType } from "redis";

export const setChannelsCommand = {
	data: new SlashCommandBuilder()
		.setName("setchannel")
		.setDescription("Set channels for the bot")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("text")
				.setDescription("Set the text channel for bot messages")
				.addChannelOption((option) =>
					option
						.setName("channel")
						.setDescription("The text channel to use")
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("voice")
				.setDescription("Set the voice channel to monitor")
				.addChannelOption((option) =>
					option
						.setName("channel")
						.setDescription("The voice channel to monitor")
						.setRequired(true),
				),
		),

	execute: async (
		interaction: ChatInputCommandInteraction,
		redis: RedisClientType,
	) => {
		const subcommand = interaction.options.getSubcommand();
		const channel = interaction.options.getChannel("channel", true);
		const guildId = interaction.guildId;

		if (!guildId) {
			await interaction.reply({
				content: "This command can only be used in a server.",
				ephemeral: true,
			});
			return;
		}

		try {
			switch (subcommand) {
				case "text": {
					if (channel.type !== ChannelType.GuildText) {
						await interaction.reply({
							content: "Please select a text channel.",
							ephemeral: true,
						});
						return;
					}
					await redis.set(`textChannel:${guildId}`, channel.id);
					await interaction.reply({
						content: `Set text channel to ${channel.name}`,
						ephemeral: true,
					});
					break;
				}
				case "voice": {
					if (channel.type !== ChannelType.GuildVoice) {
						await interaction.reply({
							content: "Please select a voice channel.",
							ephemeral: true,
						});
						return;
					}
					await redis.set(`voiceChannel:${guildId}`, channel.id);
					await interaction.reply({
						content: `Set voice channel to ${channel.name}`,
						ephemeral: true,
					});
					break;
				}
			}
		} catch (error) {
			console.error("Error setting channel:", error);
			await interaction.reply({
				content: "An error occurred while setting the channel.",
				ephemeral: true,
			});
		}
	},
};
