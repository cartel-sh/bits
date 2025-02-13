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

redis.on('connect', () => {
	console.log('Redis client connecting...');
});

redis.on('ready', () => {
	console.log('Redis client connected and ready');
});

redis.on('error', (err) => {
	console.error('Redis client error:', err);
});

redis.on('end', () => {
	console.log('Redis client connection closed');
});

// Connect to Redis
console.log('Attempting to connect to Redis...');
redis.connect().catch(err => {
	console.error('Failed to connect to Redis:', err);
	process.exit(1); // Exit if we can't connect to Redis
});

const client = new Client({
	intents: ["Guilds", "GuildMessages", "MessageContent", "GuildVoiceStates"],
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

(async () => {
	try {
		console.log("Started refreshing application (/) commands.");
		await rest.put(Routes.applicationCommands(SAKURA_CLIENT_ID), {
			body: commands,
		});
		console.log("Successfully reloaded application (/) commands.");
	} catch (error) {
		console.error(error);
	}
})();

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

// Login to Discord with the client
client.login(SAKURA_TOKEN);
