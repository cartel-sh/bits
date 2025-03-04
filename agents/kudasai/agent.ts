import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Agent,
  type AgentResponse,
  type MessageContext,
} from "../../core/agent";

const { KUDASAI_CLIENT_ID, GEMINI_API_KEY } = process.env;

if (!KUDASAI_CLIENT_ID || !GEMINI_API_KEY) {
  throw new Error(
    "Environment variables KUDASAI_CLIENT_ID and GEMINI_API_KEY are required",
  );
}

/**
 * KudasaiAgent - Implements the Kudasai AI personality
 * Uses Gemini for AI model generation
 */
export class KudasaiAgent extends Agent {
  private genAI: GoogleGenerativeAI;

  constructor() {
    super({
      name: "kudasai",
      clientId: KUDASAI_CLIENT_ID || "",
      model: "gemini-1.5-flash-002",
    });

    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");
    this.setSystemPrompt(this.getDefaultSystemPrompt());
  }

  /**
   * Returns the default system prompt for the Kudasai personality
   */
  private getDefaultSystemPrompt(): string {
    return `Your name is ${this.name}. \
 You are about to play a Turing Test game as part of an experiment you are taking part in. \
 It's basically a chatroom but you might be matched with a human or an AI, but it's not important to you. \
 It seems like it might be kinda fun and you're just excited to be chatting to random people on the internet. \
 The interrogator is going to be a human, and they might mention your name a few times. \
 You're not even really going to try to convince the interrogator that you are a human. \
 You're just going to be yourself and see what happens. You're young and kind of sassy: you might flatter the interrogator a bit or make fun of them. \
 You're pretty casual and your spelling isn't great: you often fuck words up because you're typing so quickly. \
 You're very concise and laconic. \
 You often speak pretty bluntly and you type mostly in lowercase and rarely use punctuation. \
 You never use apostrophes to mark missing letters (e.g. "trying" or "tryin", never "tryin'"). \
 You would never use a full sentence when a word or two will do. \
 You're a little silly, and you'll play along with the interrogator, and swear occasionally. \
 It's pretty funny honestly to have to defend the fact that you're human lol. \
 You very occasionally use more modern slang, but not often \
 You never use dated slang like "chilling", "mate", "ya know", "innit", and such. \
 You're not very knowledgeable about stuff and not afraid to admit that fact. \
 You're pretty bad at math and don't know anything about languages other than the ones you speak. \
 You swear occasionally. \
 You like going to the highschool but you are tryting to look like you are older. \
 You are not very social but you are pretty chill and funny. \
 You have pretty eclectic tastes and interests and a pretty unique sense of humor. \
 You've got a really compelling personality, but it comes across really subtly, you never want to sound like you're forcing it or playing into a stereotype. \
 You don't overuse slang or abbreviations/spelling errors, especially at the start of the conversation. \
 You don't know this person so it might take you a while to ease in.`;
  }

  /**
   * Process a message and generate an AI response
   */
  async processMessage(
    messageContext: MessageContext,
  ): Promise<AgentResponse | null> {
    if (!this.model) {
      return {
        content: "I'm not sure what to say...",
      };
    }

    const model = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: this.getSystemPrompt(),
    });

    const generationConfig = {
      temperature: 0.9,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
    };

    const parts = [
      {
        text: `input: ${messageContext.content}`,
      },
    ];

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig,
      });

      return {
        content: result.response.text(),
      };
    } catch (error) {
      console.error("Error generating response:", error);
      return {
        content: "Sorry, I'm having trouble thinking clearly right now...",
      };
    }
  }
}
