import { describe, expect, it, beforeEach } from 'vitest';
import { resetEnvCache } from '../../lib/env';

describe('/api/health', () => {
  beforeEach(() => {
    resetEnvCache();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    process.env.APP_VERSION = 'test';
    delete process.env.WORKER_BASE_URL;
    delete process.env.WORKER_SHARED_SECRET;
  });

  it('returns ok with worker disabled when no worker env', async () => {
    const { GET } = await import('../../app/api/health/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; bot_ready: boolean; worker: { ready: boolean }; features: { voice: boolean } };
    expect(body.status).toBe('ok');
    expect(body.bot_ready).toBe(true);
    expect(body.worker.ready).toBe(false);
    expect(body.features.voice).toBe(false);
  });
});
