import { SlashCommandBuilder } from "@discordjs/builders";
import { ChannelType, type ChatInputCommandInteraction, MessageFlags } from "discord.js";
import type { RedisClientType } from "redis";

export const setChannelsCommand = {
	data: new SlashCommandBuilder()
		.setName("setchannel")
		.setDescription("Set the voice and text channels for tracking")
		.addChannelOption((option) =>
			option
				.setName("voice")
				.setDescription("The voice channel to track")
				.setRequired(true),
		)
		.addChannelOption((option) =>
			option
				.setName("text")
				.setDescription("The text channel for notifications")
				.setRequired(true),
		),

	execute: async (
		interaction: ChatInputCommandInteraction,
		redis: RedisClientType,
	) => {
		console.log("Executing setchannel command...");
		
		const subcommand = interaction.options.getSubcommand();
		console.log(`Subcommand: ${subcommand}`);
		
		const channel = interaction.options.getChannel("channel", true);
		console.log(`Selected channel: ${channel.name} (${channel.id}) of type ${channel.type}`);
		
		const guildId = interaction.guildId;
		console.log(`Guild ID: ${guildId}`);

		if (!guildId) {
			console.warn("Command used outside of a guild");
			await interaction.reply({
				content: "This command can only be used in a server.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		try {
			switch (subcommand) {
				case "text": {
					console.log("Processing text channel setting...");
					if (channel.type !== ChannelType.GuildText) {
						console.warn(`Invalid channel type for text channel: ${channel.type}`);
						await interaction.reply({
							content: "Please select a text channel.",
							flags: MessageFlags.Ephemeral,
						});
						return;
					}
					
					console.log(`Setting text channel for guild ${guildId} to ${channel.id}`);
					try {
						await redis.set(`textChannel:${guildId}`, channel.id);
						console.log("Successfully set text channel in Redis");
					} catch (redisError) {
						console.error("Redis error while setting text channel:", redisError);
						throw redisError;
					}

					console.log("Sending success reply...");
					await interaction.reply({
						content: `Set text channel to ${channel.name}`,
						flags: MessageFlags.Ephemeral,
					});
					console.log("Text channel setup complete");
					break;
				}
				case "voice": {
					console.log("Processing voice channel setting...");
					if (channel.type !== ChannelType.GuildVoice) {
						console.warn(`Invalid channel type for voice channel: ${channel.type}`);
						await interaction.reply({
							content: "Please select a voice channel.",
							flags: MessageFlags.Ephemeral,
						});
						return;
					}
					
					console.log(`Setting voice channel for guild ${guildId} to ${channel.id}`);
					try {
						await redis.set(`voiceChannel:${guildId}`, channel.id);
						console.log("Successfully set voice channel in Redis");
					} catch (redisError) {
						console.error("Redis error while setting voice channel:", redisError);
						throw redisError;
					}

					console.log("Sending success reply...");
					await interaction.reply({
						content: `Set voice channel to ${channel.name}`,
						flags: MessageFlags.Ephemeral,
					});
					console.log("Voice channel setup complete");
					break;
				}
			}
		} catch (error) {
			console.error("Error in setChannels command:", error);
			const err = error as Error;
			console.error("Error details:", {
				name: err.name,
				message: err.message,
				stack: err.stack
			});
			
			try {
				if (!interaction.replied) {
					await interaction.reply({
						content: "An error occurred while setting the channel.",
						flags: MessageFlags.Ephemeral,
					});
				} else {
					await interaction.followUp({
						content: "An error occurred while setting the channel.",
						flags: MessageFlags.Ephemeral,
					});
				}
			} catch (replyError) {
				console.error("Error while sending error reply:", replyError);
			}
		}
	},
};

// Add a new command to check current channel settings
export const checkChannelsCommand = {
	data: new SlashCommandBuilder()
		.setName("checkchannels")
		.setDescription("Check the current voice and text channel settings"),
	async execute(interaction: ChatInputCommandInteraction, redis: RedisClientType) {
		if (!interaction.guildId) {
			await interaction.reply({
				content: "This command can only be used in a server.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const voiceChannelId = await redis.get(`voiceChannel:${interaction.guildId}`);
		const textChannelId = await redis.get(`textChannel:${interaction.guildId}`);

		const voiceChannel = voiceChannelId ? await interaction.client.channels.fetch(voiceChannelId) : null;
		const textChannel = textChannelId ? await interaction.client.channels.fetch(textChannelId) : null;

		const response = [
			"Current channel settings:",
			`Voice Channel: ${voiceChannel?.type === ChannelType.GuildVoice ? voiceChannel.name : "Not set"}`,
			`Text Channel: ${textChannel?.type === ChannelType.GuildText ? textChannel.name : "Not set"}`,
			"",
			"Debug info:",
			`Voice Channel ID: ${voiceChannelId || "Not set"}`,
			`Text Channel ID: ${textChannelId || "Not set"}`
		].join("\n");

		await interaction.reply({
			content: response,
			flags: MessageFlags.Ephemeral,
		});
	},
};
