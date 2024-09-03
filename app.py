import discord
from discord.ext import commands
from flask import Flask, request, jsonify
import requests
from pymongo import MongoClient
import secrets
import os

app = Flask(__name__)

bot = commands.Bot(command_prefix='api!', intents=discord.Intents.all())


TOKEN = os.getenv("TOKEN")


MONGO_CLIENT = MongoClient(os.getenv("MONGO"))
DB = MONGO_CLIENT['api_tokens']
COLLECTION = DB['tokens']


LOG_CHANNEL_ID = os.getenv("LOGS")

@app.route('/userinfo', methods=['GET'])
def userinfo():
    
    api_token = request.headers.get('Authorization')
    if not api_token:
        return jsonify({'error': 'API token is required'}), 401

    
    if not verify_api_token(api_token):
        return jsonify({'error': 'Invalid API token'}), 401


    user_id = request.args.get('user_id')

    headers = {
        'Authorization': f'Bearer {TOKEN}',
        'Content-Type': 'application/json'
    }
    response = requests.get(f'https://discord.com/api/v9/users/{user_id}', headers=headers)

    
    if response.status_code == 404:
        return jsonify({'error': 'User not found'}), 404

    
    user_info = response.json()
    user_info = {
        'id': user_info['id'],
        'username': user_info['username'],
        'avatar': user_info['avatar'],
        'discriminator': user_info['discriminator']
    }

    
    return jsonify(user_info)

def verify_api_token(api_token):
    
    token_doc = COLLECTION.find_one({'token': api_token})
    if token_doc:
        return True
    return False

@bot.command(name='give', help='Generate an API token and send it to the specified user')
async def give(ctx, user: discord.Member):
    # Generate a new API token
    api_token = generate_api_token()

    
    COLLECTION.insert_one({'token': api_token, 'user_id': user.id})

    
    await user.send(f'Your API token is: `{api_token}`')

    
    log_channel = bot.get_channel(LOG_CHANNEL_ID)
    if log_channel:
        emb = discord.Embed(description="New API Token Generated", color=0x020000)
        emb.add_field(name="User", value=f"**{user.name}**", inline=True)
        emb.add_field(name="Key", value=f"```{api_token}```", inline=True)
        await log_channel.send(embed=emb)
    else:
        print(f'Could not find channel with ID {LOG_CHANNEL_ID}')

@bot.event
async def on_ready():
    print("ready to serve the best api of all time")
    await bot.change_presence(activity=discord.CustomActivity(name="in development"))

def generate_api_token():
    
    return secrets.token_urlsafe(16)

if __name__ == '__main__':
    bot.loop.create_task(app.run(debug=True))
    bot.run(TOKEN, reconnect=True)
