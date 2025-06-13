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

3. **Configure `.env`**

   Create a `.env` file in the root directory with the following format:
   ```
   DISCORD_TOKEN=your_token_here

   # Format: [ [GUILD_ID, CHANNEL_ID], ... ]
   # Use CHANNEL_ID 0 to skip the entire server
   GUILD_EXCLUDE=[["992106461775798322", "0"], ["992106461775798322", "992106461775798325"]]

   # Format: [USER_ID, ...] for DMs you want to exclude
   DM_EXCLUDE=["1365788302027919430"]
   ```

4. **Install and compile**
   ```bash
   bun install
   bun run compile
   ```

5. **Start deletion**
   In any channel or DM, type:
   ```
   !nuke
   ```

---

- Scans all messages sent by **your account**
- Deletes them unless they’re:
  - In excluded channels
  - In excluded servers (via `CHANNEL_ID = 0`)
  - In DMs with excluded users

---

## 🧪 Contributing

Pull requests are welcome! Fork the repo, make your changes, and submit a PR — we’ll credit all contributors.
