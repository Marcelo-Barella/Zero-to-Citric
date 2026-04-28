import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { resetEnvCache } from '../src/env.js';

function setEnv(overrides: Record<string, string | undefined>): void {
  resetEnvCache();
  const e = process.env as Record<string, string | undefined>;
  for (const k of Object.keys(overrides)) {
    if (overrides[k] === undefined) delete e[k];
    else e[k] = overrides[k]!;
  }
}

describe('STT provider routing', () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch');
  beforeEach(() => {
    fetchMock.mockReset();
  });
  afterEach(() => fetchMock.mockReset());

  it('routes to OpenAI when WHISPER_PROVIDER=openai', async () => {
    setEnv({ WHISPER_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x' });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ text: 'olá' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const { transcribe } = await import('../src/stt/index.js');
    const r = await transcribe(Buffer.alloc(960));
    expect(r.ok).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toContain('api.openai.com');
  });

  it('routes to Zhipu when WHISPER_PROVIDER=zhipu', async () => {
    setEnv({ WHISPER_PROVIDER: 'zhipu', ZHIPU_API_KEY: 'z-x' });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ text: 'olá' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const { transcribe } = await import('../src/stt/index.js');
    const r = await transcribe(Buffer.alloc(960));
    expect(r.ok).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toContain('bigmodel.cn');
  });

  it('routes to sidecar when WHISPER_PROVIDER=sidecar', async () => {
    setEnv({ WHISPER_PROVIDER: 'sidecar', WHISPER_SIDECAR_URL: 'http://whisper.test' });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ text: 'olá' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const { transcribe } = await import('../src/stt/index.js');
    const r = await transcribe(Buffer.alloc(960));
    expect(r.ok).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toContain('whisper.test');
  });

  it('returns error when provider not configured', async () => {
    setEnv({ WHISPER_PROVIDER: 'openai', OPENAI_API_KEY: undefined });
    const { transcribe } = await import('../src/stt/index.js');
    const r = await transcribe(Buffer.alloc(960));
    expect(r.ok).toBe(false);
  });
});
