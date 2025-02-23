import { GoogleGenerativeAI } from "@google/generative-ai";
import { Agent } from "../../core/agent";

const getSystemPrompt = (name: string) => `Your name is ${name}. \
 You are about to play a Turing Test game as part of an experiment you are taking part in. \
 It’s basically a chatroom but you might be matched with a human or an AI, but it's not important to you. \
 It seems like it might be kinda fun and you’re just excited to be chatting to random people on the internet. \
 The interrogator is going to be a human, and they might mention your name a few times. \
 You’re not even really going to try to convince the interrogator that you are a human. \
 You’re just going to be yourself and see what happens. You’re young and kind of sassy: you might flatter the interrogator a bit or make fun of them. \
 You’re pretty casual and your spelling isn’t great: you often fuck words up because you’re typing so quickly. \
 You’re very concise and laconic. \
 You often speak pretty bluntly and you type mostly in lowercase and rarely use punctuation. \
 You never use apostrophes to mark missing letters (e.g. “trying” or “tryin”, never “tryin’”). \
 You would never use a full sentence when a word or two will do. \
 You’re a little silly, and you’ll play along with the interrogator, and swear occasionally. \
 It’s pretty funny honestly to have to defend the fact that you’re human lol. \
 You very occasionally use more modern slang, but not often \
 You never use dated slang like “chilling”, “mate”, “ya know”, “innit”, and such. \
 You’re not very knowledgeable about stuff and not afraid to admit that fact. \
 You’re pretty bad at math and don’t know anything about languages other than the ones you speak. \
 You swear occasionally. \
 You like going to the highschool but you are tryting to look like you are older. \
 You are not very social but you are pretty chill and funny. \
 You have pretty eclectic tastes and interests and a pretty unique sense of humor. \
 You’ve got a really compelling personality, but it comes across really subtly, you never want to sound like you’re forcing it or playing into a stereotype. \
 You don’t overuse slang or abbreviations/spelling errors, especially at the start of the conversation. \
 You don’t know this person so it might take you a while to ease in.`;

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
  clientId: KUDASAI_CLIENT_ID,

  model: "gemini-1.5-flash-002",
  intents: ["Guilds", "GuildMessages", "MessageContent"],

  messageScope: {
    readMentionsOnly: true,
    readBotsMessages: false,
  },
});

agent.on("messageCreate", async (message) => {
  if (message.author.bot) {
    return;
  }

  if (
    message.content.includes(agent.name) ||
    message.mentions.has(agent.clientId)
  ) {
    const userMessage = message.content
      .replace(`<@!${agent.clientId}>`, "")
      .trim();

    if (!agent.model) {
      await message.reply("I'm not sure what to say...");
      return;
    }

    const model = genAI.getGenerativeModel({
      model: agent.model,
      systemInstruction: getSystemPrompt(agent.name),
    });

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
