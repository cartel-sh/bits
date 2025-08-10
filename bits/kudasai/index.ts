import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import {
  Client,
  GatewayIntentBits,
  type Interaction,
  type Message,
  MessageFlags,
  type TextChannel,
} from "discord.js";
import { AgentResponse, type MessageContext } from "../../core/agent";
import { KudasaiAgent } from "./agent";
import { vanishCommand } from "./commands/vanish";
import { deleteOldMessages } from "./utils/messageDeleter";

const { KUDASAI_TOKEN, KUDASAI_CLIENT_ID } = process.env;

if (!KUDASAI_TOKEN || !KUDASAI_CLIENT_ID) {
  throw new Error(
    "Environment variables KUDASAI_TOKEN and KUDASAI_CLIENT_ID are required",
  );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const kudasaiAgent = new KudasaiAgent();

const commands = [vanishCommand.data.toJSON()];

const registerCommands = async () => {
  try {
    const rest = new REST({ version: "9" }).setToken(KUDASAI_TOKEN);
    await rest.put(Routes.applicationCommands(KUDASAI_CLIENT_ID), {
      body: commands,
    });
    console.log("Successfully registered application commands for Kudasai");
  } catch (error) {
    console.error("Error registering application commands for Kudasai:", error);
  }
};

client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    switch (interaction.commandName) {
      case "vanish":
        await vanishCommand.execute(interaction);
        break;
      default:
        console.warn(`Unknown command: ${interaction.commandName}`);
    }
  } catch (error) {
    console.error("Error executing command:", error);
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({
        content: "An error occurred while processing your command.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

client.on("messageCreate", async (message: Message) => {
  if (message.author.bot) {
    return;
  }

  const isMention =
    message.content.toLowerCase().includes(kudasaiAgent.name) ||
    message.mentions.users.has(kudasaiAgent.clientId);

  if (isMention) {
    const userMessage = message.content
      .replace(`<@!${kudasaiAgent.clientId}>`, "")
      .trim();

    const messageContext: MessageContext = {
      content: userMessage,
      authorId: message.author.id,
      authorName: message.author.username,
      channelId: message.channelId,
      isMention: true,
    };

    try {
      const response = await kudasaiAgent.processMessage(messageContext);

      if (response) {
        // Handle response text (may need to split if over 2000 chars)
        const reply = response.content;

        if (reply.length > 2000) {
          const replyArray = reply.match(/[\s\S]{1,2000}/g);

          if (replyArray) {
            for (const msg of replyArray) {
              await message.reply(msg);
            }
          }
        } else {
          await message.reply(reply);
        }
      }
    } catch (error) {
      console.error("Error handling message:", error);
      await message.reply(
        "I'm having trouble processing your message right now.",
      );
    }
  }
});

async function sendMessage(channelId: string, content: string): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      await (channel as TextChannel).send(content);
    } else {
      console.error(`Channel ${channelId} is not a text channel.`);
    }
  } catch (error) {
    console.error(`Error sending message to channel ${channelId}:`, error);
  }
}

declare global {
  var kudasaiDeleteInterval: ReturnType<typeof setInterval> | undefined;
}

client.once("ready", () => {
  console.log(`${kudasaiAgent.name} is ready!`);

  registerCommands();

  global.kudasaiDeleteInterval = setInterval(
    () => deleteOldMessages(client),
    60000,
  );
});

const handleShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Starting cleanup...`);
  try {
    if (client) {
      console.log("Destroying Discord client connection...");
      await client.destroy();
    }

    console.log("Cleanup completed. Exiting...");
    process.exit(0);
  } catch (error) {
    console.error("Error during cleanup:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

client.login(KUDASAI_TOKEN).catch((error) => {
  console.error("Error connecting to Discord:", error);
  process.exit(1);
});
