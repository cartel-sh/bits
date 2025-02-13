import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Client, type Interaction, type VoiceState } from "discord.js";
import { type RedisClientType, createClient } from "redis";
import { Agent } from "../../framework/agent";
import { setChannelsCommand } from "./commands/setChannels";
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
redis.connect().catch(console.error);

const client = new Client({
	intents: ["Guilds", "GuildMessages", "MessageContent", "GuildVoiceStates"],
});

export const agent = new Agent({
	name: "sakura",
	token: SAKURA_TOKEN,
	clientId: SAKURA_CLIENT_ID,
	intents: ["Guilds", "GuildMessages", "MessageContent", "GuildVoiceStates"],
	messageScope: {
		readMentionsOnly: true,
		readBotsMessages: false,
	},
});

const rest = new REST({ version: "9" }).setToken(SAKURA_TOKEN);
const commands = [
	voiceStatsCommand.data.toJSON(),
	setChannelsCommand.data.toJSON(),
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
		try {
			await trackVoiceStateChange(redis, oldState, newState);
			const userId = newState.member?.user.id || oldState.member?.user.id;
			const guildId = newState.guild.id;
			if (userId) {
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
			default:
				console.warn(`Unknown command: ${interaction.commandName}`);
		}
	} catch (error) {
		console.error("Error executing command:", error);
		if (!interaction.replied) {
			await interaction.reply({
				content: "An error occurred while processing your command.",
				ephemeral: true,
			});
		}
	}
});

// agent.on("messageCreate", async (message) => {
// 	if (!agent.messageInScope(message)) return;

// 	const content = message.cleanContent.toLowerCase();
// 	const [command, ...args] = content.split(" ");

// 	switch (command) {
// 		case "start":
// 			try {
// 				const sessionId = await startSession(message.author.id);
// 				await message.reply(`Started a new study session. ID: ${sessionId}`);
// 			} catch (error) {
// 				await message.reply("Failed to start session. Please try again.");
// 			}
// 			break;

// 		case "end":
// 			try {
// 				const sessionId = args[0];
// 				if (!sessionId) {
// 					await message.reply("Please provide a session ID.");
// 					return;
// 				}
// 				const result = await endSession(sessionId);
// 				const durationMinutes = Math.round(result.duration / 60000);
// 				await message.reply(
// 					`Ended study session. Duration: ${durationMinutes} minutes.`,
// 				);
// 			} catch (error) {
// 				await message.reply(
// 					"Failed to end session. Please check the session ID and try again.",
// 				);
// 			}
// 			break;

// 		case "sessions":
// 			try {
// 				const sessions = await getUserSessions(message.author.id);
// 				if (sessions.length === 0) {
// 					await message.reply("You have no recorded study sessions.");
// 				} else {
// 					const sessionList = sessions
// 						.map((s: any) => {
// 							const duration = s.endTime
// 								? `${Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000)} minutes`
// 								: "Ongoing";
// 							return `ID: ${s.id}, Duration: ${duration}`;
// 						})
// 						.join("\n");
// 					await message.reply(`Your study sessions:\n${sessionList}`);
// 				}
// 			} catch (error) {
// 				await message.reply("Failed to fetch sessions. Please try again.");
// 			}
// 			break;

// 		default:
// 			await message.reply(
// 				"Unknown command. Available commands: start, end, sessions, or use /voicestats for voice activity tracking",
// 			);
// 	}
// });


// Schedule notification resets
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
