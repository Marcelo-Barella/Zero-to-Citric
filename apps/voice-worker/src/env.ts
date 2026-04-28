import { z } from 'zod';

const intFromString = (def: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return def;
      if (typeof v === 'number') return v;
      const n = Number.parseInt(String(v), 10);
      return Number.isNaN(n) ? def : n;
    });

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
  APP_VERSION: z.string().default('dev'),
  PORT: intFromString(8787),
  HOST: z.string().default('0.0.0.0'),

  WORKER_SHARED_SECRET: z.string().optional(),

  // Discord
  DISCORD_BOT_TOKEN: z.string().optional(),

  // Music
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  MAX_QUEUE_SIZE: intFromString(50),

  // TTS
  TTS_PROVIDER: z.enum(['elevenlabs', 'piper']).default('elevenlabs'),
  ELEVEN_API_KEY: z.string().optional(),
  ELEVEN_VOICE_ID: z.string().default('21m00Tcm4TlvDq8ikWAM'),
  PIPER_SIDECAR_URL: z.string().optional(),

  // STT
  WHISPER_PROVIDER: z.enum(['zhipu', 'openai', 'sidecar']).default('zhipu'),
  WHISPER_SIDECAR_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ZHIPU_API_KEY: z.string().optional(),

  // Wake
  WAKE_WORD: z.string().default('tangerina'),
  WAKE_WINDOW_MS: intFromString(5000),
  WAKE_DUCK_VOLUME: intFromString(20),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

export type WorkerEnv = z.infer<typeof schema>;

let cached: WorkerEnv | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid worker environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
