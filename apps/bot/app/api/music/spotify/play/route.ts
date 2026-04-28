import { z } from 'zod';
import { proxyToWorker, methodNotAllowed } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  spotifyUri: z.string().min(1).max(300),
});

export async function POST(req: Request): Promise<Response> {
  return proxyToWorker(req, {
    schema: Body,
    workerPath: '/worker/music/play',
    method: 'POST',
    transform: (input) => ({
      guildId: input.guildId,
      channelId: input.channelId,
      query: input.spotifyUri,
      source: 'spotify' as const,
    }),
  });
}

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}
