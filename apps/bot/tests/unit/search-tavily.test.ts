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

describe('tavilySearch', () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch');
  beforeEach(() => {
    setEnv({ TAVILY_API_KEY: 'tvly-x', WEB_SEARCH_ENABLED: 'true' });
    fetchMock.mockReset();
  });
  afterEach(() => fetchMock.mockReset());

  it('returns mapped results on 200', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          query: 'climate Lisbon',
          results: [
            { title: 'A', url: 'https://a', content: 'foo', score: 0.9 },
            { title: 'B', url: 'https://b', content: 'bar', score: 0.8 },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const { tavilySearch } = await import('../../search/tavily');
    const r = await tavilySearch('climate Lisbon', { maxResults: 2 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.length).toBe(2);
      expect(r.data[0]!.title).toBe('A');
      expect(r.data[0]!.snippet).toBe('foo');
    }
  });

  it('errors when TAVILY_API_KEY missing', async () => {
    setEnv({ TAVILY_API_KEY: undefined });
    const { tavilySearch } = await import('../../search/tavily');
    const r = await tavilySearch('x');
    expect(r.ok).toBe(false);
  });

  it('errors when WEB_SEARCH_ENABLED=false', async () => {
    setEnv({ WEB_SEARCH_ENABLED: 'false' });
    const { tavilySearch } = await import('../../search/tavily');
    const r = await tavilySearch('x');
    expect(r.ok).toBe(false);
  });

  it('returns error on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    const { tavilySearch } = await import('../../search/tavily');
    const r = await tavilySearch('x');
    expect(r.ok).toBe(false);
  });
});
