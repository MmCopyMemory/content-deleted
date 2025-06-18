import { 
    Client, 
    //DMChannel, 
    Message, 
    type ChannelLogsQueryOptions, 
    type Snowflake, 
    type AnyChannel 
} from "discord.js-selfbot-v13";
import { configDotenv } from "dotenv";
import JSON5 from "json5";
import assert from "node:assert";
import fs from "node:fs";

configDotenv();

interface Config {
    exclusion_mode: "whitelist" | "blacklist";
    excluded_guilds: Snowflake[];
    excluded_dms: Snowflake[];
    excluded_channels: Snowflake[];
    safe_mode: boolean;
    delete_range: string;
}

const CONFIG_FILE = "config.json";

let excludedGuilds = new Set<Snowflake>();
let excludedDMs = new Set<Snowflake>();
let excludedChannels = new Set<Snowflake>();
let mode: Config["exclusion_mode"] = "blacklist";
let safeMode = false;
let deleteRange = "all";
let timeCutoff: number | null = null;

function loadConfig() {
    assert(fs.existsSync(CONFIG_FILE));
    const file = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed: Config = JSON5.parse(file);

    assert(["whitelist", "blacklist"].includes(parsed.exclusion_mode));
    assert(Array.isArray(parsed.excluded_guilds));
    assert(Array.isArray(parsed.excluded_dms));
    assert(Array.isArray(parsed.excluded_channels));
    assert(typeof parsed.safe_mode === "boolean");
    assert(typeof parsed.delete_range === "string");

    excludedGuilds = new Set(parsed.excluded_guilds);
    excludedDMs = new Set(parsed.excluded_dms);
    excludedChannels = new Set(parsed.excluded_channels);
    safeMode = parsed.safe_mode;
    mode = parsed.exclusion_mode;
    deleteRange = parsed.delete_range ?? "all";

    if (deleteRange === "all") {
        timeCutoff = null;
    } else {
        const match = /^(\d+)([hdwmy])$/.exec(deleteRange);
        if (!match) throw new Error("Invalid deletion range in config.json");

        const multipliers = {
            h: 3600000,
            d: 86400000,
            w: 7 * 86400000,
            m: 30 * 86400000,
            y: 365 * 86400000,
        };

        type Unit = keyof typeof multipliers;
        const unit = match[2]! as Unit;
        const multiplier = multipliers[unit as keyof typeof multipliers];

        if (multiplier === undefined) {
            throw new Error(`Invalid multiplier for unit '${unit}'`);
        } //Thanks for nothing typescript.

        timeCutoff = Date.now() - parseInt(match[1]!, 10) * multiplier;
    }
}

function timeout(ms: number) {
    return new Promise(res => setTimeout(res, ms));
}

function shouldWipe(id: Snowflake, list: Set<Snowflake>) {
    return mode === "whitelist" ? list.has(id) : !list.has(id);
}

async function nuke(channels: Iterable<AnyChannel>, types: Set<string>, cutoff: number | null = null) {
    for (const channel of channels) {
        if (!channel.isText()) continue;
        if (!types.has(channel.type)) continue;

        switch (channel.type) {
            case "GUILD_TEXT":
            case "GUILD_NEWS": {
                const guildId = channel.guild.id;
                if (!shouldWipe(guildId, excludedGuilds)) continue;
                if (!shouldWipe(channel.id, excludedChannels)) continue;
                break;
            }
            case "DM": {
                const recipientId = channel.recipient?.id;
                if (!recipientId || !shouldWipe(recipientId, excludedDMs)) continue;
                break;
            }
            case "GROUP_DM": {
                if (!shouldWipe(channel.id, excludedChannels)) continue;
                break;
            }
            default:
                continue;
        }

        try {
            let lastMessageId: string | undefined;

            while (true) {
                const fetchOptions: ChannelLogsQueryOptions = {
                    limit: 100,
                    before: lastMessageId,
                };

                const fetched = await channel.messages.fetch(fetchOptions);
                if (fetched.size === 0) break;

                const userMessages = fetched.filter(m =>
                    m.author.id === client.user!.id && (cutoff === null || m.createdTimestamp >= cutoff)
                );

                for (const msg of userMessages.values()) {
                    await msg.delete();
                    if (safeMode) await timeout(1000);
                }

                lastMessageId = fetched.last()?.id;
                if (!lastMessageId) break;
            }
        } catch (excp) {
            throw new Error("Exception: " + excp);
        }
    }
}

const client = new Client();

client.on("messageCreate", async (message: Message) => {
    if (message.author.id !== client.user!.id) return;
    if (!message.content.toLowerCase().startsWith("!nuke")) return;

    for (const guild of client.guilds.cache.values()) {
        if (!shouldWipe(guild.id, excludedGuilds)) continue;
        nuke(guild.channels.cache.values(), new Set(["GUILD_TEXT"]), timeCutoff);
    }

    nuke(client.channels.cache.values(), new Set(["DM", "GROUP_DM"]), timeCutoff);
});

loadConfig();
client.login(process.env["DISCORD_TOKEN"]);
