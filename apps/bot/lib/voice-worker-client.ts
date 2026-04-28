import { loadEnv } from './env.js';
import { logger } from './logger.js';
import { err, ok, type Result } from './result.js';

export interface VoiceWorkerClient {
  enabled: boolean;
  get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<Result<T>>;
  post<T>(path: string, body: unknown): Promise<Result<T>>;
}

const VOICE_DISABLED = 'voice_disabled';

function buildQuery(query?: Record<string, string | number | boolean | undefined>): string {
  if (!query) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

async function request<T>(method: 'GET' | 'POST', path: string, opts: { body?: unknown; query?: Record<string, string | number | boolean | undefined> }): Promise<Result<T>> {
  const env = loadEnv();
  if (!env.WORKER_BASE_URL || !env.WORKER_SHARED_SECRET) return err(VOICE_DISABLED);
  const url = `${env.WORKER_BASE_URL.replace(/\/$/, '')}${path}${buildQuery(opts.query)}`;
  const headers: Record<string, string> = {
    'x-worker-secret': env.WORKER_SHARED_SECRET,
    'x-request-id': crypto.randomUUID(),
  };
  if (method === 'POST') headers['content-type'] = 'application/json';
  const log = logger().child({ url, method });
  let attempt = 0;
  while (attempt < 2) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify(opts.body ?? {}) : undefined,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (res.status >= 500 && attempt === 0) {
          attempt++;
          continue;
        }
        log.warn({ status: res.status, body: text.slice(0, 500) }, 'voice worker non-2xx');
        return err(text || `worker_status_${res.status}`);
      }
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const data = (await res.json()) as T;
        return ok(data);
      }
      return ok((await res.text()) as unknown as T);
    } catch (e) {
      if (attempt === 0) {
        attempt++;
        continue;
      }
      log.error({ err: e }, 'voice worker fetch failed');
      return err((e as Error).message ?? 'worker_unreachable');
    }
  }
  return err('worker_unreachable');
}

export const voiceWorker: VoiceWorkerClient = {
  get enabled() {
    const env = loadEnv();
    return Boolean(env.WORKER_BASE_URL && env.WORKER_SHARED_SECRET);
  },
  get: <T>(path: string, query?: Record<string, string | number | boolean | undefined>) => request<T>('GET', path, { query }),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, { body }),
};
