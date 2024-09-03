import discord
from discord.ext import commands
from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

bot = commands.Bot(command_prefix='!')

# Discord API token (replace with your own token)
TOKEN = os.getenv("TOKEN")

@bot.event
async def on_ready():
    print(f'{bot.user} has connected to Discord!')

@app.route('/get_user_info', methods=['GET'])
def get_user_info():
    # Get the user ID from the request query string
    user_id = request.args.get('user_id')

    # Use the Discord API to retrieve user information
    headers = {
        'Authorization': f'Bearer {TOKEN}',
        'Content-Type': 'application/json'
    }
    response = requests.get(f'https://discord.com/api/v9/users/{user_id}', headers=headers)

    # If the user is not found, return a 404 error
    if response.status_code == 404:
        return jsonify({'error': 'User not found'}), 404

    # Get user information from the response
    user_info = response.json()
    user_info = {
        'id': user_info['id'],
        'username': user_info['username'],
        'avatar': user_info['avatar'],
        'discriminator': user_info['discriminator']
    }

    # Return user information as JSON
    return jsonify(user_info)

if __name__ == '__main__':
    bot.loop.create_task(app.run(debug=True))
    bot.run(TOKEN, reconnect=True)
