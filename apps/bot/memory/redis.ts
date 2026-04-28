import { Redis } from '@upstash/redis';
import { loadEnv } from '@/lib/env';

let client: Redis | null = null;

export function redis(): Redis {
  if (client) return client;
  const env = loadEnv();
  if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) {
    throw new Error('redis_not_configured');
  }
  client = new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });
  return client;
}

function recentKey(guildId: string, channelId: string, userId: string): string {
  return `recent:${guildId}:${channelId}:${userId}`;
}

export async function pushRecent(guildId: string, channelId: string, userId: string, text: string): Promise<void> {
  const env = loadEnv();
  const r = redis();
  const key = recentKey(guildId, channelId, userId);
  await r.zadd(key, { score: Date.now(), member: text });
  await r.zremrangebyrank(key, 0, -11);
  await r.expire(key, 60 * 60 * 24 * (env.MEMORY_RETENTION_DAYS ?? 30));
}

export async function getRecent(guildId: string, channelId: string, userId: string): Promise<string[]> {
  const r = redis();
  const key = recentKey(guildId, channelId, userId);
  const items = (await r.zrange(key, -10, -1)) as unknown as string[];
  return items;
}

export async function deleteRecentByGuild(guildId: string): Promise<number> {
  const r = redis();
  const cursor = '0';
  let removed = 0;
  let nextCursor = cursor;
  do {
    const out = (await r.scan(nextCursor, { match: `recent:${guildId}:*`, count: 200 })) as unknown as [string, string[]];
    nextCursor = out[0];
    if (out[1].length > 0) {
      removed += out[1].length;
      await r.del(...out[1]);
    }
  } while (nextCursor !== '0');
  return removed;
}

export async function deleteRecentByUser(guildId: string, userId: string): Promise<number> {
  const r = redis();
  let removed = 0;
  let nextCursor = '0';
  do {
    const out = (await r.scan(nextCursor, { match: `recent:${guildId}:*:${userId}`, count: 200 })) as unknown as [string, string[]];
    nextCursor = out[0];
    if (out[1].length > 0) {
      removed += out[1].length;
      await r.del(...out[1]);
    }
  } while (nextCursor !== '0');
  return removed;
}
