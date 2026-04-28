import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { voiceWorker } from '../../lib/voice-worker-client';
import { resetEnvCache } from '../../lib/env';

function setEnv(overrides: Record<string, string | undefined>): void {
  resetEnvCache();
  const e = process.env as Record<string, string | undefined>;
  for (const k of Object.keys(overrides)) {
    if (overrides[k] === undefined) delete e[k];
    else e[k] = overrides[k]!;
  }
}

describe('voiceWorker client', () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch');
  afterEach(() => fetchMock.mockReset());

  it('returns voice_disabled when env not set', async () => {
    setEnv({ WORKER_BASE_URL: undefined, WORKER_SHARED_SECRET: undefined });
    const r = await voiceWorker.post('/worker/music/play', { x: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('voice_disabled');
  });

  it('signs requests with x-worker-secret', async () => {
    setEnv({ WORKER_BASE_URL: 'https://w.example', WORKER_SHARED_SECRET: 'sec' });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const r = await voiceWorker.post('/worker/voice/join', { guildId: 'g', channelId: 'c' });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['x-worker-secret']).toBe('sec');
  });

  it('retries once on 5xx', async () => {
    setEnv({ WORKER_BASE_URL: 'https://w.example', WORKER_SHARED_SECRET: 'sec' });
    fetchMock
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    const r = await voiceWorker.post('/worker/voice/join', { guildId: 'g', channelId: 'c' });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry 4xx', async () => {
    setEnv({ WORKER_BASE_URL: 'https://w.example', WORKER_SHARED_SECRET: 'sec' });
    fetchMock.mockResolvedValueOnce(new Response('bad', { status: 400 }));
    const r = await voiceWorker.post('/worker/voice/join', { guildId: 'g', channelId: 'c' });
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
