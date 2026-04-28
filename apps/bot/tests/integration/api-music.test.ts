import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { resetEnvCache } from '../../lib/env';

function setEnv(overrides: Record<string, string | undefined>): void {
  resetEnvCache();
  const e = process.env as Record<string, string | undefined>;
  for (const k of Object.keys(overrides)) {
    if (overrides[k] === undefined) delete e[k];
    else e[k] = overrides[k]!;
  }
}

describe('REST /api/music/* routes', () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    setEnv({
      API_KEY: 'k',
      WORKER_BASE_URL: 'https://w.example',
      WORKER_SHARED_SECRET: 'sec',
    });
    fetchMock.mockReset();
  });
  afterEach(() => fetchMock.mockReset());

  async function call(routePath: string, init: RequestInit): Promise<Response> {
    const mod = (await import(`../../app/api/${routePath}/route`)) as {
      POST?: (req: Request) => Promise<Response>;
      GET?: (req: Request) => Promise<Response>;
    };
    const handler = init.method === 'GET' ? mod.GET! : mod.POST!;
    return handler(new Request(`http://localhost/api/${routePath}`, init));
  }

  it('POST /api/music/play: 401 without auth', async () => {
    const r = await call('music/play', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ guildId: 'g', channelId: 'c', query: 'hello' }),
    });
    expect(r.status).toBe(401);
  });

  it('POST /api/music/play: 415 without json content-type', async () => {
    const r = await call('music/play', {
      method: 'POST',
      headers: { authorization: 'Bearer k' },
      body: JSON.stringify({ guildId: 'g', channelId: 'c', query: 'hello' }),
    });
    expect(r.status).toBe(415);
  });

  it('POST /api/music/play: 400 invalid body', async () => {
    const r = await call('music/play', {
      method: 'POST',
      headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/music/play: 200 happy path proxies to worker', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ track: { title: 'A' }, queuePosition: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const r = await call('music/play', {
      method: 'POST',
      headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ guildId: 'g', channelId: 'c', query: 'tropicalia' }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { track: { title: string }; queuePosition: number };
    expect(body.queuePosition).toBe(1);
  });

  it('POST /api/music/play: 503 when worker disabled', async () => {
    setEnv({ API_KEY: 'k', WORKER_BASE_URL: undefined, WORKER_SHARED_SECRET: undefined });
    const r = await call('music/play', {
      method: 'POST',
      headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ guildId: 'g', channelId: 'c', query: 'tropicalia' }),
    });
    expect(r.status).toBe(503);
  });

  it('GET /api/music/queue: 200 happy path', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ current: null, items: [], total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const mod = (await import('../../app/api/music/queue/route')) as { GET: (req: Request) => Promise<Response> };
    const r = await mod.GET(
      new Request('http://localhost/api/music/queue?guildId=g&limit=10&offset=0&info_level=compact&include_current=true', {
        method: 'GET',
        headers: { authorization: 'Bearer k' },
      }),
    );
    expect(r.status).toBe(200);
  });

  it('POST /api/music/spotify/play: transforms body to source=spotify', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ track: { title: 'A' }, queuePosition: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const r = await call('music/spotify/play', {
      method: 'POST',
      headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ guildId: 'g', channelId: 'c', spotifyUri: 'spotify:track:abc' }),
    });
    expect(r.status).toBe(200);
    const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as { source: string; query: string };
    expect(sentBody.source).toBe('spotify');
    expect(sentBody.query).toBe('spotify:track:abc');
  });

  it('GET /api/music/play -> 405', async () => {
    const r = await call('music/play', { method: 'GET' });
    expect(r.status).toBe(405);
  });

  it('POST /api/tts/piper transforms provider=piper', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ played: true, durationMs: 100 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const r = await call('tts/piper', {
      method: 'POST',
      headers: { authorization: 'Bearer k', 'content-type': 'application/json' },
      body: JSON.stringify({ guildId: 'g', channelId: 'c', text: 'olá' }),
    });
    expect(r.status).toBe(200);
    const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as { provider: string };
    expect(sentBody.provider).toBe('piper');
  });
});
