const { getYouTubeChannelInfo, normalizeYouTubeUrl } = require('./youtube');
const { getGuildSettings, updateLastVideoId, updateLiveStatus } = require('./database');
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

async function checkForUpdates(client) {
    console.log('Starting YouTube updates check...');
    const guilds = client.guilds.cache;

    // Keep a simple status
    await client.user.setActivity('Watching YouTube', {
        type: 3 // ActivityType.Watching
    });

    for (const [guildId, guild] of guilds) {
        console.log(`Checking guild ${guildId}`);
        const settings = await getGuildSettings(guildId);

        if (!settings || !settings.channels || settings.channels.length === 0) {
            console.log(`No channels configured for guild ${guildId}`);
            continue;
        }

        console.log(`Found ${settings.channels.length} channels to check in guild ${guildId}`);

        for (const channelSettings of settings.channels) {
            console.log(`\nChecking channel: ${channelSettings.youtubeChannel}`);
            console.log('Previous status:', {
                isLive: channelSettings.lastLiveStatus,
                lastVideo: channelSettings.lastVideoId,
                lastUpdate: channelSettings.lastStatusUpdate,
                lastNotification: channelSettings.lastNotificationSent
            });

            try {
                const channelInfo = await getYouTubeChannelInfo(channelSettings.youtubeChannel);
                const urls = await normalizeYouTubeUrl(channelSettings.youtubeChannel);

                if (!channelInfo) {
                    console.log(`Failed to fetch info for ${channelSettings.youtubeChannel}`);
                    continue;
                }

                console.log('Current status:', {
                    isLive: channelInfo.isLive,
                    latestVideo: channelInfo.latestVideoId,
                    detectedBy: channelInfo.detectedBy
                });

                // Check for live status changes
                const statusChanged = await updateLiveStatus(guildId, channelSettings.youtubeChannel, channelInfo.isLive);

                if (statusChanged && channelInfo.isLive) {
                    console.log('Live status changed to true, sending notification');
                    const liveChannel = guild.channels.cache.get(channelSettings.liveChannelId);

                    if (!liveChannel) {
                        console.error(`Could not find Discord channel ${channelSettings.liveChannelId}`);
                        continue;
                    }

                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('🔴 Live Stream Started!')
                        .setDescription(`[Click here to watch](${urls.stream})`)
                        .setTimestamp();

                    try {
                        // Get channel name from the URL
                        const channelName = urls.main.split('@').pop().split('/')[0];
                        const liveMessage = `@everyone ${channelName} is Live over at ${urls.stream}`;
                        console.log('Live notification details:', {
                            channelName,
                            streamUrl: urls.stream,
                            fullMessage: liveMessage
                        });

                        await liveChannel.send({
                            content: liveMessage,
                            embeds: [embed]
                        });
                        console.log('Live notification sent successfully');
                    } catch (error) {
                        console.error('Failed to send live notification:', error);
                    }
                } else if (channelInfo.isLive) {
                    console.log('Channel is still live, skipping notification');
                } else {
                    console.log('Channel is not live');
                }

                // Only check for new uploads if the channel is not live
                if (!channelInfo.isLive &&
                    channelInfo.latestVideoId &&
                    channelInfo.latestVideoId !== channelSettings.lastVideoId) {
                    console.log(`New video detected: ${channelInfo.latestVideoId}`);
                    const uploadChannel = guild.channels.cache.get(channelSettings.uploadChannelId);

                    if (!uploadChannel) {
                        console.error(`Could not find Discord channel ${channelSettings.uploadChannelId}`);
                        continue;
                    }

                    const videoUrl = `https://www.youtube.com/watch?v=${channelInfo.latestVideoId}`;
                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('📺 New Video Upload!')
                        .setDescription(`[Click here to watch](${videoUrl})`)
                        .setTimestamp();

                    try {
                        // Get channel name from the URL
                        const channelName = urls.main.split('@').pop().split('/')[0];
                        const uploadMessage = `@everyone ${channelName} just uploaded a new video! ${videoUrl}`;
                        console.log('Upload notification details:', {
                            channelName,
                            videoUrl,
                            fullMessage: uploadMessage
                        });

                        await uploadChannel.send({
                            content: uploadMessage,
                            embeds: [embed]
                        });
                        console.log('Upload notification sent successfully');
                        await updateLastVideoId(guildId, channelSettings.youtubeChannel, channelInfo.latestVideoId);
                    } catch (error) {
                        console.error('Failed to send upload notification:', error);
                    }
                }
            } catch (error) {
                console.error(`Error processing channel ${channelSettings.youtubeChannel}:`, error);
            }
        }
    }
}

module.exports = { checkForUpdates };