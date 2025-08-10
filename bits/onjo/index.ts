import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import {
  Client,
  GatewayIntentBits,
  type Interaction,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  PermissionFlagsBits,
  ComponentType,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import express from "express";
import { setupRoutes } from "./server";
import {
  getApplicationByMessageId,
  getApplicationByNumber,
  addVote,
  getVotes,
  updateApplicationStatus,
  deleteApplication as deleteApplicationFromDb
} from "./database/db";

const {
  APPLICATIONS_TOKEN,
  APPLICATIONS_CLIENT_ID,
  APPLICATIONS_PORT,
  APPLICATIONS_CHANNEL_ID,
} = process.env;

if (!APPLICATIONS_TOKEN || !APPLICATIONS_CLIENT_ID || !APPLICATIONS_CHANNEL_ID) {
  throw new Error(
    "Environment variables APPLICATIONS_TOKEN, APPLICATIONS_CLIENT_ID, and APPLICATIONS_CHANNEL_ID are required",
  );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const app = express();
app.use(express.json());
setupRoutes(app, client);

client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isButton()) return;

  try {
    const [action, applicationNumberStr] = interaction.customId.split("_");
    const applicationNumber = parseInt(applicationNumberStr);

    const application = await getApplicationByNumber(applicationNumber);
    if (!application) {
      await interaction.reply({
        content: "Application not found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === "delete") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: "You need administrator permissions to delete applications.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await deleteApplicationFromDb(application.id);
      await interaction.message.delete();

      await interaction.reply({
        content: `Application #${applicationNumber} deleted successfully.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const voteType = action as "approve" | "reject";
    const userId = interaction.user.id;
    const userName = interaction.user.username;

    await addVote(application.id, userId, userName, voteType);
    const votes = await getVotes(application.id);

    const originalEmbed = interaction.message.embeds[0];
    const status = votes.approvalCount > votes.rejectionCount
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

    const APPROVAL_THRESHOLD = 7;
    const REJECTION_THRESHOLD = 7;

    if (votes.approvalCount >= APPROVAL_THRESHOLD && application.status === "pending") {
      await updateApplicationStatus(application.id, "approved");
      updatedEmbed
        .setTitle(
          originalEmbed.title?.replace("APPLICATION", "APPROVED") ?? null,
        )
        .setColor(0x57f287)
        .setFooter({ text: `Approved • ${votes.approvalCount} votes in favor` });

      const disabledButtons = new ActionRowBuilder<MessageActionRowComponentBuilder>()
        .addComponents(
          interaction.message.components[0].components.map((c) => {
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
                return ButtonBuilder.from(c as any);
            }
          }),
        );

      await interaction.update({ embeds: [updatedEmbed], components: [disabledButtons] });
    } else if (votes.rejectionCount >= REJECTION_THRESHOLD && application.status === "pending") {
      await updateApplicationStatus(application.id, "rejected");
      updatedEmbed
        .setTitle(
          originalEmbed.title?.replace("APPLICATION", "REJECTED") ?? null,
        )
        .setColor(0xed4245)
        .setFooter({ text: `Rejected • ${votes.rejectionCount} votes against` });

      const disabledButtons = new ActionRowBuilder<MessageActionRowComponentBuilder>()
        .addComponents(
          interaction.message.components[0].components.map((c) => {
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
                return ButtonBuilder.from(c as any);
            }
          }),
        );

      await interaction.update({ embeds: [updatedEmbed], components: [disabledButtons] });
    } else {
      await interaction.update({ embeds: [updatedEmbed] });
    }

    const voteMessage = voteType === "approve"
      ? `You voted YAY on application #${applicationNumber}`
      : `You voted NAY on application #${applicationNumber}`;

    await interaction.followUp({
      content: voteMessage,
      flags: MessageFlags.Ephemeral,
    });

  } catch (error) {
    console.error("Error handling button interaction:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "An error occurred while processing your vote.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

client.once("ready", () => {
  console.log("Onjo is ready!");

  const port = APPLICATIONS_PORT || 3001;
  app.listen(port, () => {
    console.log(`Webhook server listening on port ${port}`);
  });
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

client.login(APPLICATIONS_TOKEN).catch((error) => {
  console.error("Error connecting to Discord:", error);
  process.exit(1);
});