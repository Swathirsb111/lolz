require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { QuickDB } = require('quick.db');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Add detailed startup logging
console.log('Starting bot with configuration:', {
    checkInterval: config.checkInterval,
    hasToken: !!config.token,
    hasOwnerChannel: !!config.ownerChannel,
    defaultMessages: config.defaultMessages
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.commands = new Collection();
client.db = new QuickDB();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Start YouTube check interval with detailed logging
const { checkForUpdates } = require('./utils/checkUpdates');
console.log(`Setting up check interval for every ${config.checkInterval}ms`);
setInterval(() => {
    console.log('Running scheduled YouTube check...');
    checkForUpdates(client);
}, config.checkInterval);

client.login(config.token);