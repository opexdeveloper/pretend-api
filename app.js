import { createApp } from 'vue';
import App from './App.vue';
import axios from 'axios';
import Discord from 'discord.js';
import { MongoClient } from 'mongodb';

const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildMessages,
  ],
});

const mongoClient = new MongoClient(process.env.MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoClient.db();
const collection = db.collection('api_tokens');

const app = createApp(App);

app.use(async (ctx, next) => {
  if (ctx.request.url === '/userinfo') {
    const apiToken = ctx.request.headers.authorization;
    if (!apiToken) {
      return { status: 401, body: { error: 'API token is required' } };
    }

    const isValidToken = await verifyApiToken(apiToken);
    if (!isValidToken) {
      return { status: 401, body: { error: 'Invalid API token' } };
    }

    const userId = ctx.request.query.user_id;
    const headers = {
      Authorization: `Bot ${process.env.TOKEN}`,
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

      return { status: 200, body: filteredUserInfo };
    } catch (error) {
      if (error.response.status === 404) {
        return { status: 404, body: { error: 'User not found' } };
      }

      console.error(error);
      return { status: 500, body: { error: 'Internal Server Error' } };
    }
  }

  return next();
});

async function verifyApiToken(apiToken) {
  const tokenDoc = await collection.findOne({ token: apiToken });
  return tokenDoc !== null;
}

function generateApiToken() {
  return require('crypto').randomBytes(16).toString('hex');
}

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

    const logChannel = client.channels.cache.get(process.env.LOGS);
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
      console.log(`Could not find channel with ID ${process.env.LOGS}`);
    }
  }
});

client.on('ready', () => {
  console.log('Ready to serve the best API of all time');
  client.user.setActivity('in development');
});

client.login(process.env.TOKEN);

app.listen(() => {
  console.log('Server listening on port 3000');
});
