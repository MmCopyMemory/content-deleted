import { Client, Collection, DMChannel, TextChannel, Message } from "discord.js-selfbot-v13";
import { configDotenv } from "dotenv";
configDotenv();

/*
GUILD EXCLUSION ->
GUILD_ID , CHANNEL_ID

DM EXCLUSION ->
USER_ID
*/

const GUILD_EXCLUDE = [
    ["992106461775798322", "992106461775798325"],
];
const DM_EXCLUDE = [
    "1365788302027919430",
];

const client = new Client();

client.on("ready", () => {
    console.log(`Logged in as ${client.user!.username}`);
});

client.on("messageCreate", async (message: Message) => {
    if (message.author.id !== client.user?.id) return;

    if (message.content.toLowerCase().startsWith("!nuke")) {
        const excludedGuilds = new Set(
            GUILD_EXCLUDE.filter(([_, c]) => c === "0").map(([g]) => g)
        );
        
        const excludedChannels = new Set(
            GUILD_EXCLUDE.filter(([_, c]) => c !== "0").map(([g, c]) => `${g}_${c}`)
        );
        
        for (const guild of client.guilds.cache.values()) {
            if (excludedGuilds.has(guild.id)) continue;
            
            for (const channel of guild.channels.cache.values()) {
                if (channel.type !== "GUILD_TEXT") continue;

                const key = `${guild.id}_${channel.id}`;
                if (excludedChannels.has(key)) continue;

                try {
                    let lastMessageId: string | undefined = undefined;
                    while (true) {
                        const fetchOptions: { limit: number; before?: string } = { limit: 100 }; // discords limit :( currently "bypassing" by refetching until no more return
                        if (lastMessageId) fetchOptions.before = lastMessageId;

                        const fetched: Collection<string, Message> = await (channel as TextChannel).messages.fetch(fetchOptions);

                        if (fetched.size === 0) break;

                        const userMessages = fetched.filter((m: Message) => m.author.id === client.user?.id);

                        for (const msg of userMessages.values()) {
                            await msg.delete();
                            if (SafeMode) await new Promise(res => setTimeout(res, 1000));
                        }

                        lastMessageId = fetched.last()?.id;
                        if (!lastMessageId) break;
                    }
                } catch {
                    // ...
                }
            }
        }
        
        for (const channel of client.channels.cache.values()) {
            if (channel.type !== "GROUP_DM" && channel.type !== "DM") continue;

            const dmChannel = channel as DMChannel;

            if (DM_EXCLUDE.includes(dmChannel.recipient?.id ?? "")) continue;

            try {
                let lastMessageId: string | undefined = undefined;
                while (true) {
                    const fetchOptions: { limit: number; before?: string } = { limit: 100 };
                    if (lastMessageId) fetchOptions.before = lastMessageId;

                    const fetched: Collection<string, Message> = await dmChannel.messages.fetch(fetchOptions);

                    if (fetched.size === 0) break;

                    const userMessages = fetched.filter((m: Message) => m.author.id === client.user?.id);

                    for (const msg of userMessages.values()) {
                        await msg.delete();
                        if (SafeMode) await new Promise(res => setTimeout(res, 1000));
                    }

                    lastMessageId = fetched.last()?.id;
                    if (!lastMessageId) break;
                }
            } catch {
                // ...
            }
        }
    }
});

client.login(process.env["DISCORD_TOKEN"]);
