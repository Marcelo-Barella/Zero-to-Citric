import type { FastifyInstance } from 'fastify';
import {
  rpcMusicPlaySchema,
  rpcMusicSimpleSchema,
  rpcMusicVolumeSchema,
  rpcQueueQuerySchema,
} from '@zero-to-citric/shared-types';
import { queueManager } from '../music/queue.js';

export async function registerMusicRoutes(app: FastifyInstance): Promise<void> {
  app.post('/worker/music/play', async (req, reply) => {
    const parsed = rpcMusicPlaySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    const { playMusic } = await import('../music/player.js');
    const r = await playMusic(parsed.data);
    if (!r.ok) return reply.code(500).send({ error: r.error });
    return r.data;
  });

  app.post('/worker/music/stop', async (req, reply) => {
    const parsed = rpcMusicSimpleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    queueManager.stop(parsed.data.guildId);
    return { stopped: true as const };
  });

  app.post('/worker/music/skip', async (req, reply) => {
    const parsed = rpcMusicSimpleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const next = queueManager.skip(parsed.data.guildId);
    return { skipped: true as const, next: next ?? null };
  });

  app.post('/worker/music/pause', async (req, reply) => {
    const parsed = rpcMusicSimpleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    queueManager.pause(parsed.data.guildId);
    return { paused: true as const };
  });

  app.post('/worker/music/resume', async (req, reply) => {
    const parsed = rpcMusicSimpleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    queueManager.resume(parsed.data.guildId);
    return { resumed: true as const };
  });

  app.post('/worker/music/volume', async (req, reply) => {
    const parsed = rpcMusicVolumeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    queueManager.setVolume(parsed.data.guildId, parsed.data.volume);
    return { volume: parsed.data.volume };
  });

  app.get('/worker/music/queue', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const parsed = rpcQueueQuerySchema.safeParse({
      guildId: q.guildId,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
      info_level: q.info_level,
      include_current: q.include_current === 'true',
    });
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    return queueManager.snapshot(parsed.data);
  });
}
