import { z } from 'zod';
import { proxyToWorker, methodNotAllowed } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({
  guildId: z.string().min(1),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v))),
  offset: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v))),
  info_level: z.enum(['compact', 'full']).optional(),
  include_current: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
});

export async function GET(req: Request): Promise<Response> {
  return proxyToWorker(req, { schema: Query, workerPath: '/worker/music/queue', method: 'GET' });
}

export async function POST(): Promise<Response> {
  return methodNotAllowed();
}
