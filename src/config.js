require('dotenv').config();

// Configuration for the Discord bot
const config = {
    // Discord bot token
    token: process.env.TOKEN,

    // Bot owner's YouTube channel URL
    ownerChannel: process.env.YOUTUBE_CHANNEL_URL,

    // Check interval for YouTube updates (in milliseconds)
    checkInterval: parseInt(process.env.CHECK_INTERVAL || '60000', 10), // Default: 1 minute

    // Default notification messages
    defaultMessages: {
        live: '@everyone {channel} is Live over at {streamUrl}',
        upload: '@everyone {channel} just uploaded a new video! {url}'
    }
};

module.exports = config;