import {
  type APIMessageComponent,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  Client,
  ComponentType,
  EmbedBuilder,
  GatewayIntentBits,
  type Interaction,
  MentionableSelectMenuBuilder,
  type MessageActionRowComponentBuilder,
  MessageFlags,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} from "discord.js";
import express from "express";
import { CartelClient } from "@cartel-sh/api";

const cartel = new CartelClient(
  process.env.API_URL || "https://api.cartel.sh",
  process.env.API_KEY
);
import { setupRoutes } from "./server";

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

const { 
  ONJO_TOKEN, 
  ONJO_CLIENT_ID, 
  ONJO_PORT, 
  ONJO_CHANNEL_ID,
  PUBLIC_URL,
  API_URL,
  API_KEY,
  ONJO_WEBHOOK_SECRET
} = process.env;

if (!ONJO_TOKEN || !ONJO_CLIENT_ID || !ONJO_CHANNEL_ID) {
  logger.error("Missing required environment variables", {
    hasOnjoToken: !!ONJO_TOKEN,
    hasOnjoClientId: !!ONJO_CLIENT_ID,
    hasOnjoChannelId: !!ONJO_CHANNEL_ID
  });
  throw new Error(
    "Environment variables ONJO_TOKEN, ONJO_CLIENT_ID, and ONJO_CHANNEL_ID are required",
  );
}

logger.info("Onjo bot starting up", {
  clientId: ONJO_CLIENT_ID,
  channelId: ONJO_CHANNEL_ID,
  port: ONJO_PORT || 3001,
  apiUrl: API_URL || "https://api.cartel.sh",
  publicUrl: PUBLIC_URL || "https://bits.cartel.sh",
  hasApiKey: !!API_KEY,
  hasWebhookSecret: !!ONJO_WEBHOOK_SECRET,
  autoRegistrationEnabled: !!(PUBLIC_URL && API_URL && API_KEY)
});

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const app = express();
app.use(express.json());
setupRoutes(app, discordClient);

async function registerWebhook(): Promise<void> {
  if (!PUBLIC_URL || !API_URL || !API_KEY) {
    logger.warn("Webhook auto-registration skipped - missing environment variables", {
      hasPublicUrl: !!PUBLIC_URL,
      hasApiUrl: !!API_URL,
      hasApiKey: !!API_KEY
    });
    return;
  }

  const webhookUrl = `${PUBLIC_URL}/onjo/webhook`;
  const subscriptionName = "Onjo Discord Bot";

  try {
    logger.info("Checking existing webhook subscriptions");
    
    const existingWebhooks = await cartel.webhooks.list();
    const existingWebhook = existingWebhooks.find(
      webhook => webhook.name === subscriptionName || webhook.url === webhookUrl
    );

    if (existingWebhook) {
      logger.info("Webhook subscription already exists", {
        subscriptionId: existingWebhook.id,
        name: existingWebhook.name,
        url: existingWebhook.url,
        events: existingWebhook.events,
        isActive: existingWebhook.isActive
      });

      if (!existingWebhook.isActive || !existingWebhook.events.includes("application_created")) {
        logger.info("Updating existing webhook subscription");
        await cartel.webhooks.update(existingWebhook.id, {
          isActive: true,
          events: ["application_created"],
          secret: ONJO_WEBHOOK_SECRET,
          url: webhookUrl
        });
        logger.info("Webhook subscription updated successfully");
      }
      return;
    }

    logger.info("Creating new webhook subscription", {
      name: subscriptionName,
      url: webhookUrl,
      events: ["application_created"],
      hasSecret: !!ONJO_WEBHOOK_SECRET
    });

    const newWebhook = await cartel.webhooks.create({
      name: subscriptionName,
      url: webhookUrl,
      secret: ONJO_WEBHOOK_SECRET,
      events: ["application_created"],
      metadata: {
        description: "Discord bot for application voting and notifications",
        retryAttempts: 3,
        timeout: 10000
      }
    });

    logger.info("Webhook subscription created successfully", {
      subscriptionId: newWebhook.id,
      name: newWebhook.name,
      url: newWebhook.url,
      events: newWebhook.events
    });

  } catch (error) {
    logger.error("Failed to register webhook subscription", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      webhookUrl,
      subscriptionName
    });
  }
}

discordClient.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isButton()) {
    return;
  }

  const interactionId = Math.random().toString(36).substring(7);
  logger.info("Button interaction received", {
    interactionId,
    customId: interaction.customId,
    userId: interaction.user.id,
    username: interaction.user.username,
    guildId: interaction.guildId,
    channelId: interaction.channelId
  });

  try {
    const [action, applicationNumberStr] = interaction.customId.split("_");
    const applicationNumber = Number.parseInt(applicationNumberStr);

    logger.debug("Parsed interaction", {
      interactionId,
      action,
      applicationNumber
    });

    const application = await cartel.applications.getByNumber(applicationNumber);
    if (!application) {
      logger.warn("Application not found for interaction", {
        interactionId,
        applicationNumber
      });
      await interaction.reply({
        content: "Application not found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    logger.info("Application found for interaction", {
      interactionId,
      applicationId: application.id,
      applicationNumber: application.applicationNumber,
      status: application.status
    });

    if (action === "delete") {
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        logger.warn("Unauthorized delete attempt", {
          interactionId,
          userId: interaction.user.id,
          username: interaction.user.username,
          applicationNumber
        });
        await interaction.reply({
          content: "You need administrator permissions to delete applications.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      logger.info("Deleting application", {
        interactionId,
        applicationId: application.id,
        applicationNumber,
        deletedBy: interaction.user.username
      });

      await cartel.applications.delete(application.id);
      await interaction.message.delete();

      logger.info("Application deleted successfully", {
        interactionId,
        applicationNumber
      });

      await interaction.reply({
        content: `Application #${applicationNumber} deleted successfully.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const voteType = action as "approve" | "reject";
    const userId = interaction.user.id;
    const userName = interaction.user.username;

    logger.info("Processing vote", {
      interactionId,
      voteType,
      userId,
      userName,
      applicationId: application.id,
      applicationNumber
    });

    await cartel.applications.vote(application.id, {
      userId,
      userName,
      voteType,
    });

    logger.info("Vote submitted successfully", {
      interactionId,
      voteType,
      userId,
      userName,
      applicationNumber
    });
    
    const votes = { approvalCount: 0, rejectionCount: 0 };

    logger.debug("Vote counts retrieved", {
      interactionId,
      applicationNumber,
      votes
    });

    const originalEmbed = interaction.message.embeds[0];
    const status =
      votes.approvalCount > votes.rejectionCount
        ? "Leaning Positive"
        : votes.rejectionCount > votes.approvalCount
          ? "Leaning Negative"
          : "Pending Review";

    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setFooter({
        text: `${status} • ${votes.approvalCount} approvals | ${votes.rejectionCount} rejections`,
      })
      .setColor(
        votes.approvalCount > votes.rejectionCount
          ? 0x57f287 // Green
          : votes.rejectionCount > votes.approvalCount
            ? 0xed4245 // Red
            : 0x2b2d31, // Dark gray
      );

    const mapComponent = (c: APIMessageComponent) => {
      switch (c.type) {
        case ComponentType.Button:
          return ButtonBuilder.from(c).setDisabled(true);
        case ComponentType.StringSelect:
          return StringSelectMenuBuilder.from(c);
        case ComponentType.UserSelect:
          return UserSelectMenuBuilder.from(c);
        case ComponentType.RoleSelect:
          return RoleSelectMenuBuilder.from(c);
        case ComponentType.ChannelSelect:
          return ChannelSelectMenuBuilder.from(c);
        case ComponentType.MentionableSelect:
          return MentionableSelectMenuBuilder.from(c);
        default:
          return new ButtonBuilder()
            .setCustomId("noop")
            .setLabel("noop")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);
      }
    };

    const APPROVAL_THRESHOLD = 7;
    const REJECTION_THRESHOLD = 7;

    if (
      votes.approvalCount >= APPROVAL_THRESHOLD &&
      application.status === "pending"
    ) {
      logger.info("Application reached approval threshold", {
        interactionId,
        applicationNumber,
        approvalCount: votes.approvalCount,
        threshold: APPROVAL_THRESHOLD,
        currentStatus: application.status
      });

      await cartel.applications.updateStatus(application.id, "approved");
      
      logger.info("Application status updated to approved", {
        interactionId,
        applicationId: application.id,
        applicationNumber,
        newStatus: "approved"
      });

      updatedEmbed
        .setTitle(
          originalEmbed.title?.replace("APPLICATION", "APPROVED") ?? null,
        )
        .setColor(0x57f287)
        .setFooter({
          text: `Approved • ${votes.approvalCount} votes in favor`,
        });

      const disabledButtons =
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          interaction.message.components[0].components.map((c) =>
            mapComponent(c as APIMessageComponent),
          ),
        );

      await interaction.update({
        embeds: [updatedEmbed],
        components: [disabledButtons],
      });

      logger.info("Discord message updated for approved application", {
        interactionId,
        applicationNumber
      });
    } else if (
      votes.rejectionCount >= REJECTION_THRESHOLD &&
      application.status === "pending"
    ) {
      logger.info("Application reached rejection threshold", {
        interactionId,
        applicationNumber,
        rejectionCount: votes.rejectionCount,
        threshold: REJECTION_THRESHOLD,
        currentStatus: application.status
      });

      await cartel.applications.updateStatus(application.id, "rejected");
      
      logger.info("Application status updated to rejected", {
        interactionId,
        applicationId: application.id,
        applicationNumber,
        newStatus: "rejected"
      });

      updatedEmbed
        .setTitle(
          originalEmbed.title?.replace("APPLICATION", "REJECTED") ?? null,
        )
        .setColor(0xed4245)
        .setFooter({
          text: `Rejected • ${votes.rejectionCount} votes against`,
        });

      const disabledButtons =
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          interaction.message.components[0].components.map((c) =>
            mapComponent(c as APIMessageComponent),
          ),
        );

      await interaction.update({
        embeds: [updatedEmbed],
        components: [disabledButtons],
      });

      logger.info("Discord message updated for rejected application", {
        interactionId,
        applicationNumber
      });
    } else {
      logger.debug("Application status unchanged, updating embed only", {
        interactionId,
        applicationNumber,
        approvalCount: votes.approvalCount,
        rejectionCount: votes.rejectionCount,
        currentStatus: application.status
      });

      await interaction.update({ embeds: [updatedEmbed] });
    }

    const voteMessage =
      voteType === "approve"
        ? `You voted YAY on application #${applicationNumber}`
        : `You voted NAY on application #${applicationNumber}`;

    await interaction.followUp({
      content: voteMessage,
      flags: MessageFlags.Ephemeral,
    });

    logger.info("Vote interaction completed successfully", {
      interactionId,
      voteType,
      userId,
      userName,
      applicationNumber,
      message: voteMessage
    });
  } catch (error) {
    logger.error("Error handling button interaction", {
      interactionId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      username: interaction.user.username,
      customId: interaction.customId
    });
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "An error occurred while processing your vote.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

discordClient.once("ready", async () => {
  logger.info("Onjo Discord client ready", {
    userId: discordClient.user?.id,
    username: discordClient.user?.username,
    guilds: discordClient.guilds.cache.size
  });

  const port = ONJO_PORT || 3001;
  app.listen(port, async () => {
    logger.info("Webhook server started", {
      port,
      endpoint: "/onjo/webhook",
      healthCheck: "/health"
    });

    await registerWebhook();
  });
});

const handleShutdown = async (signal: string) => {
  logger.info("Shutdown signal received", { signal });
  try {
    if (discordClient) {
      logger.info("Destroying Discord client connection");
      await discordClient.destroy();
    }

    logger.info("Cleanup completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Error during cleanup", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

discordClient.login(ONJO_TOKEN).catch((error) => {
  logger.error("Failed to connect to Discord", {
    error: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});
