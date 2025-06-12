import { Client } from "discord.js-selfbot-v13";
import { configDotenv } from "dotenv";
configDotenv();

const client = new Client();

client.on("ready", () => {
    console.log(`Logged in as ${client.user!.username}`);
});

client.login(process.env["DISCORD_TOKEN"]);