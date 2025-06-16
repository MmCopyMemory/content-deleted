import { Client, DMChannel, Message, type ChannelLogsQueryOptions, type Snowflake, type AnyChannel } from "discord.js-selfbot-v13";
import { configDotenv } from "dotenv";
import JSON5 from "json5";
import assert from "node:assert";
import fs from "node:fs"

configDotenv();

interface Config {
    exclusion_mode: "whitelist" | "blacklist";
    excluded_guilds: Snowflake[];
    excluded_dms: Snowflake[];
    excluded_channels: Snowflake[];

    safe_mode: boolean;
}

const CONFIG_FILE = "config.json";

let excludedGuilds = new Set<Snowflake>();
let excludedDMs = new Set<Snowflake>();
let excludedChannels = new Set<Snowflake>();
let mode: Config["exclusion_mode"] = "blacklist";
let safeMode = false;

function loadConfig() {
    assert(fs.existsSync(CONFIG_FILE));

    const file = fs.readFileSync(CONFIG_FILE);
    const parsed: Config = JSON5.parse(file.toString());
    assert(typeof parsed.excluded_guilds === "object");
    assert(typeof parsed.excluded_dms === "object");
    assert(typeof parsed.excluded_channels === "object");
    assert(typeof parsed.safe_mode === "boolean");
    assert(["whitelist", "blacklist"].includes(parsed.exclusion_mode));

    excludedGuilds = new Set(parsed.excluded_guilds);
    excludedDMs = new Set(parsed.excluded_dms);
    excludedChannels = new Set(parsed.excluded_channels);
    safeMode = parsed.safe_mode;
    mode = parsed.exclusion_mode;
}

function timeout(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

function isDM(channel: AnyChannel): channel is DMChannel {
    return channel.type === "DM" || channel.type === "GROUP_DM";
}

function shouldWipe(id: Snowflake, list: Set<Snowflake>) {
    if (mode === "whitelist")
        return list.has(id);
    else
        return !list.has(id);
}

async function nuke(channels: Iterable<AnyChannel>, types: Set<String>) {
    for (const channel of channels) {
        if (!channel.isText()) continue;
        if (!types.has(channel.type)) continue;
        const channelId = channel.id;
        if (channel.type === "GUILD_TEXT" || channel.type === "GUILD_NEWS") {
            const guildId = channel.guild.id;
            if (!shouldWipe(guildId, excludedGuilds)) continue;
            if (!shouldWipe(channelId, excludedChannels)) continue;
        } else if (isDM(channel)) {
            const recipientId = channel.recipient?.id;
            if (!recipientId || !shouldWipe(recipientId, excludedDMs)) continue;
        }
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
                const userMessages = fetched.filter((m: Message) => m.author.id === client.user!.id);

                for (const msg of userMessages.values()) {
                    await msg.delete();
                    if (safeMode) await timeout(1000);
                }

                lastMessageId = fetched.last()?.id;
                if (!lastMessageId) break;
            }
        } catch {
            // handle this later
        }
    }
}

const client = new Client();

client.on("messageCreate", async (message: Message) => {
    if (message.author.id !== client.user!.id) return;
    if (!message.content.toLowerCase().startsWith("!nuke")) return;

    for (const guild of client.guilds.cache.values()) {
        if (!shouldWipe(guild.id, excludedGuilds)) continue;
        nuke(guild.channels.cache.values(), new Set(["GUILD_TEXT"]));
    }
    
    nuke(client.channels.cache.values(), new Set(["DM", "GROUP_DM"]));
});

loadConfig();
client.login(process.env["DISCORD_TOKEN"]);
