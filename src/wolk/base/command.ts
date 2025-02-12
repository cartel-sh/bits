import { ChatInputCommandInteraction, Client, SlashCommandBuilder } from "discord.js";
import { RedisClientType } from "redis";

export abstract class Command {
    protected readonly client: Client;
    protected readonly redis: RedisClientType;
    public name: string = "OVERRIDE_ME";
    public command: string;
    public description: string;
    public usage: string;
    public args: string[];
    public data: SlashCommandBuilder;
    constructor(client: Client, redis: RedisClientType) {
        this.client = client;
        this.redis = redis;
    }

    public abstract execute(interaction: ChatInputCommandInteraction): Promise<void>;


}