import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rpcVoiceJoinSchema, rpcVoiceLeaveSchema, rpcUserVoiceQuerySchema } from '@zero-to-citric/shared-types';
import { connections } from '../voice/connection-registry.js';
import { getDiscordClient } from '../voice/discord-client.js';

export async function registerVoiceRoutes(app: FastifyInstance): Promise<void> {
  app.post('/worker/voice/join', async (req, reply) => {
    const body = rpcVoiceJoinSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues });
    const client = getDiscordClient();
    if (!client) return reply.code(503).send({ error: 'discord_client_unavailable' });
    const { joinVoice } = await import('../voice/connection.js');
    const result = await joinVoice(client, body.data.guildId, body.data.channelId);
    if (!result.ok) return reply.code(500).send({ error: result.error });
    return { joined: true as const };
  });

  app.post('/worker/voice/leave', async (req, reply) => {
    const body = rpcVoiceLeaveSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues });
    const conn = connections.get(body.data.guildId);
    if (!conn) return reply.code(404).send({ error: 'not_in_voice' });
    conn.destroy();
    connections.delete(body.data.guildId);
    return { left: true as const };
  });

  const querySchema = z.object({ guildId: z.string(), userId: z.string() });
  app.get('/worker/voice-channel', async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    const { guildId, userId } = parsed.data;
    rpcUserVoiceQuerySchema.parse({ guildId, userId });
    const client = getDiscordClient();
    if (!client) return null;
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return null;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member?.voice.channel) return null;
    return { channelId: member.voice.channel.id, channelName: member.voice.channel.name };
  });
}
