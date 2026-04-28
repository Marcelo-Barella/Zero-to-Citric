import { rpcTtsSpeakSchema } from '@zero-to-citric/shared-types';
import { proxyToWorker, methodNotAllowed } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return proxyToWorker(req, {
    schema: rpcTtsSpeakSchema,
    workerPath: '/worker/tts/speak',
    method: 'POST',
    transform: (input) => ({ ...input, provider: input.provider ?? 'elevenlabs' }),
  });
}

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}
