import type { FastifyInstance } from 'fastify';
import { rpcTtsSpeakSchema } from '@zero-to-citric/shared-types';

export async function registerTtsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/worker/tts/speak', async (req, reply) => {
    const parsed = rpcTtsSpeakSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    const { speak } = await import('../tts/index.js');
    const r = await speak(parsed.data.text, {
      guildId: parsed.data.guildId,
      channelId: parsed.data.channelId,
      provider: parsed.data.provider,
    });
    if (!r.ok) return reply.code(500).send({ error: r.error });
    return r.data;
  });
}
