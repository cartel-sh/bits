import type { Client, TextChannel } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { Express } from "express";
import TelegramBot from "node-telegram-bot-api";
import { CartelClient } from "@cartel-sh/api";

const cartel = new CartelClient(
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

interface WebhookPayload {
  applicationId: string;
  applicationNumber: number;
  type: 'application_created';
}

export function setupRoutes(app: Express, discordClient: Client) {
  app.post("/api/application", async (req, res) => {
    try {
      // Verify webhook secret
      if (ONJO_WEBHOOK_SECRET) {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${ONJO_WEBHOOK_SECRET}`) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
      }

      const webhook: WebhookPayload = req.body;
      console.log("Received webhook:", webhook.type, "for application", webhook.applicationNumber);

      if (!webhook.applicationId || !webhook.applicationNumber || webhook.type !== 'application_created') {
        res.status(400).json({ error: "Invalid webhook payload" });
        return;
      }

      const application = await cartel.applications.getByNumber(webhook.applicationNumber);
      if (!application) {
        console.error("Application not found:", webhook.applicationNumber);
        res.status(404).json({ error: "Application not found" });
        return;
      }

      console.log("Fetched application data for:", application.walletAddress);

      if (!ONJO_CHANNEL_ID) {
        throw new Error("Environment variable ONJO_CHANNEL_ID is required");
      }
      const channel = await discordClient.channels.fetch(ONJO_CHANNEL_ID);

      if (!channel?.isTextBased()) {
        throw new Error("Invalid Discord channel");
      }

      const embed = new EmbedBuilder()
        .setTitle(`APPLICATION #${application.applicationNumber}`)
        .setColor(0x2b2d31) // Discord dark theme color
        .setDescription(`\`\`\`${application.walletAddress}\`\`\``)
        .addFields([
          {
            name: "Identity",
            value:
              [
                application.ensName ? `**ENS:** ${application.ensName}` : null,
                application.github
                  ? `**GitHub:** [View Profile](${application.github})`
                  : null,
                application.farcaster
                  ? `**Farcaster:** [View Profile](${application.farcaster})`
                  : null,
                application.lens ? `**Lens:** [View Profile](${application.lens})` : null,
                application.twitter
                  ? `**Twitter:** [View Profile](${application.twitter})`
                  : null,
              ]
                .filter(Boolean)
                .join("\n") || "No social profiles provided",
            inline: false,
          },
          {
            name: "What excites you the most in life?",
            value: `> ${application.excitement?.substring(0, 1000).replace(/\n/g, "\n> ") || 'No response provided'}`,
            inline: false,
          },
          {
            name: "Why are you a good fit for the cartel?",
            value: `> ${application.motivation?.substring(0, 1000).replace(/\n/g, "\n> ") || 'No response provided'}`,
            inline: false,
          },
        ])
        .setFooter({ text: "Pending Review • 0 approvals | 0 rejections" })
        .setTimestamp();

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_${application.applicationNumber}`)
          .setLabel("YAY")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_${application.applicationNumber}`)
          .setLabel("NAY")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`delete_${application.applicationNumber}`)
          .setLabel("Delete")
          .setStyle(ButtonStyle.Secondary),
      );

      const discordMessage = await (channel as TextChannel).send({
        embeds: [embed],
        components: [buttons],
      });

      // TODO: Update the application with the Discord message ID
      // This would require an API endpoint to update the messageId field
      console.log(`Discord message posted for application #${application.applicationNumber}: ${discordMessage.id}`);

      if (telegramBot && ONJO_TELEGRAM_CHANNEL_ID) {
        const telegramMessage = `
<b>New Cartel Application #${application.applicationNumber}</b>

<b>Wallet:</b> <code>${application.walletAddress}</code>
${application.ensName ? `<b>ENS:</b> ${application.ensName}\n` : ""}
<b>Socials:</b>
${application.github ? `  • GitHub: ${application.github}\n` : ""}${application.farcaster ? `  • Farcaster: ${application.farcaster}\n` : ""}${application.lens ? `  • Lens: ${application.lens}\n` : ""}${application.twitter ? `  • Twitter: ${application.twitter}\n` : ""}
<b>What excites them:</b>
${application.excitement || 'No response provided'}

<b>Why they're a good fit:</b>
${application.motivation || 'No response provided'}

<i>Submitted at ${application.submittedAt ? new Date(application.submittedAt).toLocaleString() : 'Unknown'}</i>
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
        applicationNumber: application.applicationNumber,
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
