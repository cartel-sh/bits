import { ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../base/command";
import { SlashCommandBuilder } from "discord.js";
import { RedisClientType } from "redis";

export default class PingCommand extends Command {
    name: string;
    constructor(client: Client, redis: RedisClientType) {
        super(client, redis);
        this.name = 'ping';
        this.description = 'Ping the bot';
        this.usage = 'ping';
        this.data = new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
    }

    public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.reply({ content: 'Pong!', ephemeral: true });
    }
}