import { loadEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { ok, err, type Result } from '@/lib/result';

export interface TavilyResult {
  title: string;
  url: string;
  snippet: string;
  score: number;
}

export interface TavilySearchOptions {
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
  includeDomains?: string[];
  excludeDomains?: string[];
}

interface TavilyApiResponse {
  query: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
}

export async function tavilySearch(query: string, opts: TavilySearchOptions = {}): Promise<Result<TavilyResult[]>> {
  const env = loadEnv();
  if (!env.TAVILY_API_KEY) return err('tavily_not_configured');
  if (!env.WEB_SEARCH_ENABLED) return err('web_search_disabled');
  const log = logger().child({ component: 'tavily' });
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query,
        max_results: opts.maxResults ?? 5,
        search_depth: opts.searchDepth ?? 'basic',
        include_domains: opts.includeDomains,
        exclude_domains: opts.excludeDomains,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      log.warn({ status: res.status, body: txt.slice(0, 200) }, 'tavily non-2xx');
      return err(`tavily_${res.status}`);
    }
    const data = (await res.json()) as TavilyApiResponse;
    return ok(
      data.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        score: r.score,
      })),
    );
  } catch (e) {
    log.error({ err: e }, 'tavily fetch failed');
    return err((e as Error).message ?? 'tavily_failed');
  }
}
