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

describe('TTS provider routing', () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    fetchMock.mockReset();
  });
  afterEach(() => fetchMock.mockReset());

  it('synthesizeElevenLabs returns audio buffer on 200', async () => {
    setEnv({ ELEVEN_API_KEY: 'k', ELEVEN_VOICE_ID: 'voice' });
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3, 4]).buffer, { status: 200 }));
    const { synthesizeElevenLabs } = await import('../src/tts/elevenlabs.js');
    const r = await synthesizeElevenLabs('olá');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.length).toBe(4);
  });

  it('synthesizeElevenLabs errors when key missing', async () => {
    setEnv({ ELEVEN_API_KEY: undefined });
    const { synthesizeElevenLabs } = await import('../src/tts/elevenlabs.js');
    const r = await synthesizeElevenLabs('olá');
    expect(r.ok).toBe(false);
  });

  it('synthesizePiper errors when sidecar URL missing', async () => {
    setEnv({ PIPER_SIDECAR_URL: undefined });
    const { synthesizePiper } = await import('../src/tts/piper.js');
    const r = await synthesizePiper('olá');
    expect(r.ok).toBe(false);
  });

  it('synthesizePiper hits the sidecar', async () => {
    setEnv({ PIPER_SIDECAR_URL: 'http://piper.test' });
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([0xff]).buffer, { status: 200 }));
    const { synthesizePiper } = await import('../src/tts/piper.js');
    const r = await synthesizePiper('olá');
    expect(r.ok).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toContain('http://piper.test');
  });
});
