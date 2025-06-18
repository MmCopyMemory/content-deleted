# 🧨 Content Deleted

Content Deleted is a Discord message deletion tool that deletes **every message you've ever sent**, with support for excluding specific servers, channels, and DMs. Inspired by tools like [redact.dev](https://redact.dev), but open-source.

> ⚠️ Use at your own risk. This tool may violate Discord’s Terms of Service.

---

## 📦 Installation

1. **Install [Bun](https://bun.sh/)**  
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Clone this repo**
   ```bash
   git clone https://github.com/MmCopyMemory/content-deleted.git
   cd content-deleted
   ```

3. **Create `config.json`**

   Edit `config.json` file with the following format:

   ```json
   {
     "exclusion_mode": "blacklist",
     "excluded_guilds": ["123456789123456789","123456789123456789"],
     "excluded_channels": ["123456789123456789"],
     "excluded_dms": ["123456789123456789"],
     "safe_mode": false,
     "delete_range": "all"
   }
   ```

   - `exclusion_mode`: `"whitelist"` deletes only from included channels; `"blacklist"` deletes everywhere *except* excluded ones.
   - `excluded_guilds`: List of server (guild) IDs to ignore entirely.
   - `excluded_channels`: List of channel IDs to skip. (This includes group dm channel IDs)
   - `excluded_dms`: List of user IDs for DMs to skip.
   - `safe_mode`: Adds delays to avoid detection — slows down deletion significantly.
   - `delete_range`: Time range for deletion (e.g., `"24h"`, `"1w"`, `"1m"`, `"3m"`, `"6m"`, `"1y"`, `"all"`).

4. **Install dependencies**
   ```bash
   bun install
   ```

5. **Start the tool**
   ```bash
   bun run start
   ```

---

- Scans all messages sent by **your account**
- Deletes them unless they’re:
  - In excluded channels
  - In excluded servers
  - In DMs with excluded users
  - Out of specified timeline

---

## 🧪 Contributing

Pull requests are welcome! Fork the repo, make your changes, and submit a PR — we’ll credit all contributors.
