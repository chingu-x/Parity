const { ChannelType } = require('discord.js');
const sendChallenges = require('../handlers/challengeHandlers/sendChallenges.js');
const handleChallengeSelection = require('../handlers/challengeHandlers/handleChallengeSelection.js');
const { airtableTableNameSessions, base, STATUS_PENDING, STATUS_IN_SESSION } = require('../handlers/airtable.js');
require('dotenv').config();

const textChannelID = process.env.TEXT_CHANNEL_ID;
const voiceHubID = process.env.VOICE_HUB;

module.exports = {
    async checkForPairs(client) {
        try {
            console.log('Checking for pairs...');
            // Check Airtable for users with the status of 'pending'
            const records = await base(airtableTableNameSessions).select({
                filterByFormula: `{Status} = '${STATUS_PENDING}'`
            }).all();

            console.log(`Found ${records.length} pending users`);

            // Group users by skill level and role
            const usersBySkillLevelAndRole = records.reduce((acc, record) => {
                const skillLevel = record.fields.Difficulty;
                const role = record.fields.Role;
                if (!acc[skillLevel]) {
                    acc[skillLevel] = {};
                }
                if (!acc[skillLevel][role]) {
                    acc[skillLevel][role] = [];
                }
                acc[skillLevel][role].push(record);
                return acc;
            }, {});

            // Check for pairs with the same skill level and role
            for (const skillLevel in usersBySkillLevelAndRole) {
                for (const role in usersBySkillLevelAndRole[skillLevel]) {
                    const users = usersBySkillLevelAndRole[skillLevel][role];
                    if (users.length >= 2) {
                        // Pair the first two users
                        const [user1, user2] = users;

                        console.log(`Pairing users ${user1.fields['Discord Name']} and ${user2.fields['Discord Name']} with skill level ${skillLevel} and role ${role}`);

                        // Get the existing voice channel
                        const guild = client.guilds.cache.first();
                        const voiceChannel = guild.channels.cache.get(voiceHubID);

                        if (!voiceChannel) {
                            console.error('Voice channel not found');
                            return;
                        }

                        // Create a private thread in the specified text channel
                        const textChannel = guild.channels.cache.get(textChannelID);
                        const thread = await textChannel.threads.create({
                            name: `Pair Programming - ${user1.fields['Discord Name']} & ${user2.fields['Discord Name']}`,
                            autoArchiveDuration: 60,
                            type: ChannelType.PrivateThread,
                            invitable: false,
                            reason: 'Pair Programming Session'
                        });

                        // Add users to the private thread
                        await thread.members.add(user1.fields.userID);
                        await thread.members.add(user2.fields.userID);

                        // Send information about the pair programming session in the thread
                        // DO NOT TOUCH THE FORMATING BELOW. I KNOW IT LOOKS BAD, BUT IT WILL NOT RENDER PROPERLY IF YOU CHANGE IT.
                        await thread.send(`
                            # Welcome to your Pair Challenge Session!
                            ### __Participants:__
                            * <@${user1.fields.userID}>
                            * <@${user2.fields.userID}>
### __Instructions__
                            1. Join ${voiceChannel.toString()} to create a voice channel you can use to talk and share your screens while doing the Challenge.
                            2. Look at the list below and discuss what challenge you want to do.
                            3. Select the challenge from the dropdown menu below.
                            ### Good luck! :four_leaf_clover:
                            `);

                        // Update the status of the users in Airtable
                        await base(airtableTableNameSessions).update([
                            { id: user1.id, fields: { Status: STATUS_IN_SESSION } },
                            { id: user2.id, fields: { Status: STATUS_IN_SESSION } }
                        ]);

                        console.log(`Updated status to ${STATUS_IN_SESSION} for users ${user1.fields['Discord Name']} and ${user2.fields['Discord Name']}`);

                        // Pass one of the user IDs to sendChallenges and get the challenges array
                        const challenges = await sendChallenges(thread, user1.fields.userID);

                        // Handle challenge selection interaction
                        client.once('interactionCreate', async interaction => {
                            if (!interaction.isStringSelectMenu()) return;
                            if (interaction.customId === 'select_challenge') {
                                await handleChallengeSelection(interaction, challenges);
                            }
                        });

                    }
                }
            }
        } catch (error) {
            console.error('Failed to check for pairs:', error);
        }
    }
};