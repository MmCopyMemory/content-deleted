import {
    Client,
    type ChannelLogsQueryOptions,
    type Snowflake,
    type AnyChannel
} from "discord.js-selfbot-v13";

interface Config {
    token: string;
    exclusionMode: "whitelist" | "blacklist";
    excludedGuilds: Snowflake[];
    excludedDms: Snowflake[];
    excludedChannels: Snowflake[];
    safeMode: boolean;
    deleteRange: string;
}

class ContentDeleter {
    private client: Client | null = null;
    private timeCutoff: number | null = null;
    private isRunning = false;
    private onProgress: (message: string) => void = () => {};
    private ws: any = null;
    private LogProg(message: string) {
        try {
            if (this.ws?.readyState === 1) {
                this.ws.send(JSON.stringify({ type: 'success', message }));
            }
        } catch (err) {
            console.warn("Websocket log error :( ", err);
        }
        this.onProgress(message);
    }

    constructor(onProgress?: (message: string) => void, ws?: any) {
        if (onProgress) this.LogProg = onProgress;
        if (ws) this.ws = ws;
    }
    private calculateTimeCutoff(deleteRange: string): number | null {
        if (deleteRange === "all") return null;

        const match = /^(\d+)([hdwmy])$/.exec(deleteRange);
        if (!match) throw new Error("Invalid deletion range");

        const multipliers = {
            h: 3600000,
            d: 86400000,
            w: 7 * 86400000,
            m: 30 * 86400000,
            y: 365 * 86400000,
        };

        const unit = match[2]! as keyof typeof multipliers;
        const multiplier = multipliers[unit];
        return Date.now() - parseInt(match[1]!, 10) * multiplier;
    }

    private shouldWipe(id: Snowflake, list: Snowflake[], mode: Config["exclusionMode"]): boolean {
        return mode === "whitelist" ? list.includes(id) : !list.includes(id);
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async handlechannel(channel: AnyChannel, types: Set<string>, config: Config): Promise<number> {
        if (!channel.isText()) return 0;
        if (!types.has(channel.type)) return 0;

        switch (channel.type) {
            case "GUILD_TEXT":
            case "GUILD_NEWS": {
                const guildId = channel.guild.id;
                if (!this.shouldWipe(guildId, config.excludedGuilds, config.exclusionMode)) return 0;
                if (!this.shouldWipe(channel.id, config.excludedChannels, config.exclusionMode)) return 0;
                if (!channel.viewable) return 0;
                break;
            }
            case "DM": {
                const recipientId = channel.recipient?.id;
                if (!recipientId || !this.shouldWipe(recipientId, config.excludedDms, config.exclusionMode)) return 0;
                break;
            }
            case "GROUP_DM": {
                if (!this.shouldWipe(channel.id, config.excludedChannels, config.exclusionMode)) return 0;
                break;
            }
            default:
                return 0;
        }

        let deletedCount = 0;
        let lastMessageId: string | undefined;

        try {
            while (true) {
                const fetchOptions: ChannelLogsQueryOptions = {
                    limit: 100,
                    before: lastMessageId,
                };

                const fetched = await channel.messages.fetch(fetchOptions);
                if (fetched.size === 0) break;

                const userMessages = fetched.filter(m =>
                    m.author.id === this.client!.user!.id && 
                    (this.timeCutoff === null || m.createdTimestamp >= this.timeCutoff)
                );

                for (const msg of userMessages.values()) {
                    try {
                        await msg.delete();
                        deletedCount++;
                        if (config.safeMode) await this.sleep(1000);
                    } catch (e) {
                        console.error("Failed to delete message:", e);
                    }
                }

                lastMessageId = fetched.last()?.id;
                if (!lastMessageId) break;

                if (deletedCount > 0) {
                    const channelName = channel.type === "DM" ? "DM" : 
                                      channel.type === "GROUP_DM" ? "Group DM" : 
                                      (channel as any).name || "Unknown";
                    this.LogProg(`Deleted ${deletedCount} messages from ${channelName}`);
                }
            }
        } catch (error) {
            console.error("Error deleting messages:", error);
        }

        return deletedCount;
    }

    async start(config: Config): Promise<{ success: boolean; message: string; totalDeleted: number }> {
        if (this.isRunning) {
            return { success: false, message: "Already running", totalDeleted: 0 };
        }

        this.isRunning = true;
        this.timeCutoff = this.calculateTimeCutoff(config.deleteRange);
        let totalDeleted = 0;

        try {
            this.client = new Client();
            
            await new Promise<void>((resolve, reject) => {
                this.client!.once("ready", () => resolve());
                this.client!.once("error", reject);
                this.client!.login(config.token);
            });

            this.LogProg("Connected! Started");

            for (const guild of this.client.guilds.cache.values()) {
                if (!this.shouldWipe(guild.id, config.excludedGuilds, config.exclusionMode)) continue;
                
                for (const channel of guild.channels.cache.values()) {
                    const deleted = await this.handlechannel(channel, new Set(["GUILD_TEXT", "GUILD_NEWS"]), config);
                    totalDeleted += deleted;
                }
            }

            for (const channel of this.client.channels.cache.values()) {
                const deleted = await this.handlechannel(channel, new Set(["DM", "GROUP_DM"]), config);
                totalDeleted += deleted;
            }

            this.client.destroy();
            return { success: true, message: `Completed! Deleted ${totalDeleted} messages`, totalDeleted };

        } catch (error) {
            if (this.client) this.client.destroy();
            return { success: false, message: `Error: ${error}`, totalDeleted };
        } finally {
            this.isRunning = false;
        }
    }

    stop() {
        if (this.client) {
            this.client.destroy();
            this.isRunning = false;
        }
    }
}

const frontendism = `
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Content Deleted</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0a;
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .container {
            background: #1a1a1a;
            border-radius: 12px;
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            border: 1px solid #333;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        h1 {
            text-align: center;
            margin-bottom: 2rem;
            color: #ff4444;
            font-weight: 600;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #ccc;
        }

        input, select, textarea {
            width: 100%;
            padding: 0.75rem;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 6px;
            color: #fff;
            font-size: 14px;
        }

        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #ff4444;
        }

        textarea {
            resize: vertical;
            min-height: 80px;
            font-family: monospace;
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        input[type="checkbox"] {
            width: auto;
        }

        button {
            width: 100%;
            padding: 1rem;
            background: #ff4444;
            border: none;
            border-radius: 6px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }

        button:hover {
            background: #ff3333;
        }

        button:disabled {
            background: #666;
            cursor: not-allowed;
        }

        .status {
            margin-top: 1rem;
            padding: 1rem;
            border-radius: 6px;
            display: none;
        }

        .status.success {
            background: #1a4d1a;
            border: 1px solid #4d9c4d;
        }

        .status.error {
            background: #4d1a1a;
            border: 1px solid #9c4d4d;
        }

        .warning {
            background: #4d3d1a;
            border: 1px solid #9c8d4d;
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 1.5rem;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Content Deleted</h1>

        <form id="cdForm">
            <div class="form-group">
                <label for="token">Discord Token</label>
                <input type="password" id="token" placeholder="Your Discord token" required>
            </div>

            <div class="form-group">
                <label for="exclusionMode">Exclusion Mode</label>
                <select id="exclusionMode">
                    <option value="blacklist">Blacklist (delete everywhere except excluded)</option>
                    <option value="whitelist">Whitelist (only delete in excluded)</option>
                </select>
            </div>

            <div class="form-group">
                <label for="excludedGuilds">Excluded Guild IDs (one per line)</label>
                <textarea id="excludedGuilds" placeholder="123456789123456789"></textarea>
            </div>

            <div class="form-group">
                <label for="excludedChannels">Excluded Channel IDs (one per line)</label>
                <textarea id="excludedChannels" placeholder="123456789123456789"></textarea>
            </div>

            <div class="form-group">
                <label for="excludedDms">Excluded DM User IDs (one per line)</label>
                <textarea id="excludedDms" placeholder="123456789123456789"></textarea>
            </div>

            <div class="form-group">
                <label for="deleteRange">Delete Range</label>
                <select id="deleteRange">
                    <option value="all">All messages</option>
                    <option value="24h">Last 24 hours</option>
                    <option value="1w">Last week</option>
                    <option value="1m">Last month</option>
                    <option value="3m">Last 3 months</option>
                    <option value="6m">Last 6 months</option>
                    <option value="1y">Last year</option>
                </select>
            </div>

            <div class="form-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="safeMode">
                    <label for="safeMode">Safe Mode (adds delay to prevent rate limit)</label>
                </div>
            </div>

            <button type="submit" id="startBtn">Start Deletion</button>
        </form>

        <div id="status" class="status"></div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:3001');
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            showStatus(data.message, data.type);
        };

        function parseIds(text) {
            return text.split('\\n')
                .map(line => line.trim())
                .filter(line => line && /^\\d+$/.test(line));
        }

        function showStatus(message, type = 'success') {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = \`status \${type}\`;
            status.style.display = 'block';
        }

        document.getElementById('cdForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const startBtn = document.getElementById('startBtn');
            startBtn.disabled = true;
            startBtn.textContent = 'Starting...';

            const config = {
                token: document.getElementById('token').value,
                exclusionMode: document.getElementById('exclusionMode').value,
                excludedGuilds: parseIds(document.getElementById('excludedGuilds').value),
                excludedChannels: parseIds(document.getElementById('excludedChannels').value),
                excludedDms: parseIds(document.getElementById('excludedDms').value),
                deleteRange: document.getElementById('deleteRange').value,
                safeMode: document.getElementById('safeMode').checked
            };

            try {
                const response = await fetch('/deletecontent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });

                const result = await response.json();
                showStatus(result.message, result.success ? 'success' : 'error');
            } catch (error) {
                showStatus(\`Error: \${error.message}\`, 'error');
            } finally {
                startBtn.disabled = false;
                startBtn.textContent = 'Start Deletion';
            }
        });
    </script>
</body>
</html>`;

let CurrentCD: ContentDeleter | null = null;

Bun.serve({
    port: 3000,
    async fetch(req) {
        const url = new URL(req.url);
        
        if (url.pathname === "/") {
            return new Response(frontendism, {
                headers: { "Content-Type": "text/html" }
            });
        }
        
        if (url.pathname === "/deletecontent" && req.method === "POST") {
            if (CurrentCD) {
                return Response.json({ success: false, message: "Already running" });
            }
            try {
                const config = await req.json() as Config;
                CurrentCD = new ContentDeleter();
                const result = await CurrentCD.start(config);
                CurrentCD = null;
                return Response.json(result);
            } catch (error) {
                CurrentCD = null;
                return Response.json({ success: false, message: `Error: ${error}`, totalDeleted: 0 });
            }
        }

        return new Response("Not Found", { status: 404 });
    },
    websocket: {
        message() {},
            open(ws) {
            console.log("WebSocket opened");
            if (CurrentCD) {
                CurrentCD = new ContentDeleter((message) => {
                    if (ws.readyState === 1) {
                        ws.send(JSON.stringify({ type: 'success', message }));
                    }
                }, ws);
            }
        },
        close() {
            console.log("WebSocket closed");
        }
    }
});

Bun.serve({
    port: 3001,
    fetch(req, server) {
        if (server.upgrade(req)) {
            return;
        }
        return new Response("Upgrade failed", { status: 500 });
    },
    websocket: {
        message() {},
        open(ws) {
            if (CurrentCD) {
                CurrentCD = new ContentDeleter((message) => {
                    ws.send(JSON.stringify({ type: 'success', message }));
                });
            }
        },
        close() {}
    }
});

console.log(`WebUI running at port 3000 and websocket at 3001!`);
console.log(`Open http://127.0.0.1:3000 in ur browser!`);
if (process.platform === "win32") {
    Bun.spawn(["cmd","/c","start","http://127.0.0.1:3000"]);
}
