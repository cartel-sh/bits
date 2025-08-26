import type { Client, TextChannel } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { Express } from "express";
import TelegramBot from "node-telegram-bot-api";
import { CartelDBClient } from "@cartel-sh/api";

const client = new CartelDBClient(
  process.env.API_URL || "https://api.cartel.sh",
  process.env.API_KEY
);

const {
  ONJO_TELEGRAM_BOT_TOKEN,
  ONJO_TELEGRAM_CHANNEL_ID,
  ONJO_WEBHOOK_SECRET,
  ONJO_CHANNEL_ID,
} = process.env;

const telegramBot = ONJO_TELEGRAM_BOT_TOKEN
  ? new TelegramBot(ONJO_TELEGRAM_BOT_TOKEN, { polling: false })
  : null;

interface ApplicationPayload {
  walletAddress: string;
  ensName?: string;
  github?: string;
  farcaster?: string;
  lens?: string;
  twitter?: string;
  excitement: string;
  motivation: string;
  signature: string;
  message: string;
}

export function setupRoutes(app: Express, discordClient: Client) {
  app.post("/api/application", async (req, res) => {
    try {
      if (ONJO_WEBHOOK_SECRET) {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${ONJO_WEBHOOK_SECRET}`) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
      }

      const data: ApplicationPayload = req.body;
      console.log("Received application from:", data.walletAddress);

      if (!data.walletAddress || !data.excitement || !data.motivation) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      if (!ONJO_CHANNEL_ID) {
        throw new Error("Environment variable ONJO_CHANNEL_ID is required");
      }
      const channel = await discordClient.channels.fetch(ONJO_CHANNEL_ID);

      if (!channel?.isTextBased()) {
        throw new Error("Invalid Discord channel");
      }

      // Create the application first to get the application number
      const result = await client.createApplication({
        messageId: "temp", // Temporary ID, will update after posting
        walletAddress: data.walletAddress,
        ensName: data.ensName || null,
        github: data.github || null,
        farcaster: data.farcaster || null,
        lens: data.lens || null,
        twitter: data.twitter || null,
        excitement: data.excitement,
        motivation: data.motivation,
        signature: data.signature,
      });
      const applicationNumber = result.applicationNumber;

      const embed = new EmbedBuilder()
        .setTitle(`APPLICATION #${applicationNumber}`)
        .setColor(0x2b2d31) // Discord dark theme color
        .setDescription(`\`\`\`${data.walletAddress}\`\`\``)
        .addFields([
          {
            name: "Identity",
            value:
              [
                data.ensName ? `**ENS:** ${data.ensName}` : null,
                data.github
                  ? `**GitHub:** [View Profile](${data.github})`
                  : null,
                data.farcaster
                  ? `**Farcaster:** [View Profile](${data.farcaster})`
                  : null,
                data.lens ? `**Lens:** [View Profile](${data.lens})` : null,
                data.twitter
                  ? `**Twitter:** [View Profile](${data.twitter})`
                  : null,
              ]
                .filter(Boolean)
                .join("\n") || "No social profiles provided",
            inline: false,
          },
          {
            name: "What excites you the most in life?",
            value: `> ${data.excitement.substring(0, 1000).replace(/\n/g, "\n> ")}`,
            inline: false,
          },
          {
            name: "Why are you a good fit for the cartel?",
            value: `> ${data.motivation.substring(0, 1000).replace(/\n/g, "\n> ")}`,
            inline: false,
          },
        ])
        .setFooter({ text: "Pending Review • 0 approvals | 0 rejections" })
        .setTimestamp();

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_${applicationNumber}`)
          .setLabel("YAY")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_${applicationNumber}`)
          .setLabel("NAY")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`delete_${applicationNumber}`)
          .setLabel("Delete")
          .setStyle(ButtonStyle.Secondary),
      );

      const discordMessage = await (channel as TextChannel).send({
        embeds: [embed],
        components: [buttons],
      });

      // Update the application with the actual message ID
      // Note: The API doesn't have an update method, so we might need to delete and recreate
      // or the API should be updated to support this use case

      if (telegramBot && ONJO_TELEGRAM_CHANNEL_ID) {
        const telegramMessage = `
<b>New Cartel Application #${applicationNumber}</b>

<b>Wallet:</b> <code>${data.walletAddress}</code>
${data.ensName ? `<b>ENS:</b> ${data.ensName}\n` : ""}
<b>Socials:</b>
${data.github ? `  • GitHub: ${data.github}\n` : ""}${data.farcaster ? `  • Farcaster: ${data.farcaster}\n` : ""}${data.lens ? `  • Lens: ${data.lens}\n` : ""}${data.twitter ? `  • Twitter: ${data.twitter}\n` : ""}
<b>What excites them:</b>
${data.excitement}

<b>Why they're a good fit:</b>
${data.motivation}

<i>Submitted at ${new Date().toLocaleString()}</i>
        `.trim();

        try {
          await telegramBot.sendMessage(
            ONJO_TELEGRAM_CHANNEL_ID,
            telegramMessage,
            {
              parse_mode: "HTML",
              disable_web_page_preview: true,
            },
          );
          console.log("Application sent to Telegram");
        } catch (telegramError) {
          console.error("Failed to send to Telegram:", telegramError);
        }
      }

      res.json({
        success: true,
        messageId: discordMessage.id,
        sentTo: ONJO_TELEGRAM_CHANNEL_ID
          ? ["discord", "telegram"]
          : ["discord"],
      });
    } catch (error) {
      console.error("Error handling application:", error);
      res.status(500).json({
        error: "Failed to process application",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/health", (_, res) => {
    res.json({
      status: "ok",
      discord: discordClient.isReady(),
      telegram: !!telegramBot,
    });
  });

  app.post("/api/verify-signature", async (req, res) => {
    try {
      const { walletAddress } = req.body;

      console.log("Signature verification requested for:", walletAddress);

      res.json({
        verified: true, // Placeholder
        note: "Signature verification not yet implemented",
      });
    } catch (error) {
      res.status(500).json({ error: "Verification failed" });
    }
  });
}
