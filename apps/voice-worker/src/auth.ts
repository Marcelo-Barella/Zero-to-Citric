import type { FastifyInstance } from 'fastify';
import { loadEnv } from './env.js';

const PUBLIC_PATHS = new Set<string>(['/worker/health']);

export async function registerAuth(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req, reply) => {
    if (PUBLIC_PATHS.has(req.url.split('?')[0]!)) return;
    const env = loadEnv();
    if (!env.WORKER_SHARED_SECRET) {
      reply.code(503).send({ error: 'worker_secret_not_configured' });
      return reply;
    }
    const provided = req.headers['x-worker-secret'];
    if (typeof provided !== 'string' || !timingSafeEqual(provided, env.WORKER_SHARED_SECRET)) {
      reply.code(401).send({ error: 'unauthorized' });
      return reply;
    }
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
