import {
  type BitFieldResolvable,
  Client,
  type GatewayIntentsString,
  type Message,
  type TextChannel,
} from "discord.js";

interface MessageScope {
  readBotsMessages?: boolean;
  readMentionsOnly?: boolean;
}

/**
 * Represents the configuration for an AI agent
 */
export interface AgentConfig {
  /** The name of the agent */
  name: string;

  /** The client ID associated with the agent's Discord bot */
  clientId: string;

  /** The AI model to use for generating responses */
  model?: string;

  /** Optional initialization function */
  init?(): void;
}

/**
 * Message context information for AI processing
 */
export interface MessageContext {
  /** The content of the message */
  content: string;

  /** The author's ID */
  authorId: string;

  /** The author's username */
  authorName: string;

  /** The channel ID where the message was sent */
  channelId: string;

  /** Flag indicating if this message mentions the agent */
  isMention: boolean;
}

/**
 * Response from the AI agent
 */
export interface AgentResponse {
  /** The text content to reply with */
  content: string;

  /** Optional metadata about the response */
  metadata?: Record<string, any>;
}

/**
 * Core Agent interface that handles AI model communication and context management
 */
export class Agent {
  /** The name of the agent */
  public readonly name: string;

  /** The client ID associated with the agent */
  public readonly clientId: string;

  /** The AI model being used */
  public readonly model?: string;

  /** System prompt for the AI model */
  private systemPrompt: string;

  /**
   * Creates a new Agent instance
   */
  constructor(config: AgentConfig) {
    this.name = config.name;
    this.clientId = config.clientId;
    this.model = config.model;
    this.systemPrompt = "";

    if (config.init) {
      config.init();
    }
  }

  /**
   * Sets the system prompt for the AI model
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Gets the current system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Process a message and generate a response
   * This should be implemented by specific agent implementations
   */
  async processMessage(
    messageContext: MessageContext,
  ): Promise<AgentResponse | null> {
    // Base implementation doesn't handle messages
    return null;
  }
}
