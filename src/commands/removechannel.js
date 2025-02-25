const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { removeChannel, getGuildSettings } = require('../utils/database');
const { normalizeYouTubeUrl } = require('../utils/youtube');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removechannel')
        .setDescription('Remove a YouTube channel from notifications')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('youtube_channel')
                .setDescription('The YouTube channel URL to remove')
                .setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You need Administrator permissions to use this command!', ephemeral: true });
        }

        const youtubeChannel = interaction.options.getString('youtube_channel');

        try {
            // Normalize the URL before removing
            const urls = await normalizeYouTubeUrl(youtubeChannel);

            // Get current settings to check if channel exists
            const settings = await getGuildSettings(interaction.guildId);
            if (!settings || !settings.channels || !settings.channels.find(ch => ch.youtubeChannel === urls.main)) {
                return interaction.reply({
                    content: `No notifications were set up for ${youtubeChannel}`,
                    ephemeral: true
                });
            }

            const removed = await removeChannel(interaction.guildId, urls.main);

            if (removed) {
                await interaction.reply({
                    content: `Successfully removed notifications for ${youtubeChannel}`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `Could not remove notifications for ${youtubeChannel}. Please try again.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Remove channel error:', error);
            await interaction.reply({
                content: 'An error occurred while removing the channel.',
                ephemeral: true
            });
        }
    },
};