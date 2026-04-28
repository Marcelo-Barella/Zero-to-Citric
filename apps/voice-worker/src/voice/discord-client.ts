import { Client, GatewayIntentBits } from 'discord.js';
import { loadEnv } from '../env.js';
import { logger } from '../logger.js';

let client: Client | null = null;

export async function initDiscordClient(): Promise<Client | null> {
  const env = loadEnv();
  if (!env.DISCORD_BOT_TOKEN) {
    logger().info('DISCORD_BOT_TOKEN not set; running worker without discord client');
    return null;
  }
  if (client) return client;
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });
  client.on('ready', (c) => logger().info({ user: c.user.tag }, 'discord client ready'));
  client.on('error', (err) => logger().error({ err }, 'discord client error'));
  await client.login(env.DISCORD_BOT_TOKEN);
  return client;
}

export function getDiscordClient(): Client | null {
  return client;
}

export async function shutdownDiscord(): Promise<void> {
  if (client) {
    await client.destroy();
    client = null;
  }
}
