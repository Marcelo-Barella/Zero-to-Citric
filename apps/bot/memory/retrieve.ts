import { loadEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { PersonaContext } from '@zero-to-citric/persona';

export interface RetrieveOpts {
  guildId: string;
  channelId: string;
  userId: string;
  query: string;
}

export async function retrieveContext(opts: RetrieveOpts): Promise<PersonaContext> {
  const env = loadEnv();
  if (!env.MEMORY_ENABLED) return { recent: [], semantic: [] };
  const log = logger().child({ component: 'memory.retrieve' });
  try {
    const [{ getRecent }, { semanticSearch }] = await Promise.all([
      import('./redis.js'),
      import('./db.js'),
    ]);
    const recent = await getRecent(opts.guildId, opts.channelId, opts.userId);
    const semantic = await semanticSearch(opts);
    return { recent, semantic };
  } catch (err) {
    log.warn({ err }, 'retrieveContext failed');
    return { recent: [], semantic: [] };
  }
}
