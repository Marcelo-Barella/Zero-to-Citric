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

vi.mock('ai', async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    generateText: vi.fn(async () => ({ text: 'olá!', toolCalls: [], toolResults: [] })),
  };
});

describe('/api/chat', () => {
  beforeEach(() => {
    setEnv({ API_KEY: 'k', AI_GATEWAY_API_KEY: 'gw', LLM_MODEL: 'anthropic/claude-sonnet-4.6' });
  });
  afterEach(() => vi.resetModules());

  async function callRoute(headers: HeadersInit, body: unknown): Promise<Response> {
    const { POST } = await import('../../app/api/chat/route');
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    return POST(req);
  }

  it('401 without auth', async () => {
    const r = await callRoute({ 'content-type': 'application/json' }, { message: 'oi' });
    expect(r.status).toBe(401);
  });

  it('415 without json content-type', async () => {
    const r = await callRoute({ authorization: 'Bearer k' }, { message: 'oi' });
    expect(r.status).toBe(415);
  });

  it('400 with invalid body', async () => {
    const r = await callRoute(
      { authorization: 'Bearer k', 'content-type': 'application/json' },
      { foo: 'bar' },
    );
    expect(r.status).toBe(400);
  });

  it('400 with non-json', async () => {
    const r = await callRoute(
      { authorization: 'Bearer k', 'content-type': 'application/json' },
      'not-json',
    );
    expect(r.status).toBe(400);
  });

  it('200 with valid body', async () => {
    const r = await callRoute(
      { authorization: 'Bearer k', 'content-type': 'application/json' },
      { message: 'oi tudo bem?' },
    );
    expect(r.status).toBe(200);
    const json = (await r.json()) as { success: boolean; response: string };
    expect(json.success).toBe(true);
    expect(json.response).toBe('olá!');
  });
});
