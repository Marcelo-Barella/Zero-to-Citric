import { describe, expect, it, beforeEach } from 'vitest';
import { factories, listAvailableToolNames, buildTools } from '../../../ai/tools';
import { toolNames } from '@zero-to-citric/tools-contract';
import { loadEnv, resetEnvCache } from '../../../lib/env';
import type { BotContext } from '../../../ai/tools/_context';
import { logger } from '../../../lib/logger';
import { voiceWorker } from '../../../lib/voice-worker-client';

function setEnv(overrides: Record<string, string | undefined>): void {
  resetEnvCache();
  const e = process.env as Record<string, string | undefined>;
  for (const k of Object.keys(overrides)) {
    if (overrides[k] === undefined) delete e[k];
    else e[k] = overrides[k]!;
  }
}

function makeCtx(): BotContext {
  return {
    env: loadEnv(),
    log: logger(),
    thread: {} as unknown as BotContext['thread'],
    message: {} as unknown as BotContext['message'],
    channel: {} as unknown as BotContext['channel'],
    voiceWorker,
    channelId: 'c',
    userId: 'u',
  };
}

describe('tools registry', () => {
  beforeEach(() => {
    setEnv({
      WORKER_BASE_URL: undefined,
      WORKER_SHARED_SECRET: undefined,
      TAVILY_API_KEY: undefined,
    });
  });

  it('exports a factory for each of the 16 tool names', () => {
    for (const name of toolNames) {
      expect(factories[name]).toBeTypeOf('function');
    }
    expect(Object.keys(factories).length).toBe(16);
  });

  it('listAvailableToolNames filters by env', () => {
    const env = loadEnv();
    const names = listAvailableToolNames(env);
    expect(names).toContain('SEND_Mensagem');
    expect(names).toContain('GET_Canais');
    expect(names).not.toContain('MusicPlay');
    expect(names).not.toContain('WebSearch');
  });

  it('buildTools returns only allowed tools', () => {
    const tools = buildTools(makeCtx());
    expect('SEND_Mensagem' in tools).toBe(true);
    expect('MusicPlay' in tools).toBe(false);
  });

  it('buildTools includes voice and search when enabled', () => {
    setEnv({
      WORKER_BASE_URL: 'https://w.example',
      WORKER_SHARED_SECRET: 'x',
      TAVILY_API_KEY: 'tvly-xx',
    });
    const tools = buildTools(makeCtx());
    expect('MusicPlay' in tools).toBe(true);
    expect('WebSearch' in tools).toBe(true);
    expect('TTSSpeak' in tools).toBe(true);
  });
});
