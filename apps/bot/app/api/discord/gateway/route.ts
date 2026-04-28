import { after } from 'next/server';
import { getBot } from '@/chat/bot';
import { assertCronSecret, AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

export async function GET(request: Request): Promise<Response> {
  const log = logger().child({ route: '/api/discord/gateway' });
  try {
    assertCronSecret(request);
  } catch (err) {
    if (err instanceof AuthError) return err.toResponse();
    throw err;
  }
  const bot = await getBot();
  const durationMs = 600 * 1000;
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.PUBLIC_URL ?? '';
  const webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/discord` : undefined;
  log.info({ durationMs, webhookUrl }, 'starting discord gateway listener');
  return bot.adapters.discord.startGatewayListener(
    { waitUntil: (p) => after(p) },
    durationMs,
    undefined,
    webhookUrl,
  );
}
