import { rpcMusicSimpleSchema } from '@zero-to-citric/shared-types';
import { proxyToWorker, methodNotAllowed } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return proxyToWorker(req, { schema: rpcMusicSimpleSchema, workerPath: '/worker/music/skip', method: 'POST' });
}

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}
