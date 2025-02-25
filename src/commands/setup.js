const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addChannel, getGuildSettings } = require('../utils/database');
const { checkForUpdates } = require('../utils/checkUpdates');
const { normalizeYouTubeUrl } = require('../utils/youtube');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup YouTube notifications for a channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('youtube_channel')
                .setDescription('The YouTube channel URL')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('live_channel')
                .setDescription('Discord channel for live notifications')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('upload_channel')
                .setDescription('Discord channel for upload notifications')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('custom_live_message')
                .setDescription('Custom message for live notifications (use {channel} as placeholder)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('custom_upload_message')
                .setDescription('Custom message for upload notifications (use {channel} as placeholder)')
                .setRequired(false)),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need Administrator permissions to use this command!', ephemeral: true });
        }

        const youtubeChannel = interaction.options.getString('youtube_channel');
        const liveChannel = interaction.options.getChannel('live_channel');
        const uploadChannel = interaction.options.getChannel('upload_channel');
        const customLiveMessage = interaction.options.getString('custom_live_message') || '@everyone {channel} is Live over at {streamUrl}';
        const customUploadMessage = interaction.options.getString('custom_upload_message') || '@everyone {channel} just uploaded a new video! {url}';

        // Validate YouTube channel URL
        if (!youtubeChannel.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/)) {
            return interaction.reply({
                content: 'Please provide a valid YouTube channel URL (e.g., https://www.youtube.com/@channelname)',
                ephemeral: true
            });
        }

        try {
            // Check if we already have this channel configured
            const settings = await getGuildSettings(interaction.guildId);
            const urls = await normalizeYouTubeUrl(youtubeChannel);

            if (settings && settings.channels) {
                const existingChannel = settings.channels.find(ch => ch.youtubeChannel === urls.main);
                if (existingChannel) {
                    return interaction.reply({
                        content: `This YouTube channel is already being monitored!\n` +
                                `Live notifications are sent to <#${existingChannel.liveChannelId}>\n` +
                                `Upload notifications are sent to <#${existingChannel.uploadChannelId}>`,
                        ephemeral: true
                    });
                }
            }

            const channelData = {
                youtubeChannel: urls.main, // Use the normalized main URL
                liveChannelId: liveChannel.id,
                uploadChannelId: uploadChannel.id,
                customLiveMessage,
                customUploadMessage,
                lastVideoId: null,
                lastLiveStatus: false
            };

            await addChannel(interaction.guildId, channelData);

            await interaction.reply({
                content: 'YouTube channel added successfully!\n' +
                        `Live notifications will be sent to ${liveChannel}\n` +
                        `Upload notifications will be sent to ${uploadChannel}\n` +
                        'I will check for updates every minute.',
                ephemeral: true
            });

            // Run an immediate check after setup
            console.log('Running immediate check after setup...');
            await checkForUpdates(interaction.client);

            console.log(`Added YouTube channel for guild ${interaction.guildId}. Channel: ${urls.main}`);
        } catch (error) {
            console.error('Setup error:', error);
            await interaction.reply({
                content: 'An error occurred while saving the configuration.',
                ephemeral: true
            });
        }
    },
};