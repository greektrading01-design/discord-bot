const token = process.env.TOKEN?.trim();
const {Client, GatewayIntentBits} = require("discord.js");

const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages]});


client.login(token);

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});
