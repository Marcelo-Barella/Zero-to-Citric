import { after } from 'next/server';
import { getBot } from '@/chat/bot';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const log = logger().child({ route: '/api/webhooks/discord' });
  try {
    const bot = await getBot();
    const res = await bot.adapters.discord.handleWebhook(request, {
      waitUntil: (promise) => after(promise),
    });
    return res;
  } catch (err) {
    log.error({ err }, 'discord webhook error');
    return new Response(JSON.stringify({ error: 'webhook_failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
