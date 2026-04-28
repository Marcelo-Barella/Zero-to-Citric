import type { FastifyInstance } from 'fastify';
import { loadEnv } from '../env.js';
import { connections } from '../voice/connection-registry.js';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/worker/health', async () => {
    const env = loadEnv();
    return {
      ready: true,
      version: env.APP_VERSION,
      voiceConnections: connections.count(),
    };
  });
}
