import { createDiscordAdapter, type DiscordAdapter } from '@chat-adapter/discord';
import { createMemoryState } from '@chat-adapter/state-memory';
import { createRedisState } from '@chat-adapter/state-redis';
import type { StateAdapter } from 'chat';
import { loadEnv } from '@/lib/env';

export function buildDiscordAdapter(): DiscordAdapter {
  const env = loadEnv();
  const cfg: Parameters<typeof createDiscordAdapter>[0] = {};
  if (env.DISCORD_BOT_TOKEN) cfg.botToken = env.DISCORD_BOT_TOKEN;
  if (env.DISCORD_PUBLIC_KEY) cfg.publicKey = env.DISCORD_PUBLIC_KEY;
  if (env.DISCORD_APPLICATION_ID) cfg.applicationId = env.DISCORD_APPLICATION_ID;
  if (env.DISCORD_MENTION_ROLE_IDS) {
    cfg.mentionRoleIds = env.DISCORD_MENTION_ROLE_IDS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return createDiscordAdapter(cfg);
}

export function buildStateAdapter(): StateAdapter {
  const env = loadEnv();
  if (env.KV_URL) {
    return createRedisState({ url: env.KV_URL });
  }
  return createMemoryState();
}
