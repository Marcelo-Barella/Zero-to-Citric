import { rpcUserVoiceQuerySchema } from '@zero-to-citric/shared-types';
import { proxyToWorker, methodNotAllowed } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  return proxyToWorker(req, { schema: rpcUserVoiceQuerySchema, workerPath: '/worker/voice-channel', method: 'GET' });
}

export async function POST(): Promise<Response> {
  return methodNotAllowed();
}
