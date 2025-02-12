import { ChannelType, ChatInputCommandInteraction, Client, Interaction, SlashCommandBuilder } from "discord.js";
import { RedisClientType } from "redis";
import { Command } from "../base/command";

export default class SetTextChannelCommand extends Command {
    
    constructor(client: Client, redis: RedisClientType) {
        super(client, redis);
        this.name = "set-text-channel";
        this.description = "Set the text channel for the bot to send messages in";
        this.usage = "set-text-channel";
        // @ts-ignore
        this.data = new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addChannelOption(option => option.setName("channel").setDescription("The channel to set").setRequired(false));
    }

    async execute(interaction: ChatInputCommandInteraction) {
        //allow a user to set a text channel for the bot to send messages in
        const channel = interaction.options.getChannel("channel");
        if (!channel) {
            await interaction.reply({ content: "Please provide a channel to set", ephemeral: true });
            return;
        }
        // check that the channel is a text channel
        if (channel.type !== ChannelType.GuildText) {
            await interaction.reply({ content: "Please provide a text channel", ephemeral: true });
            return;
        }
        await this.redis.set(`textChannel:${interaction.guildId}`, channel.id);
        await interaction.reply({ content: `Text channel set to ${channel.name}`, ephemeral: true });
    }
}