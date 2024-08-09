const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config()

const { Client, Collection, GatewayIntentBits } = require('discord.js');
// Create a new client instance
const client = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildVoiceStates
	] 
});
// New collection of commands for the client
client.commands = new Collection()

// For every folder in our 'commands' folder, go through each folder and apply each .js file
const foldersPath = path.join(__dirname, 'commands')
const commandFolders = fs.readdirSync(foldersPath)

// Get every folder in the 'commands' folder
for (const folder of commandFolders) {
	// Get every .js file for each subdirectory under the 'commands' folder
	const commandsPath = path.join(foldersPath, folder)
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file)
		const command = require(filePath)
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command)
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property`)
		}
	}
}

// For every file in the 'events' folder, apply each .js file
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const events = require(filePath);
    if (Array.isArray(events)) {
        for (const event of events) {
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
        }
    } else {
        if (events.once) {
            client.once(events.name, (...args) => events.execute(...args));
        } else {
            client.on(events.name, (...args) => events.execute(...args));
        }
    }
}

client.login(process.env.DISCORD_TOKEN);