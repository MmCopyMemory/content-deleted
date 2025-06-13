import { Client, DMChannel, TextChannel, Message, type ChannelLogsQueryOptions, type Snowflake, Channel, type AnyChannel } from "discord.js-selfbot-v13";
import { configDotenv } from "dotenv";
configDotenv();

/*
GUILD EXCLUSION ->
GUILD_ID , CHANNEL_ID

DM EXCLUSION ->
USER_ID
*/

const EXCLUDED_GUILDS = new Set<Snowflake>([]);
const EXCLUDED_DMS = new Set<Snowflake>([]);
const EXCLUDED_CHANNELS = new Set<Snowflake>([]);

const SAFE_MODE = true;

const client = new Client();

client.on("ready", () => {
    console.log(`Logged in as ${client.user!.username}`);
});

function timeout(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

function isDM(channel: AnyChannel): channel is DMChannel {
    return channel.type === "DM" || channel.type === "GROUP_DM";
}

async function nuke(channels: Iterable<AnyChannel>, types: Set<String>) {
    for (const channel of channels) {
        if (!channel.isText()) continue;
        if (!types.has(channel.type)) continue;
        if (EXCLUDED_CHANNELS.has(channel.id)) continue;
        if (EXCLUDED_DMS.has(channel.id)) continue;
        if (isDM(channel) && EXCLUDED_DMS.has(channel.recipient?.id ?? "")) continue;

        try {
            let lastMessageId: string | undefined = undefined;
            while (true) {
                // discords limit :( currently "bypassing" by refetching until no more return
                const fetchOptions: ChannelLogsQueryOptions = {
                    limit: 100,
                    before: lastMessageId
                };

                const fetched = await channel.messages.fetch(fetchOptions);
                if (fetched.size === 0) break;
                const userMessages = fetched.filter((m: Message) => m.author.id === client.user?.id);

                for (const msg of userMessages.values()) {
                    await msg.delete();
                    if (SAFE_MODE) await timeout(1000);
                }

                lastMessageId = fetched.last()?.id;
                if (!lastMessageId) break;
            }
        } catch {
            // handle this later
        }
    }
}

client.on("messageCreate", async (message: Message) => {
    if (message.author.id !== client.user?.id) return;
    if (!message.content.toLowerCase().startsWith("!nuke")) return;

    const excludedGuilds = new Set(EXCLUDED_GUILDS);
    
    for (const guild of client.guilds.cache.values()) {
        if (excludedGuilds.has(guild.id)) continue;
        nuke(guild.channels.cache.values(), new Set(["GUILD_TEXT"]));
    }
    
    nuke(client.channels.cache.values(), new Set(["DM", "GROUP_DM"]))
});

client.login(process.env["DISCORD_TOKEN"]);
