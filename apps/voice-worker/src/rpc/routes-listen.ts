import type { FastifyInstance } from 'fastify';
import { rpcListenStartSchema } from '@zero-to-citric/shared-types';

export async function registerListenRoutes(app: FastifyInstance): Promise<void> {
  app.post('/worker/listen/start', async (req, reply) => {
    const parsed = rpcListenStartSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    const { startListening } = await import('../wakeword.js');
    const r = await startListening(parsed.data);
    if (!r.ok) return reply.code(500).send({ error: r.error });
    return r.data;
  });

  app.post('/worker/listen/stop', async (req, reply) => {
    const parsed = rpcListenStartSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const { stopListening } = await import('../wakeword.js');
    stopListening(parsed.data);
    return { listening: false as const };
  });
}
