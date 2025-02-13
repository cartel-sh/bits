import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Client, MessageFlags, type Interaction, type VoiceState } from "discord.js";
import { type RedisClientType, createClient } from "redis";
import { Agent } from "../../framework/agent";
import { checkChannelsCommand, setChannelsCommand } from "./commands/setChannels";
import { voiceStatsCommand } from "./commands/voiceStats";
import {
	checkAndSendNotifications,
	resetDailyNotifications,
	resetMonthlyNotifications,
	resetWeeklyNotifications,
} from "./notifications";
import { trackVoiceStateChange } from "./voiceActivity";

const { SAKURA_TOKEN, SAKURA_CLIENT_ID } = process.env;
if (!SAKURA_TOKEN || !SAKURA_CLIENT_ID) {
	throw new Error(
		"Environment variables SAKURA_TOKEN and SAKURA_CLIENT_ID must be set.",
	);
}

const redis: RedisClientType = createClient({
	url: process.env.REDIS_URL || "redis://localhost:6379",
});

const client = new Client({
	intents: ["Guilds", "GuildMessages", "MessageContent", "GuildVoiceStates"],
});

const connectDiscord = async (client: Client, token: string) => {
	try {
		await client.login(token);
	} catch (error) {
		console.error('Failed to connect to Discord:', error);
		console.log('Attempting to reconnect in 5 seconds...');
		setTimeout(() => connectDiscord(client, token), 5000);
	}
};

const connectRedis = async (redis: RedisClientType) => {
	try {
		await redis.connect();
	} catch (err) {
		console.error('Failed to connect to Redis:', err);
		console.log('Attempting to reconnect in 5 seconds...');
		setTimeout(() => connectRedis(redis), 5000);
	}
};

// Enhanced Redis event handlers
redis.on('error', (err) => {
	console.error('Redis client error:', err);
	// Only attempt reconnect if connection is lost
	if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
		console.log('Connection lost, attempting to reconnect...');
		setTimeout(() => connectRedis(redis), 5000);
	}
});

// Enhanced Discord client error handling
client.on('error', (error) => {
	console.error('Discord client error:', error);
	// Attempt to reconnect on connection errors
	if (error.message.includes('ECONNRESET') || error.message.includes('ECONNREFUSED')) {
		console.log('Connection lost, attempting to reconnect...');
		setTimeout(() => connectDiscord(client, SAKURA_TOKEN), 5000);
	}
});


// export const agent = new Agent({
// 	name: "sakura",
// 	token: SAKURA_TOKEN,
// 	clientId: SAKURA_CLIENT_ID,
// 	intents: ["Guilds", "GuildMessages", "MessageContent", "GuildVoiceStates"],
// 	messageScope: {
// 		readMentionsOnly: true,
// 		readBotsMessages: false,
// 	},
// });

const rest = new REST({ version: "9" }).setToken(SAKURA_TOKEN);
const commands = [
	voiceStatsCommand.data.toJSON(),
	setChannelsCommand.data.toJSON(),
	checkChannelsCommand.data.toJSON(),
];

const startBot = async () => {
	try {
		console.log('Connecting to Redis...');
		await connectRedis(redis);
		
		console.log('Connecting to Discord...');
		await connectDiscord(client, SAKURA_TOKEN);
		
		console.log('Registering commands...');
		await rest.put(Routes.applicationCommands(SAKURA_CLIENT_ID), {
			body: commands,
		}).catch(error => {
			console.error('Failed to register commands:', error);
		});
		
	} catch (error) {
		console.error('Startup error:', error);
		console.log('Attempting restart in 5 seconds...');
		setTimeout(startBot, 5000);
	}
};

startBot();

client.on(
	"voiceStateUpdate",
	async (oldState: VoiceState, newState: VoiceState) => {
		console.log("Voice state update detected!");
		console.log("Old channel:", oldState.channelId);
		console.log("New channel:", newState.channelId);
		try {
			await trackVoiceStateChange(redis, oldState, newState);
			const userId = newState.member?.user.id || oldState.member?.user.id;
			const guildId = newState.guild.id;
			if (userId) {
				console.log(`Checking notifications for user ${userId} in guild ${guildId}`);
				await checkAndSendNotifications(client, redis, userId, guildId);
			}
		} catch (error) {
			console.error("Error tracking voice activity:", error);
		}
	},
);

client.on("interactionCreate", async (interaction: Interaction) => {
	if (!interaction.isChatInputCommand()) return;

	try {
		switch (interaction.commandName) {
			case "voicestats":
				await voiceStatsCommand.execute(interaction, redis);
				break;
			case "setchannel":
				await setChannelsCommand.execute(interaction, redis);
				break;
			case "checkchannels":
				await checkChannelsCommand.execute(interaction, redis);
				break;
			default:
				console.warn(`Unknown command: ${interaction.commandName}`);
		}
	} catch (error) {
		console.error("Error executing command:", error);
		if (!interaction.replied) {
			await interaction.reply({
				content: "An error occurred while processing your command.",
				flags: MessageFlags.Ephemeral,
			});
		}
	}
});


const scheduleResets = () => {
	const now = new Date();

	// Schedule daily reset at midnight
	const nextMidnight = new Date(now);
	nextMidnight.setHours(24, 0, 0, 0);
	const timeUntilMidnight = nextMidnight.getTime() - now.getTime();

	setTimeout(async () => {
		await resetDailyNotifications(redis);
		// Schedule next day
		scheduleResets();
	}, timeUntilMidnight);

	// Schedule weekly reset on Sunday at midnight
	const daysUntilSunday = 7 - now.getDay();
	const nextSunday = new Date(now);
	nextSunday.setDate(now.getDate() + daysUntilSunday);
	nextSunday.setHours(0, 0, 0, 0);
	const timeUntilSunday = nextSunday.getTime() - now.getTime();

	if (timeUntilSunday > 0) {
		setTimeout(async () => {
			await resetWeeklyNotifications(redis);
		}, timeUntilSunday);
	}

	// Schedule monthly reset on the 1st of each month
	const nextMonth = new Date(now);
	nextMonth.setMonth(nextMonth.getMonth() + 1);
	nextMonth.setDate(1);
	nextMonth.setHours(0, 0, 0, 0);
	const timeUntilNextMonth = nextMonth.getTime() - now.getTime();

	setTimeout(async () => {
		await resetMonthlyNotifications(redis);
	}, timeUntilNextMonth);
};

// Start scheduling resets when the client is ready
client.once("ready", () => {
	console.log("Sakura is ready!");
	scheduleResets();
});
