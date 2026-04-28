import { loadEnv } from '@/lib/env';
import { voiceWorker } from '@/lib/voice-worker-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WorkerHealth {
  ready: boolean;
  voiceConnections?: number;
  version?: string;
}

export async function GET(): Promise<Response> {
  const env = loadEnv();
  let worker: WorkerHealth | { ready: false; reason?: string } = { ready: false, reason: 'voice_disabled' };
  if (voiceWorker.enabled) {
    const r = await voiceWorker.get<WorkerHealth>('/worker/health');
    worker = r.ok ? r.data : { ready: false, reason: r.error };
  }
  const body = {
    status: 'ok',
    bot_ready: true,
    worker,
    version: env.APP_VERSION,
    locale: env.BOT_LOCALE,
    features: {
      memory: env.MEMORY_ENABLED,
      web_search: env.WEB_SEARCH_ENABLED && Boolean(env.TAVILY_API_KEY),
      n8n: Boolean(env.N8N_WEBHOOK_URL),
      voice: voiceWorker.enabled,
      legacy_routes: env.LEGACY_ROUTES,
    },
  };
  return Response.json(body, { status: 200 });
}
