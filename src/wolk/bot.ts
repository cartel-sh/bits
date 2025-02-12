import { Client, IntentsBitField, Events } from "discord.js";
import { CommandHandler } from "./commandHandler";
import { createClient, RedisClientType } from "redis";
import { ActivityTracker } from "./activityTracker";
export class Bot {
    private readonly client: Client;
    private readonly commandHandler: CommandHandler;
    private readonly redis: RedisClientType;
    private readonly activityTracker: ActivityTracker;
    constructor() {
        this.client = new Client({
            intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildVoiceStates],
        });
        this.redis = createClient();
        this.redis.connect();
        this.commandHandler = new CommandHandler(this.client, this.redis);
        this.activityTracker = new ActivityTracker(this.client, this.redis);
    }

    async start() {
        console.log("Starting bot");
        this.commandHandler.loadCommands();
        console.log("Commands loaded");
        await this.client.login(process.env.TOKEN);
        console.log("Logged in");
        // register commands
        this.client.on("ready", () => {
            console.log(`Logged in as ${this.client.user?.tag}`);
            this.commandHandler.registerCommands();
        });
        this.client.on(Events.Error, (error) => {
            console.error(error);
        });
        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            await this.commandHandler.handleCommand(interaction);
        });
        this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
            await this.activityTracker.trackActivity(oldState, newState);
        });

    }
}