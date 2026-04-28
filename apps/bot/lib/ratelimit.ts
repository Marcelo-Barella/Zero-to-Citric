import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { loadEnv } from './env.js';

let cached: Ratelimit | null = null;

export function ratelimit(): Ratelimit | null {
  if (cached) return cached;
  const env = loadEnv();
  if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) return null;
  const redis = new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN });
  cached = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    analytics: false,
    prefix: 'rl:bot',
  });
  return cached;
}

export async function checkRateLimit(key: string): Promise<{ allowed: boolean; remaining: number }> {
  const rl = ratelimit();
  if (!rl) return { allowed: true, remaining: Infinity };
  const r = await rl.limit(key);
  return { allowed: r.success, remaining: r.remaining };
}
