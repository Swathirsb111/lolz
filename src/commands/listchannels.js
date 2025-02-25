const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listchannels')
        .setDescription('List all YouTube channels being monitored')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need Administrator permissions to use this command!', ephemeral: true });
        }

        try {
            const settings = await getGuildSettings(interaction.guildId);
            
            if (!settings || !settings.channels || settings.channels.length === 0) {
                return interaction.reply({
                    content: 'No YouTube channels are currently being monitored.',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('📺 Monitored YouTube Channels')
                .setDescription('Here are all the YouTube channels currently being monitored:')
                .setTimestamp();

            settings.channels.forEach((channel, index) => {
                const liveChannel = interaction.guild.channels.cache.get(channel.liveChannelId);
                const uploadChannel = interaction.guild.channels.cache.get(channel.uploadChannelId);
                
                embed.addFields({
                    name: `Channel ${index + 1}`,
                    value: `**URL:** ${channel.youtubeChannel}\n` +
                          `**Live Notifications:** ${liveChannel ? liveChannel.toString() : 'Channel not found'}\n` +
                          `**Upload Notifications:** ${uploadChannel ? uploadChannel.toString() : 'Channel not found'}\n` +
                          `**Live Status:** ${channel.lastLiveStatus ? '🔴 Live' : '⚫ Offline'}`
                });
            });

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            console.error('List channels error:', error);
            await interaction.reply({
                content: 'An error occurred while listing the channels.',
                ephemeral: true
            });
        }
    },
};
