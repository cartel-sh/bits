import {
	ChannelType,
	type Client,
	type TextChannel,
	type VoiceChannel,
} from "discord.js";
import type { RedisClientType } from "redis";

export const getGuildTextChannel = async (
	client: Client,
	redis: RedisClientType,
	guildId: string,
): Promise<TextChannel | null> => {
	const channelId = await redis.get(`textChannel:${guildId}`);
	if (!channelId) return null;

	const channel = await client.channels.fetch(channelId);
	if (!channel || channel.type !== ChannelType.GuildText) return null;

	return channel;
};

export const getGuildVoiceChannel = async (
	client: Client,
	redis: RedisClientType,
	guildId: string,
): Promise<VoiceChannel | null> => {
	const channelId = await redis.get(`voiceChannel:${guildId}`);
	if (!channelId) return null;

	const channel = await client.channels.fetch(channelId);
	if (!channel || channel.type !== ChannelType.GuildVoice) return null;

	return channel;
};

export const sendGuildMessage = async (
	client: Client,
	redis: RedisClientType,
	guildId: string,
	message: string,
): Promise<void> => {
	const channel = await getGuildTextChannel(client, redis, guildId);
	if (!channel) {
		console.warn(`No text channel set for guild ${guildId}`);
		return;
	}

	try {
		await channel.send(message);
	} catch (error) {
		console.error(`Failed to send message to guild ${guildId}:`, error);
	}
};
