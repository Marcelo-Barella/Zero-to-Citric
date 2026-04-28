#!/usr/bin/env tsx
/**
 * Validates env using the bot's zod schema.
 * Prints grouped errors and exits non-zero on failure.
 */
import { loadEnv } from '../lib/env.js';

try {
  const env = loadEnv();
  process.stdout.write('Environment OK\n');
  process.stdout.write(JSON.stringify(
    {
      NODE_ENV: env.NODE_ENV,
      LLM_MODEL: env.LLM_MODEL,
      BOT_LOCALE: env.BOT_LOCALE,
      MEMORY_ENABLED: env.MEMORY_ENABLED,
      voice_worker: Boolean(env.WORKER_BASE_URL && env.WORKER_SHARED_SECRET),
      web_search: Boolean(env.TAVILY_API_KEY) && env.WEB_SEARCH_ENABLED,
      n8n: Boolean(env.N8N_WEBHOOK_URL),
      legacy_routes: env.LEGACY_ROUTES,
    },
    null,
    2,
  ));
  process.stdout.write('\n');
  process.exit(0);
} catch (err) {
  process.stderr.write(`${(err as Error).message}\n`);
  process.exit(1);
}
