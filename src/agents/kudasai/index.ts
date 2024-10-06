import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { Agent } from "../../framework/agent";

dotenv.config();

const { KUDASAI_TOKEN, KUDASAI_CLIENT_ID, GEMINI_API_KEY } = process.env;

if (!KUDASAI_TOKEN || !KUDASAI_CLIENT_ID || !GEMINI_API_KEY) {
	throw new Error(
		"Environment variables KUDASAI_TOKEN, KUDASAI_CLIENT_ID and GEMINI_API_KEY are required",
	);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export const agent = new Agent({
	name: "kudasai",
	token: KUDASAI_TOKEN,
	model: "gemini-1.5-flash",
	clientId: KUDASAI_CLIENT_ID,
	intents: ["Guilds", "GuildMessages", "MessageContent"],
	messageScope: {
		readMentionsOnly: true,
		readBotsMessages: false,
	},
});

agent.on("ready", () => {
	console.log("Bot is ready!");
});

agent.on("messageCreate", async (message) => {
	console.log(message.content);
	if (message.author.bot) return;

	if (message.mentions.has(agent.name)) {
		const userMessage = message.content
			.replace(`<@!${agent.clientId}>`, "")
			.trim();

		if (!agent.model) {
			await message.reply("I'm not sure what to say...");
			return;
		}

		const model = genAI.getGenerativeModel({ model: agent.model });

		const generationConfig = {
			temperature: 0.9,
			topK: 1,
			topP: 1,
			maxOutputTokens: 2048,
		};

		const parts = [
			{
				text: `input: ${userMessage}`,
			},
		];

		const result = await model.generateContent({
			contents: [{ role: "user", parts }],
			generationConfig,
		});

		const reply = result.response.text();

		// due to Discord limitations, we can only send 2000 characters at a time, so we need to split the message
		if (reply.length > 2000) {
			const replyArray = reply.match(/[\s\S]{1,2000}/g);

			if (replyArray) {
				for (const msg of replyArray) {
					await message.reply(msg);
				}
			}
			return;
		}

		message.reply(reply);
	}
});
