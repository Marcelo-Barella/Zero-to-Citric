import Fastify, { type FastifyInstance, type FastifyBaseLogger } from 'fastify';
import helmet from '@fastify/helmet';
import { loadEnv } from './env.js';
import { logger } from './logger.js';
import { registerAuth } from './auth.js';
import { registerHealthRoutes } from './rpc/routes-health.js';

export async function buildServer(): Promise<{ app: FastifyInstance; env: ReturnType<typeof loadEnv> }> {
  const env = loadEnv();
  const log = logger() as unknown as FastifyBaseLogger;
  const app = Fastify({
    loggerInstance: log,
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: true,
  });
  await app.register(helmet, { global: true, contentSecurityPolicy: false });
  await registerAuth(app);
  await registerHealthRoutes(app);

  // Voice / music / TTS / listen routes are registered when the worker
  // implementations are loaded by the milestones that ship them (M3+).
  try {
    const [{ registerVoiceRoutes }, { registerMusicRoutes }, { registerTtsRoutes }, { registerListenRoutes }, { registerEventsRoute }] =
      await Promise.all([
        import('./rpc/routes-voice.js'),
        import('./rpc/routes-music.js'),
        import('./rpc/routes-tts.js'),
        import('./rpc/routes-listen.js'),
        import('./rpc/events.js'),
      ]);
    await registerVoiceRoutes(app);
    await registerMusicRoutes(app);
    await registerTtsRoutes(app);
    await registerListenRoutes(app);
    await registerEventsRoute(app);
  } catch (err) {
    log.warn({ err }, 'optional rpc routes failed to register');
  }

  app.setErrorHandler((err, _req, reply) => {
    log.error({ err }, 'unhandled error');
    if (reply.sent) return;
    void reply.code(500).send({ error: 'internal_error' });
  });
  return { app, env };
}

async function main(): Promise<void> {
  const { app, env } = await buildServer();
  try {
    const { initDiscordClient } = await import('./voice/discord-client.js');
    await initDiscordClient();
  } catch (err) {
    app.log.warn({ err }, 'discord client not initialized; voice features limited');
  }
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info({ port: env.PORT }, 'voice worker listening');
  process.on('SIGTERM', () => {
    app.log.info('SIGTERM received');
    void app.close().then(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    app.log.info('SIGINT received');
    void app.close().then(() => process.exit(0));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('fatal startup error', err);
    process.exit(1);
  });
}
