import type { FastifyInstance } from 'fastify';
import { eventBus } from './event-bus.js';

export async function registerEventsRoute(app: FastifyInstance): Promise<void> {
  app.get('/worker/events', async (req, reply) => {
    reply.raw.setHeader('content-type', 'text/event-stream');
    reply.raw.setHeader('cache-control', 'no-cache');
    reply.raw.setHeader('connection', 'keep-alive');
    reply.raw.flushHeaders();

    const send = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    const handler = (event: string, data: unknown): void => send(event, data);
    eventBus.on('event', handler);

    const heartbeat = setInterval(() => reply.raw.write(': hb\n\n'), 15000);
    req.raw.on('close', () => {
      clearInterval(heartbeat);
      eventBus.off('event', handler);
    });
    // Return a never-resolving promise; route stays open.
    await new Promise<void>(() => {});
  });
}
