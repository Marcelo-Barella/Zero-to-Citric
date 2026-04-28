import { assertAdminToken, AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const log = logger().child({ route: '/api/admin/init-db' });
  try {
    assertAdminToken(req);
  } catch (err) {
    if (err instanceof AuthError) return err.toResponse();
    throw err;
  }
  try {
    const { initSchema } = await import('@/memory/db');
    await initSchema();
    return Response.json({ ok: true });
  } catch (err) {
    log.error({ err }, 'init-db failed');
    return Response.json({ error: 'init_failed' }, { status: 500 });
  }
}
