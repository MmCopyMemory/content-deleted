import discord
import asyncio

# ============ CONFIG ============ #
UR_TOKEN = 'MTM'
GUILD_EXCLUDE = [
    #(123456789123456789, 0),      # GUILD ID , 0 => EXCLUDE ENTIRE GUILD
    (992106461775798322, 992106461775798325),  # GUILD ID , 0 => EXCLUDE SPECIFIC CHANNEL FROM GUILD
]
DM_EXCLUDE = [
    1365788302027919430,  # USERID
]
SafeMode = False # Sleeps after deleting a message for a sec
# Disabled since no threading => Impossible to get over 50 requests per second and no ratelimit
# ================================= #

client = discord.Client()

@client.event
async def on_ready():
    print(f'Logged in as {client.user} (ID: {client.user.id})')
                        
@client.event
async def on_message(message):
    if message.author.id == client.user.id:
        if(message.content.startswith("!Nuke")):
            excluded_guilds = {g for g, c in GUILD_EXCLUDE if c == 0}
            excluded_channels = {(g, c) for g, c in GUILD_EXCLUDE if c != 0}
            for guild in client.guilds:
                if guild.id in excluded_guilds:
                    continue
                for channel in guild.text_channels:
                    if(guild.id, channel.id) in excluded_channels:
                        continue
                    try:
                        async for msg in channel.history(limit=None, oldest_first=True):
                           if(msg.author.id == client.user.id):
                               await msg.delete()
                               if(SafeMode):
                                    await asyncio.sleep(1)
                    except Exception:
                        continue
    
            for dm in client.private_channels:
                if(isinstance(dm, discord.DMChannel) and dm.recipient.id in DM_EXCLUDE):
                   continue
                try:
                   async for msg in dm.history(limit=None, oldest_first=True):
                       if(msg.author.id == client.user.id):
                           await msg.delete()
                           if(SafeMode):
                               await asyncio.sleep(1)
                except Exception:
                    continue

           

client.run(UR_TOKEN)
