import type { Client, TextChannel } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { Express } from "express";
import TelegramBot from "node-telegram-bot-api";
import { CartelClient, type WebhookEventPayload } from "@cartel-sh/api";

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


const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }
};

export function setupRoutes(app: Express, discordClient: Client) {
  app.post("/onjo/webhook", async (req, res) => {
    const startTime = Date.now();
    logger.info("Received webhook request", {
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'authorization': req.headers.authorization ? 'Bearer [REDACTED]' : 'None'
      }
    });

    try {
      // Verify webhook secret
      if (ONJO_WEBHOOK_SECRET) {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${ONJO_WEBHOOK_SECRET}`) {
          logger.warn("Unauthorized webhook request", { authHeader: authHeader ? 'Present but invalid' : 'Missing' });
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
      }

      const webhook: WebhookEventPayload = req.body;
      logger.info("Webhook payload received", {
        eventType: webhook.eventType,
        eventId: webhook.eventId,
        timestamp: webhook.timestamp,
        applicationNumber: webhook.data?.applicationNumber,
        walletAddress: webhook.data?.walletAddress ? `${webhook.data.walletAddress.slice(0, 6)}...${webhook.data.walletAddress.slice(-4)}` : 'Unknown',
        metadata: webhook.metadata
      });

      // Validate webhook payload structure
      if (!webhook.eventType || !webhook.eventId || !webhook.data || !webhook.timestamp || !webhook.metadata) {
        logger.error("Invalid webhook payload structure", { 
          hasEventType: !!webhook.eventType,
          hasEventId: !!webhook.eventId,
          hasData: !!webhook.data,
          hasTimestamp: !!webhook.timestamp,
          hasMetadata: !!webhook.metadata
        });
        res.status(400).json({ error: "Invalid webhook payload structure" });
        return;
      }

      // Validate metadata structure
      if (!webhook.metadata.source || !webhook.metadata.version) {
        logger.error("Invalid webhook metadata structure", {
          hasSource: !!webhook.metadata.source,
          hasVersion: !!webhook.metadata.version,
          metadata: webhook.metadata
        });
        res.status(400).json({ error: "Invalid webhook metadata structure" });
        return;
      }

      // Check if this is an application_created event
      if (webhook.eventType !== 'application_created') {
        logger.info("Ignoring non-application event", { eventType: webhook.eventType });
        res.json({ success: true, message: "Event type not handled by this bot" });
        return;
      }

      // Validate application data - core required fields
      if (!webhook.data.applicationId || !webhook.data.applicationNumber || !webhook.data.walletAddress) {
        logger.error("Invalid application data in webhook", {
          hasApplicationId: !!webhook.data.applicationId,
          hasApplicationNumber: !!webhook.data.applicationNumber,
          hasWalletAddress: !!webhook.data.walletAddress
        });
        res.status(400).json({ error: "Invalid application data in webhook payload" });
        return;
      }

      // Validate required text fields
      if (!webhook.data.excitement?.trim() || !webhook.data.motivation?.trim()) {
        logger.error("Missing required text fields in application data", {
          hasExcitement: !!webhook.data.excitement?.trim(),
          hasMotivation: !!webhook.data.motivation?.trim(),
          applicationNumber: webhook.data.applicationNumber
        });
        res.status(400).json({ error: "Missing required excitement or motivation fields" });
        return;
      }

      // For the new webhook system, we already have all the application data in the payload
      // But let's still verify it exists in the API for consistency
      try {
        const application = await cartel.applications.getByNumber(webhook.data.applicationNumber);
        if (!application) {
          logger.error("Application verification failed - not found in API", { 
            applicationNumber: webhook.data.applicationNumber 
          });
          res.status(404).json({ error: "Application not found in API" });
          return;
        }
        logger.info("Application verified in API", {
          applicationId: application.id,
          applicationNumber: application.applicationNumber,
          status: application.status
        });
      } catch (apiError) {
        logger.error("Failed to verify application in API", apiError);
        // Continue with webhook data anyway, as the API might be temporarily unavailable
        logger.warn("Proceeding with webhook data despite API verification failure");
      }

      // Use webhook data for creating Discord message
      const appData = webhook.data;
      
      logger.info("Creating Discord message", {
        channelId: ONJO_CHANNEL_ID,
        applicationNumber: appData.applicationNumber
      });

      if (!ONJO_CHANNEL_ID) {
        throw new Error("Environment variable ONJO_CHANNEL_ID is required");
      }

      const channel = await discordClient.channels.fetch(ONJO_CHANNEL_ID);
      if (!channel?.isTextBased()) {
        logger.error("Invalid Discord channel", { channelId: ONJO_CHANNEL_ID, channelType: channel?.type });
        throw new Error("Invalid Discord channel");
      }

      logger.debug("Discord channel fetched successfully", { 
        channelName: (channel as TextChannel).name,
        channelType: channel.type 
      });

      const embed = new EmbedBuilder()
        .setTitle(`APPLICATION #${appData.applicationNumber}`)
        .setColor(0x2b2d31) // Discord dark theme color
        .setDescription(`\`\`\`${appData.walletAddress}\`\`\``)
        .addFields([
          {
            name: "Identity",
            value:
              [
                appData.ensName ? `**ENS:** ${appData.ensName}` : null,
                appData.github
                  ? `**GitHub:** [View Profile](${appData.github})`
                  : null,
                appData.farcaster
                  ? `**Farcaster:** [View Profile](${appData.farcaster})`
                  : null,
                appData.lens ? `**Lens:** [View Profile](${appData.lens})` : null,
                appData.twitter
                  ? `**Twitter:** [View Profile](${appData.twitter})`
                  : null,
              ]
                .filter(Boolean)
                .join("\n") || "No social profiles provided",
            inline: false,
          },
          {
            name: "What excites you the most in life?",
            value: `> ${appData.excitement?.substring(0, 1000).replace(/\n/g, "\n> ") || 'No response provided'}`,
            inline: false,
          },
          {
            name: "Why are you a good fit for the cartel?",
            value: `> ${appData.motivation?.substring(0, 1000).replace(/\n/g, "\n> ") || 'No response provided'}`,
            inline: false,
          },
        ])
        .setFooter({ text: "Pending Review • 0 approvals | 0 rejections" })
        .setTimestamp(new Date(webhook.timestamp));

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_${appData.applicationNumber}`)
          .setLabel("YAY")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_${appData.applicationNumber}`)
          .setLabel("NAY")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`delete_${appData.applicationNumber}`)
          .setLabel("Delete")
          .setStyle(ButtonStyle.Secondary),
      );

      logger.info("Sending Discord message", { applicationNumber: appData.applicationNumber });
      const discordMessage = await (channel as TextChannel).send({
        embeds: [embed],
        components: [buttons],
      });

      logger.info("Discord message sent successfully", {
        applicationNumber: appData.applicationNumber,
        messageId: discordMessage.id,
        channelId: ONJO_CHANNEL_ID
      });

      // Send to Telegram if configured
      const sentTo = ["discord"];
      if (telegramBot && ONJO_TELEGRAM_CHANNEL_ID) {
        const telegramMessage = `
<b>New Cartel Application #${appData.applicationNumber}</b>

<b>Wallet:</b> <code>${appData.walletAddress}</code>
${appData.ensName ? `<b>ENS:</b> ${appData.ensName}\n` : ""}
<b>Socials:</b>
${appData.github ? `  • GitHub: ${appData.github}\n` : ""}${appData.farcaster ? `  • Farcaster: ${appData.farcaster}\n` : ""}${appData.lens ? `  • Lens: ${appData.lens}\n` : ""}${appData.twitter ? `  • Twitter: ${appData.twitter}\n` : ""}
<b>What excites them:</b>
${appData.excitement || 'No response provided'}

<b>Why they're a good fit:</b>
${appData.motivation || 'No response provided'}

<i>Submitted at ${new Date(appData.submittedAt).toLocaleString()}</i>
        `.trim();

        try {
          logger.info("Sending Telegram message", { 
            channelId: ONJO_TELEGRAM_CHANNEL_ID,
            applicationNumber: appData.applicationNumber 
          });
          
          await telegramBot.sendMessage(
            ONJO_TELEGRAM_CHANNEL_ID,
            telegramMessage,
            {
              parse_mode: "HTML",
              disable_web_page_preview: true,
            },
          );
          
          logger.info("Telegram message sent successfully", { 
            applicationNumber: appData.applicationNumber 
          });
          sentTo.push("telegram");
        } catch (telegramError) {
          logger.error("Failed to send to Telegram", {
            applicationNumber: appData.applicationNumber,
            error: telegramError
          });
        }
      } else {
        logger.debug("Telegram not configured, skipping", {
          hasTelegramBot: !!telegramBot,
          hasTelegramChannelId: !!ONJO_TELEGRAM_CHANNEL_ID
        });
      }

      const processingTime = Date.now() - startTime;
      logger.info("Webhook processing completed", {
        applicationNumber: appData.applicationNumber,
        processingTimeMs: processingTime,
        sentTo
      });

      res.json({
        success: true,
        messageId: discordMessage.id,
        applicationNumber: appData.applicationNumber,
        eventId: webhook.eventId,
        processingTimeMs: processingTime,
        sentTo,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error("Error processing webhook", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: processingTime
      });
      
      res.status(500).json({
        error: "Failed to process webhook",
        details: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: processingTime,
      });
    }
  });

  app.get("/health", (_, res) => {
    logger.debug("Health check requested");
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      discord: {
        ready: discordClient.isReady(),
        user: discordClient.user?.tag || null,
        guilds: discordClient.guilds.cache.size,
      },
      telegram: {
        configured: !!telegramBot,
        channelId: ONJO_TELEGRAM_CHANNEL_ID || null,
      },
      webhook: {
        endpoint: "/onjo/webhook",
        secretConfigured: !!ONJO_WEBHOOK_SECRET,
      },
      uptime: process.uptime(),
    });
  });

  // Legacy endpoint for backward compatibility (will be removed in future)
  app.post("/api/application", async (req, res) => {
    logger.warn("Legacy webhook endpoint called - please update to /onjo/webhook", {
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
    res.status(410).json({
      error: "This endpoint is deprecated. Please use /onjo/webhook with the new webhook format.",
      newEndpoint: "/onjo/webhook",
      documentation: "See API documentation for the new webhook payload format"
    });
  });
}
