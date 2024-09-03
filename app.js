const Discord = require('discord.js');
const express = require('express');
const axios = require('axios');
const MongoClient = require('mongodb').MongoClient;
const config = require('./config.json');

// Create a new Discord client
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildMessages,
  ],
});

// Create a new Express app
const app = express();

// Connect to MongoDB
const mongoClient = new MongoClient(config.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoClient.db();
const collection = db.collection('api_tokens');

// Set up Discord client
client.on('ready', () => {
  console.log('Ready to serve the best API of all time');
  client.user.setActivity('in development');
});

// Set up API endpoint for userinfo
app.get('/userinfo', async (req, res) => {
  const apiToken = req.headers.authorization;
  if (!apiToken) {
    return res.status(401).json({ error: 'API token is required' });
  }

  const isValidToken = await verifyApiToken(apiToken);
  if (!isValidToken) {
    return res.status(401).json({ error: 'Invalid API token' });
  }

  const userId = req.query.user_id;
  const headers = {
    Authorization: `Bot ${config.TOKEN}`,
    'Content-Type': 'application/json',
  };

  try {
    const response = await axios.get(`https://discord.com/api/v9/users/${userId}`, { headers });
    const userInfo = response.data;
    const filteredUserInfo = {
      id: userInfo.id,
      username: userInfo.username,
      avatar: userInfo.avatar,
      discriminator: userInfo.discriminator,
      public_flags: userInfo.public_flags,
      flags: userInfo.flags,
      banner: userInfo.banner,
      banner_color: userInfo.banner_color,
      accent_color: userInfo.accent_color,
      bio: userInfo.bio,
    };

    return res.json(filteredUserInfo);
  } catch (error) {
    if (error.response.status === 404) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Verify API token
async function verifyApiToken(apiToken) {
  const tokenDoc = await collection.findOne({ token: apiToken });
  return tokenDoc !== null;
}

// Generate API token
function generateApiToken() {
  return require('crypto').randomBytes(16).toString('hex');
}

// Give API token to user
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!give')) {
    const user = message.mentions.users.first();
    if (!user) {
      return message.reply('Please mention a user to give the API token to');
    }

    const apiToken = generateApiToken();
    await collection.insertOne({ token: apiToken, user_id: user.id });

    try {
      await user.send(`Your API token is: \`${apiToken}\``);
    } catch (error) {
      console.error(error);
    }

    const logChannel = client.channels.cache.get(config.LOG_CHANNEL_ID);
    if (logChannel) {
      const embed = new Discord.EmbedBuilder()
        .setDescription('New API Token Generated')
        .setColor(0x020000)
        .addFields(
          { name: 'User', value: `**${user.username}**`, inline: true },
          { name: 'Key', value: `\`\`\`${apiToken}\`\`\``, inline: true },
        );
      await logChannel.send({ embeds: [embed] });
    } else {
      console.log(`Could not find channel with ID ${config.LOG_CHANNEL_ID}`);
    }
  }
});

// Start Express app
const port = config.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

// Login to Discord
client.login(config.TOKEN);
