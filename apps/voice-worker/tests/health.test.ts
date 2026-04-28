import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { resetEnvCache } from '../src/env.js';

let app: FastifyInstance;

beforeAll(async () => {
  process.env.WORKER_SHARED_SECRET = 'test-secret';
  process.env.PORT = '0';
  resetEnvCache();
  const { buildServer } = await import('../src/index.js');
  ({ app } = await buildServer());
});

afterAll(async () => {
  await app.close();
});

describe('worker health', () => {
  it('GET /worker/health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/worker/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ready: boolean; voiceConnections: number };
    expect(body.ready).toBe(true);
    expect(body.voiceConnections).toBe(0);
  });

  it('protected endpoints return 401 without secret', async () => {
    const res = await app.inject({ method: 'POST', url: '/worker/voice/join', payload: {} });
    expect(res.statusCode).toBe(401);
  });
});
