import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : v.toLowerCase() === 'true'));

const intFromString = (def?: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return def;
      if (typeof v === 'number') return v;
      const n = Number.parseInt(v, 10);
      return Number.isNaN(n) ? def : n;
    });

const floatFromString = (def?: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return def;
      if (typeof v === 'number') return v;
      const n = Number.parseFloat(v);
      return Number.isNaN(n) ? def : n;
    });

const baseSchema = z.object({
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
  BOT_LOCALE: z.string().default('pt-BR'),
  APP_VERSION: z.string().default('dev'),

  // Discord
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_APPLICATION_ID: z.string().optional(),
  DISCORD_APP_ID: z.string().optional(),
  DISCORD_PUBLIC_KEY: z.string().optional(),
  DISCORD_MENTION_ROLE_IDS: z.string().optional(),

  // LLM
  AI_GATEWAY_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('anthropic/claude-sonnet-4.6'),
  EMBEDDING_MODEL: z.string().default('openai/text-embedding-3-small'),

  // Memory
  MEMORY_ENABLED: booleanFromString.default(false),
  MAX_RETRIEVAL_RESULTS: intFromString(10),
  MEMORY_SIMILARITY_THRESHOLD: floatFromString(0.6),
  MEMORY_RETENTION_DAYS: intFromString(30),
  POSTGRES_URL: z.string().optional(),
  KV_URL: z.string().optional(),
  KV_REST_API_URL: z.string().optional(),
  KV_REST_API_TOKEN: z.string().optional(),

  // Web search
  TAVILY_API_KEY: z.string().optional(),
  WEB_SEARCH_ENABLED: booleanFromString.default(true),

  // Music
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  MAX_QUEUE_SIZE: intFromString(50),

  // Wake
  WAKE_WORD: z.string().default('tangerina'),
  WAKE_WINDOW_MS: intFromString(5000),
  WAKE_DUCK_VOLUME: intFromString(20),

  // Integrations
  N8N_WEBHOOK_URL: z.string().optional(),

  // Worker auth
  WORKER_BASE_URL: z.string().optional(),
  WORKER_SHARED_SECRET: z.string().optional(),

  // Public REST API
  API_KEY: z.string().optional(),
  LEGACY_ROUTES: booleanFromString.default(false),
  ADMIN_TOKEN: z.string().optional(),

  // Vercel cron / Discord gateway
  CRON_SECRET: z.string().optional(),

  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

export type RawEnv = z.infer<typeof baseSchema>;

const refined = baseSchema.superRefine((env, ctx) => {
  const appId = env.DISCORD_APPLICATION_ID ?? env.DISCORD_APP_ID;
  if (env.NODE_ENV === 'production') {
    if (!env.DISCORD_BOT_TOKEN) ctx.addIssue({ code: 'custom', message: 'DISCORD_BOT_TOKEN required in production', path: ['DISCORD_BOT_TOKEN'] });
    if (!env.DISCORD_PUBLIC_KEY) ctx.addIssue({ code: 'custom', message: 'DISCORD_PUBLIC_KEY required in production', path: ['DISCORD_PUBLIC_KEY'] });
    if (!appId) ctx.addIssue({ code: 'custom', message: 'DISCORD_APPLICATION_ID required in production', path: ['DISCORD_APPLICATION_ID'] });
    if (!env.AI_GATEWAY_API_KEY) ctx.addIssue({ code: 'custom', message: 'AI_GATEWAY_API_KEY required in production', path: ['AI_GATEWAY_API_KEY'] });
    if (!env.API_KEY) ctx.addIssue({ code: 'custom', message: 'API_KEY required in production', path: ['API_KEY'] });
    if (!env.CRON_SECRET) ctx.addIssue({ code: 'custom', message: 'CRON_SECRET required in production for /api/discord/gateway and /api/cron/memory-prune', path: ['CRON_SECRET'] });
  }
  if (env.MEMORY_ENABLED) {
    if (!env.POSTGRES_URL) ctx.addIssue({ code: 'custom', message: 'POSTGRES_URL required when MEMORY_ENABLED=true', path: ['POSTGRES_URL'] });
    if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN)
      ctx.addIssue({ code: 'custom', message: 'KV_REST_API_URL and KV_REST_API_TOKEN required when MEMORY_ENABLED=true', path: ['KV_REST_API_URL'] });
  }
  if (env.WORKER_BASE_URL && !env.WORKER_SHARED_SECRET) {
    ctx.addIssue({ code: 'custom', message: 'WORKER_SHARED_SECRET required when WORKER_BASE_URL is set', path: ['WORKER_SHARED_SECRET'] });
  }
});

export type Env = z.infer<typeof refined> & { DISCORD_APPLICATION_ID: string | undefined };

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = refined.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const data = parsed.data;
  const appId = data.DISCORD_APPLICATION_ID ?? data.DISCORD_APP_ID;
  cached = { ...data, DISCORD_APPLICATION_ID: appId };
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}

export function env(): Env {
  return loadEnv();
}
