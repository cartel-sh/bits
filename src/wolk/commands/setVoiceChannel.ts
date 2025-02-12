import { ChannelType, ChatInputCommandInteraction, Client, Interaction, SlashCommandBuilder } from "discord.js";
import { RedisClientType } from "redis";
import { Command } from "../base/command";

export default class SetVoiceChannelCommand extends Command {
    
    constructor(client: Client, redis: RedisClientType) {
        super(client, redis);
        this.name = "set-voice-channel";
        this.description = "Set the voice channel for the bot to monitor";
        this.usage = "set-voice-channel";
        // @ts-ignore
        this.data = new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addChannelOption(option => option.setName("channel").setDescription("The channel to set").setRequired(false));
    }

    async execute(interaction: ChatInputCommandInteraction) {
        //allow a user to set a voice channel for the bot to monitor
        const channel = interaction.options.getChannel("channel");
        if (!channel) {
            await interaction.reply({ content: "Please provide a channel to set", ephemeral: true });
            return;
        }
        // check that the channel is a text channel
        if (channel.type !== ChannelType.GuildVoice) {
            await interaction.reply({ content: "Please provide a voice channel", ephemeral: true });
            return;
        }
        await this.redis.set(`voiceChannel:${interaction.guildId}`, channel.id);
        await interaction.reply({ content: `Voice channel set to ${channel.name}`, ephemeral: true });
    }
}