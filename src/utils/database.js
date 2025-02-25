const { QuickDB } = require('quick.db');
const db = new QuickDB();

async function getGuildSettings(guildId) {
    console.log(`Fetching settings for guild ${guildId}`);
    const settings = await db.get(`guild_${guildId}`);
    if (settings && !Array.isArray(settings.channels)) {
        // Migrate existing single-channel setup to new format
        const channels = [{
            youtubeChannel: settings.youtubeChannel,
            liveChannelId: settings.liveChannelId,
            uploadChannelId: settings.uploadChannelId,
            customLiveMessage: settings.customLiveMessage,
            customUploadMessage: settings.customUploadMessage,
            lastVideoId: settings.lastVideoId,
            lastLiveStatus: settings.lastLiveStatus,
            lastStatusUpdate: new Date().toISOString(), // Add timestamp for status changes
            lastNotificationSent: null // Track when the last notification was sent
        }];
        await db.set(`guild_${guildId}`, { channels });
        console.log('Migrated single-channel setup to multi-channel format');
        return { channels };
    }
    console.log(`Found ${settings?.channels?.length || 0} channels for guild ${guildId}`);
    return settings;
}

async function updateLastVideoId(guildId, channelUrl, videoId) {
    console.log(`Updating last video ID for guild ${guildId}, channel ${channelUrl} to ${videoId}`);
    const settings = await getGuildSettings(guildId);
    if (settings) {
        const channel = settings.channels.find(c => c.youtubeChannel === channelUrl);
        if (channel) {
            channel.lastVideoId = videoId;
            await db.set(`guild_${guildId}`, settings);
            console.log('Last video ID updated successfully');
            return true;
        }
    }
    return false;
}

async function updateLiveStatus(guildId, channelUrl, isLive) {
    console.log(`Updating live status for guild ${guildId}, channel ${channelUrl} to ${isLive}`);
    const settings = await getGuildSettings(guildId);
    if (settings) {
        const channel = settings.channels.find(c => c.youtubeChannel === channelUrl);
        if (channel) {
            // Only update if status actually changed
            if (channel.lastLiveStatus !== isLive) {
                console.log(`Status changed from ${channel.lastLiveStatus} to ${isLive}`);
                const now = new Date().toISOString();

                // Update all relevant timestamps
                channel.lastLiveStatus = isLive;
                channel.lastStatusUpdate = now;
                channel.lastNotificationSent = now;

                await db.set(`guild_${guildId}`, settings);
                console.log('Live status updated successfully with timestamps:', {
                    lastStatusUpdate: channel.lastStatusUpdate,
                    lastNotificationSent: channel.lastNotificationSent
                });
                return true; // Status changed
            } else {
                console.log('Status unchanged, checking notification cooldown');
                const lastNotification = new Date(channel.lastNotificationSent || 0);
                const now = new Date();
                const timeSinceLastNotification = now - lastNotification;

                // Minimum 5 minute cooldown between notifications for the same status
                const cooldownPeriod = 5 * 60 * 1000; // 5 minutes in milliseconds

                // Log the time since last notification
                console.log('Time since last notification:', {
                    minutes: Math.floor(timeSinceLastNotification / 60000),
                    seconds: Math.floor((timeSinceLastNotification % 60000) / 1000),
                    cooldownPassed: timeSinceLastNotification >= cooldownPeriod
                });

                return false; // Status unchanged
            }
        }
    }
    return false;
}

async function addChannel(guildId, channelData) {
    console.log(`Adding channel to guild ${guildId}:`, channelData);
    let settings = await getGuildSettings(guildId);
    if (!settings) {
        settings = { channels: [] };
    }

    // Ensure the channel data has all required fields
    channelData = {
        ...channelData,
        lastStatusUpdate: new Date().toISOString(),
        lastNotificationSent: null
    };

    const existingChannelIndex = settings.channels.findIndex(
        c => c.youtubeChannel === channelData.youtubeChannel
    );

    if (existingChannelIndex !== -1) {
        console.log(`Updating existing channel at index ${existingChannelIndex}`);
        settings.channels[existingChannelIndex] = channelData;
    } else {
        console.log('Adding new channel to the list');
        settings.channels.push(channelData);
    }

    await db.set(`guild_${guildId}`, settings);
    console.log(`Guild now has ${settings.channels.length} channels configured`);
    return settings;
}

async function removeChannel(guildId, youtubeChannel) {
    console.log(`Removing channel ${youtubeChannel} from guild ${guildId}`);
    const settings = await getGuildSettings(guildId);
    if (settings) {
        const initialCount = settings.channels.length;
        settings.channels = settings.channels.filter(c => c.youtubeChannel !== youtubeChannel);
        await db.set(`guild_${guildId}`, settings);
        const removed = initialCount > settings.channels.length;
        console.log(`Channel removal ${removed ? 'successful' : 'failed'}. Remaining channels: ${settings.channels.length}`);
        return removed;
    }
    return false;
}

module.exports = {
    getGuildSettings,
    updateLastVideoId,
    updateLiveStatus,
    addChannel,
    removeChannel
};