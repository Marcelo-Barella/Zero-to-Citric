import { describe, expect, it, beforeEach } from 'vitest';
import { loadEnv, resetEnvCache } from '../../lib/env';

function setEnv(overrides: Record<string, string | undefined>) {
  resetEnvCache();
  const env = process.env as Record<string, string | undefined>;
  for (const k of Object.keys(overrides)) {
    if (overrides[k] === undefined) delete env[k];
    else env[k] = overrides[k]!;
  }
}

describe('env', () => {
  beforeEach(() => {
    setEnv({
      NODE_ENV: 'development',
      MEMORY_ENABLED: 'false',
      WORKER_BASE_URL: undefined,
      WORKER_SHARED_SECRET: undefined,
      POSTGRES_URL: undefined,
      KV_REST_API_URL: undefined,
      KV_REST_API_TOKEN: undefined,
    });
  });

  it('parses defaults', () => {
    const e = loadEnv();
    expect(e.LLM_MODEL).toBe('anthropic/claude-sonnet-4.6');
    expect(e.BOT_LOCALE).toBe('pt-BR');
    expect(e.MEMORY_RETENTION_DAYS).toBe(30);
    expect(e.MEMORY_ENABLED).toBe(false);
  });

  it('aliases DISCORD_APP_ID to DISCORD_APPLICATION_ID', () => {
    setEnv({ DISCORD_APP_ID: '123', DISCORD_APPLICATION_ID: undefined });
    const e = loadEnv();
    expect(e.DISCORD_APPLICATION_ID).toBe('123');
  });

  it('rejects MEMORY_ENABLED=true without postgres+redis', () => {
    setEnv({ MEMORY_ENABLED: 'true' });
    expect(() => loadEnv()).toThrow(/POSTGRES_URL/);
  });

  it('rejects WORKER_BASE_URL without WORKER_SHARED_SECRET', () => {
    setEnv({ WORKER_BASE_URL: 'https://w.example' });
    expect(() => loadEnv()).toThrow(/WORKER_SHARED_SECRET/);
  });
});
