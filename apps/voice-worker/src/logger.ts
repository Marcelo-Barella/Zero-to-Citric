import pino, { type Logger as PinoLogger } from 'pino';
import { loadEnv } from './env.js';

let cached: PinoLogger | null = null;

export function logger(): PinoLogger {
  if (cached) return cached;
  const env = loadEnv();
  cached = pino({
    level: env.LOG_LEVEL,
    base: { app: 'zero-to-citric/voice-worker', version: env.APP_VERSION },
    redact: {
      paths: ['*.token', '*.secret', '*.api_key', '*.apiKey', '*.password', 'headers["x-worker-secret"]'],
      censor: '[REDACTED]',
    },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  return cached;
}

export type Logger = PinoLogger;
