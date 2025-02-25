const { REST, Routes, ActivityType } = require('discord.js');
const config = require('../config');

async function updateBotStatus(client) {
    try {
        console.log('Setting bot status...');
        await client.user.setActivity('Watching YouTube', {
            type: ActivityType.Watching
        });
        console.log('Watching status set successfully');
    } catch (error) {
        console.error('Error updating bot status:', error);
        console.error('Error details:', error.stack);
    }
}

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Logged in as ${client.user.tag}`);

        try {
            // Set initial bot status
            await updateBotStatus(client);

            // Update status periodically
            setInterval(() => updateBotStatus(client), config.checkInterval);

            // Register slash commands globally
            const commands = Array.from(client.commands.values()).map(command => command.data.toJSON());
            const rest = new REST({ version: '10' }).setToken(config.token);

            console.log('Started refreshing application (/) commands.');
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands },
            );
            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error('Error in ready event:', error);
            console.error('Stack trace:', error.stack);
        }
    },
};