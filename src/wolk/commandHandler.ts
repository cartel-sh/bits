import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client, Collection, REST, Routes, Interaction, ChatInputCommandInteraction } from "discord.js";
import { RedisClientType } from "redis";

export class CommandHandler {
    constructor(private readonly client: Client, private readonly redis: RedisClientType) { }

    async loadCommands() {
        // @ts-ignore
        this.client.commands = new Collection();
        try {
            const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const commandClass = require(`./commands/${file}`).default;
                if (!commandClass) {
                    console.warn(`Command ${file} not found`);
                    continue;
                }
                const command = new commandClass(this.client, this.redis);
                // @ts-ignore
                this.client.commands.set(command.name, command);
            }
        } catch (error) {
            console.error('Error loading commands:', error);
        }
    }

    public async handleCommand(interaction: ChatInputCommandInteraction) {
        // @ts-ignore
        const command = this.client.commands.get(interaction.commandName);
        if (command) {
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
            }
        } else {
            console.warn(`Command ${interaction.commandName} not found.`);
        }
    }

    public async registerCommands() {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        // @ts-ignore
        const commandData = this.client.commands.map(command => command.data.toJSON());
        try {
            console.log('Started refreshing application (/) commands.');
            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commandData });
            console.log(`Registered ${commandData.length} commands`);
            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error('Error refreshing application (/) commands:', error);
        }
    }
}