const token = process.env.token?.trim();
const {Client, GatewayIntentBits} = require("discord.js");

const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages]});


client.login(token);