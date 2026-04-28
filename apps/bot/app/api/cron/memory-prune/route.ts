import { assertCronSecret, AuthError } from '@/lib/auth';
import { loadEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const log = logger().child({ route: '/api/cron/memory-prune' });
  try {
    assertCronSecret(req);
  } catch (err) {
    if (err instanceof AuthError) return err.toResponse();
    throw err;
  }
  const env = loadEnv();
  if (!env.MEMORY_ENABLED) return Response.json({ removed: 0, reason: 'memory_disabled' });
  try {
    const { pruneOldMemories } = await import('@/memory/db');
    const removed = await pruneOldMemories(env.MEMORY_RETENTION_DAYS ?? 30);
    log.info({ removed }, 'memory prune complete');
    return Response.json({ removed });
  } catch (err) {
    log.error({ err }, 'memory prune failed');
    return Response.json({ error: 'prune_failed' }, { status: 500 });
  }
}
