import { describe, expect, it, beforeEach } from 'vitest';
import { canUseTool } from '../../../ai/tools/_policy';
import { resetEnvCache, loadEnv } from '../../../lib/env';

function setEnv(overrides: Record<string, string | undefined>): void {
  resetEnvCache();
  const e = process.env as Record<string, string | undefined>;
  for (const k of Object.keys(overrides)) {
    if (overrides[k] === undefined) delete e[k];
    else e[k] = overrides[k]!;
  }
}

describe('canUseTool', () => {
  beforeEach(() => {
    setEnv({
      WORKER_BASE_URL: undefined,
      WORKER_SHARED_SECRET: undefined,
      TAVILY_API_KEY: undefined,
      WEB_SEARCH_ENABLED: 'true',
    });
  });

  it('non-voice/non-search tools are always allowed', () => {
    const env = loadEnv();
    expect(canUseTool('SEND_Mensagem', env)).toBe(true);
    expect(canUseTool('GET_Canais', env)).toBe(true);
  });

  it('voice tools require worker env', () => {
    let env = loadEnv();
    expect(canUseTool('MusicPlay', env)).toBe(false);
    expect(canUseTool('TTSSpeak', env)).toBe(false);
    setEnv({ WORKER_BASE_URL: 'https://w.example', WORKER_SHARED_SECRET: 'x' });
    env = loadEnv();
    expect(canUseTool('MusicPlay', env)).toBe(true);
    expect(canUseTool('TTSSpeak', env)).toBe(true);
  });

  it('WebSearch requires TAVILY_API_KEY and WEB_SEARCH_ENABLED', () => {
    let env = loadEnv();
    expect(canUseTool('WebSearch', env)).toBe(false);
    setEnv({ TAVILY_API_KEY: 'tvly-xxx' });
    env = loadEnv();
    expect(canUseTool('WebSearch', env)).toBe(true);
    setEnv({ WEB_SEARCH_ENABLED: 'false' });
    env = loadEnv();
    expect(canUseTool('WebSearch', env)).toBe(false);
  });
});
