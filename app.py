import discord
from discord.ext import commands
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pymongo import MongoClient
import secrets
import os

app = FastAPI()

bot = commands.Bot(command_prefix='api!', intents=discord.Intents.all())

TOKEN = os.getenv("TOKEN")

MONGO_CLIENT = MongoClient(os.getenv("MONGO"))
DB = MONGO_CLIENT['api_tokens']
COLLECTION = DB['tokens']

LOG_CHANNEL_ID = os.getenv("LOGS")

security = HTTPBearer()

@app.get("/userinfo")
async def userinfo(request: Request, token: HTTPAuthorizationCredentials = Depends(security)):
    api_token = token.credentials
    if not verify_api_token(api_token):
        return JSONResponse({"error": "Invalid API token"}, status_code=401)

    user_id = request.query_params.get("user_id")

    headers = {
        "Authorization": f"Bot {TOKEN}",
        "Content-Type": "application/json"
    }
    response = requests.get(f"https://discord.com/api/v9/users/{user_id}", headers=headers)

    if response.status_code == 404:
        return JSONResponse({"error": "User not found"}, status_code=404)

    user_info = response.json()
    user_info = {
        "id": user_info["id"],
        "username": user_info["username"],
        "avatar": user_info["avatar"],
        "discriminator": user_info["discriminator"],
        "public_flags": user_info["public_flags"],
        "flags": user_info["flags"],
        "banner": user_info.get("banner", None),
        "banner_color": user_info.get("banner_color", None),
        "accent_color": user_info.get("accent_color", None),
        "bio": user_info.get("bio", None)
    }

    return JSONResponse(user_info)

def verify_api_token(api_token):
    token_doc = COLLECTION.find_one({"token": api_token})
    if token_doc:
        return True
    return False

@bot.command(name="give", help="Generate an API token and send it to the specified user")
async def give(ctx, user: discord.Member):
    # Generate a new API token
    api_token = generate_api_token()

    # Store the API token in the database
    COLLECTION.insert_one({"token": api_token, "user_id": user.id})

    # Send the API token to the user
    await user.send(f"Your API token is: `{api_token}`")

    # Log the API token generation
    log_channel = bot.get_channel(LOG_CHANNEL_ID)
    if log_channel:
        emb = discord.Embed(description="New API Token Generated", color=0x020000)
        emb.add_field(name="User", value=f"**{user.name}**", inline=True)
        emb.add_field(name="Key", value=f"```{api_token}```", inline=True)
        await log_channel.send(embed=emb)
    else:
        print(f"Could not find channel with ID {LOG_CHANNEL_ID}")

@bot.event
async def on_ready():
    print("ready to serve the best api of all time")
    await bot.change_presence(activity=discord.CustomActivity(name="in development"))

def generate_api_token():
    # Generate a random API token
    return secrets.token_urlsafe(16)

if __name__ == "__main__":
    bot.loop.create_task(app.run(debug=True))
    bot.run(TOKEN, reconnect=True)
