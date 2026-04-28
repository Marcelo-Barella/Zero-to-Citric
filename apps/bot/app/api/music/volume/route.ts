import { rpcMusicVolumeSchema } from '@zero-to-citric/shared-types';
import { proxyToWorker, methodNotAllowed } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return proxyToWorker(req, { schema: rpcMusicVolumeSchema, workerPath: '/worker/music/volume', method: 'POST' });
}

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}
