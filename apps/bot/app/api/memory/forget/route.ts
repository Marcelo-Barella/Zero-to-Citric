import { z } from 'zod';
import { assertAdminToken, assertContentType, AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  scope: z.enum(['user', 'guild']),
  guildId: z.string().min(1),
  userId: z.string().min(1).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const log = logger().child({ route: '/api/memory/forget' });
  try {
    assertAdminToken(req);
    assertContentType(req);
  } catch (err) {
    if (err instanceof AuthError) return err.toResponse();
    throw err;
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  if (parsed.data.scope === 'user' && !parsed.data.userId) {
    return Response.json({ error: 'user_id_required' }, { status: 400 });
  }
  try {
    const { deleteByGuild, deleteByUser } = await import('@/memory/db');
    const { deleteRecentByGuild, deleteRecentByUser } = await import('@/memory/redis');
    let memories = 0;
    let recent = 0;
    if (parsed.data.scope === 'guild') {
      memories = await deleteByGuild(parsed.data.guildId);
      recent = await deleteRecentByGuild(parsed.data.guildId);
    } else {
      memories = await deleteByUser(parsed.data.guildId, parsed.data.userId!);
      recent = await deleteRecentByUser(parsed.data.guildId, parsed.data.userId!);
    }
    return Response.json({ ok: true, deleted: { memories, recent } });
  } catch (err) {
    log.error({ err }, 'forget failed');
    return Response.json({ error: 'forget_failed' }, { status: 500 });
  }
}
